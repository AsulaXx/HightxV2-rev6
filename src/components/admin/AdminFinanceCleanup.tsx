import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, deleteDoc, doc, query, orderBy, limit, runTransaction,
} from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Trash2, RefreshCw, Filter, Wallet, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";

interface Props { user: User; profile: UserProfile | null; }

type TabKey = "topup" | "wallet";

interface RowBase {
  id: string;
  createdAt?: Date | null;
  userId?: string;
  userEmail?: string;
  userName?: string;
  amount?: number;
  status?: string;
  method?: string;
  type?: string; // wallet tx type (credit/debit)
  note?: string;
  raw: any;
}

const fmtDate = (d?: Date | null) => {
  if (!d) return "-";
  try { return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }
  catch { return d.toISOString(); }
};

export default function AdminFinanceCleanup({ user, profile }: Props) {
  const [tab, setTab] = useState<TabKey>("topup");
  const [rows, setRows] = useState<RowBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rowLimit, setRowLimit] = useState(100);
  const [reverseWallet, setReverseWallet] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const colName = tab === "topup" ? "topUpHistory" : "walletTransactions";
      const q = query(collection(db, colName), orderBy("createdAt", "desc"), limit(rowLimit));
      const snap = await getDocs(q);
      const items: RowBase[] = snap.docs.map(d => {
        const data: any = d.data();
        return {
          id: d.id,
          createdAt: data.createdAt?.toDate?.() ?? null,
          userId: data.userId || data.uid || "",
          userEmail: data.userEmail || data.email || "",
          userName: data.userName || data.displayName || "",
          amount: Number(data.amount ?? 0),
          status: data.status || "",
          method: data.method || "",
          type: data.type || "",
          note: data.note || data.reason || data.error || "",
          raw: data,
        };
      });
      setRows(items);
    } catch (err) {
      console.error(err);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, rowLimit]);

  const filtered = useMemo(() => {
    const em = emailFilter.trim().toLowerCase();
    return rows.filter(r => {
      if (em && !(`${r.userEmail} ${r.userName} ${r.userId}`.toLowerCase().includes(em))) return false;
      if (statusFilter !== "all") {
        const s = (r.status || r.type || "").toLowerCase();
        if (s !== statusFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [rows, emailFilter, statusFilter]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const adjustWallet = async (uid: string, delta: number) => {
    if (!uid || !delta) return;
    const ref = doc(db, "wallets", uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists() ? Number((snap.data() as any).balance || 0) : 0;
      tx.set(ref, { balance: Math.max(0, cur + delta) }, { merge: true });
    });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ok = window.confirm(`ยืนยันลบ ${selected.size} รายการ? ${tab === "topup" && reverseWallet ? "\nจะหักคืนยอดเงินของ user จาก wallet ด้วย" : ""}`);
    if (!ok) return;
    setBusy(true);
    let deleted = 0;
    let reversed = 0;
    try {
      const colName = tab === "topup" ? "topUpHistory" : "walletTransactions";
      for (const id of selected) {
        const row = rows.find(r => r.id === id);
        if (!row) continue;
        // Reverse wallet balance
        if (row.userId && row.amount) {
          try {
            if (tab === "topup" && reverseWallet && (row.status || "").toLowerCase() === "success") {
              await adjustWallet(row.userId, -Math.abs(row.amount));
              reversed++;
            } else if (tab === "wallet" && reverseWallet) {
              const t = (row.type || "").toLowerCase();
              const signed = t === "debit" ? Math.abs(row.amount) : -Math.abs(row.amount);
              await adjustWallet(row.userId, signed);
              reversed++;
            }
          } catch (err) { console.warn("reverse failed", id, err); }
        }
        await deleteDoc(doc(db, colName, id));
        deleted++;
      }
      await logActivity(
        user, profile, "finance_cleanup",
        `ล้างข้อมูล ${tab === "topup" ? "topUpHistory" : "walletTransactions"} ${deleted} รายการ (หักคืน wallet: ${reversed})`
      );
      toast.success(`ลบสำเร็จ ${deleted} รายการ • หักคืนยอด ${reversed}`);
      setSelected(new Set());
      await load();
    } catch (err) {
      console.error(err);
      toast.error("เกิดข้อผิดพลาดขณะลบ");
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = tab === "topup"
    ? [{ v: "all", l: "ทั้งหมด" }, { v: "success", l: "success" }, { v: "failed", l: "failed" }, { v: "pending", l: "pending" }]
    : [{ v: "all", l: "ทั้งหมด" }, { v: "credit", l: "credit (+)" }, { v: "debit", l: "debit (−)" }];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={22} />
        <div className="min-w-0">
          <h3 className="font-bold text-amber-500 text-sm">🧹 ล้างข้อมูลการเงินทดสอบ</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            เลือกลบเฉพาะรายการที่ไม่ต้องการ (เช่น รายการทดสอบเติมเงินแล้วลบ) โดยระบบจะ<strong className="text-amber-500"> หักคืนยอด Wallet ของผู้ใช้ให้อัตโนมัติ</strong> เพื่อให้ยอดสรุปตรงกับความเป็นจริง
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { k: "topup", l: "ประวัติเติมเงิน", icon: Receipt },
          { k: "wallet", l: "ธุรกรรม Wallet", icon: Wallet },
        ] as const).map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              tab === t.k
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-card/50 border-border/30 text-muted-foreground hover:border-border/60"
            }`}>
            <t.icon size={15} /> {t.l}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="sm:col-span-2 relative">
          <Filter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={emailFilter} onChange={e => setEmailFilter(e.target.value)}
            placeholder="ค้นหา email / ชื่อ / uid"
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-card/80 border border-border/40 text-xs text-foreground" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-2 py-2 rounded-lg bg-card/80 border border-border/40 text-xs text-foreground">
          {statusOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <select value={rowLimit} onChange={e => setRowLimit(parseInt(e.target.value))}
          className="px-2 py-2 rounded-lg bg-card/80 border border-border/40 text-xs text-foreground">
          {[50, 100, 200, 500].map(n => <option key={n} value={n}>ล่าสุด {n} รายการ</option>)}
        </select>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={load} disabled={loading}
          className="px-3 py-2 rounded-lg border border-border/40 text-xs text-muted-foreground hover:bg-muted/30 flex items-center gap-1.5 disabled:opacity-50">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={reverseWallet} onChange={e => setReverseWallet(e.target.checked)} />
          หักคืนยอด Wallet เมื่อลบ
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{selected.size} / {filtered.length} เลือก</span>
          <button onClick={deleteSelected} disabled={selected.size === 0 || busy}
            className="px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 disabled:opacity-40 flex items-center gap-1.5">
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            ลบที่เลือก
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0 backdrop-blur">
              <tr className="text-left text-muted-foreground">
                <th className="p-2 w-8">
                  <input type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll} />
                </th>
                <th className="p-2">วันที่</th>
                <th className="p-2">ผู้ใช้</th>
                <th className="p-2 text-right">จำนวน</th>
                <th className="p-2">{tab === "topup" ? "สถานะ / วิธี" : "ประเภท"}</th>
                <th className="p-2">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Loader2 size={16} className="inline animate-spin" /> กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">ไม่พบข้อมูล</td></tr>
              ) : filtered.map(r => {
                const isSel = selected.has(r.id);
                const isDebit = (r.type || "").toLowerCase() === "debit";
                return (
                  <tr key={r.id} onClick={() => toggle(r.id)}
                    className={`border-t border-border/20 cursor-pointer hover:bg-muted/20 ${isSel ? "bg-destructive/10" : ""}`}>
                    <td className="p-2"><input type="checkbox" checked={isSel} onChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} /></td>
                    <td className="p-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</td>
                    <td className="p-2 min-w-[160px]">
                      <div className="text-foreground truncate max-w-[220px]">{r.userName || "-"}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{r.userEmail || r.userId}</div>
                    </td>
                    <td className={`p-2 text-right font-mono font-bold ${isDebit ? "text-red-400" : "text-emerald-400"}`}>
                      {isDebit ? "−" : "+"}{(r.amount || 0).toLocaleString()}
                    </td>
                    <td className="p-2">
                      {tab === "topup" ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${r.status === "success" ? "text-emerald-400" : r.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                            {r.status === "success" && <CheckCircle2 size={10} />} {r.status || "-"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{r.method || "-"}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">{r.type || "-"}</span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground text-[11px] max-w-[280px] truncate" title={r.note}>{r.note || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
