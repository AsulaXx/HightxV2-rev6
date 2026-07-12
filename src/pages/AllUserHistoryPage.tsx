import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { History, Search, RefreshCw, Download, User as UserIcon, Wallet, ShoppingBag, CircleDot, ScrollText, ReceiptText, Loader2, Copy } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit as fLimit } from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Activity = {
  id: string;
  source: "claim" | "topup" | "wheel" | "ledger" | "activity";
  ts: Date | null;
  title: string;
  detail: string;
  amount?: number;
  amountCls?: string;
  meta?: Record<string, any>;
};

const toDateSafe = (v: any): Date | null => {
  if (!v) return null;
  try {
    if (typeof v?.toDate === "function") return v.toDate();
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === "number") return new Date(v);
    if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
    if (v?.seconds) return new Date(v.seconds * 1000);
  } catch { /* */ }
  return null;
};

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

const SOURCE_META: Record<Activity["source"], { label: string; cls: string; Icon: any }> = {
  claim: { label: "กดคีย์", cls: "bg-primary/15 text-primary border-primary/30", Icon: ShoppingBag },
  topup: { label: "เติมเงิน", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", Icon: Wallet },
  wheel: { label: "วงล้อ", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30", Icon: CircleDot },
  ledger: { label: "Ledger", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", Icon: ReceiptText },
  activity: { label: "กิจกรรม", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", Icon: ScrollText },
};

const AllUserHistoryPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<{ uid?: string; email?: string; name?: string } | null>(null);
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user) return <RedirectToLogin />;
  if (!hasPermission("admin")) return <Navigate to="/" replace />;

  const search = async () => {
    const raw = input.trim();
    if (!raw) { toast.error("กรอกอีเมลหรือ UID"); return; }
    setLoading(true);
    setItems([]);
    setTarget(null);

    let uid: string | undefined;
    let email: string | undefined;
    let name: string | undefined;

    try {
      // Resolve via users collection
      const isEmail = raw.includes("@");
      if (isEmail) {
        email = raw.toLowerCase();
        const us = await getDocs(query(collection(db, "users"), where("email", "==", email), fLimit(1)));
        if (!us.empty) {
          const u = us.docs[0];
          uid = u.id;
          name = (u.data() as any).displayName || (u.data() as any).name;
        }
      } else {
        uid = raw;
        try {
          const us = await getDocs(query(collection(db, "users"), where("__name__", "==", uid), fLimit(1)));
          if (!us.empty) {
            const d = us.docs[0].data() as any;
            email = d.email;
            name = d.displayName || d.name;
          }
        } catch { /* */ }
      }
    } catch (e) {
      console.warn("resolve user failed", e);
    }

    setTarget({ uid, email, name });

    const out: Activity[] = [];

    const runQ = async (col: string, field: string, value: string, mapper: (id: string, d: any) => Activity | null) => {
      try {
        const snap = await getDocs(query(collection(db, col), where(field, "==", value), fLimit(500)));
        snap.forEach(doc => {
          const m = mapper(doc.id, doc.data());
          if (m) out.push(m);
        });
      } catch (e) {
        console.warn(`[user-history] ${col}.${field} failed`, e);
      }
    };

    const tasks: Promise<void>[] = [];

    // Keys claimed
    if (uid) tasks.push(runQ("keys", "claimedBy", uid, (id, d) => ({
      id: `claim:${id}`, source: "claim", ts: toDateSafe(d.claimedAt),
      title: `คีย์: ${d.productId || ""} ${d.durationId || ""}`,
      detail: `${d.key || ""}${d.purchaseType ? ` · ${d.purchaseType}` : ""}`,
      amount: typeof d.price === "number" ? -d.price : undefined,
      amountCls: "text-rose-300",
      meta: d,
    })));
    if (email) tasks.push(runQ("keys", "claimedByEmail", email, (id, d) => ({
      id: `claim:${id}`, source: "claim", ts: toDateSafe(d.claimedAt),
      title: `คีย์: ${d.productId || ""} ${d.durationId || ""}`,
      detail: `${d.key || ""}${d.purchaseType ? ` · ${d.purchaseType}` : ""}`,
      amount: typeof d.price === "number" ? -d.price : undefined,
      amountCls: "text-rose-300",
      meta: d,
    })));

    // Top-up
    if (uid) tasks.push(runQ("topUpHistory", "userId", uid, (id, d) => ({
      id: `topup:${id}`, source: "topup", ts: toDateSafe(d.createdAt),
      title: `เติม ${d.method || "bank"} · ${d.status || ""}`,
      detail: d.transRef || d.error || d.errorMessage || "",
      amount: d.amount, amountCls: "text-emerald-300", meta: d,
    })));

    // Wheel
    if (uid) tasks.push(runQ("wheelClaims", "userId", uid, (id, d) => ({
      id: `wheel:${id}`, source: "wheel", ts: toDateSafe(d.claimedAt),
      title: `วงล้อ: ${d.wheelName || ""} → ${d.prizeLabel || ""}`,
      detail: `${d.productName || ""}${d.key ? ` · key: ${d.key}` : ""}`,
      amount: d.costCredit ? -d.costCredit : 0, amountCls: "text-rose-300", meta: d,
    })));

    // Ledger
    if (uid) tasks.push(runQ("walletLedger", "userId", uid, (id, d) => ({
      id: `ledger:${id}`, source: "ledger", ts: toDateSafe(d.createdAt || d.at),
      title: `${d.type || "ledger"}`,
      detail: d.description || d.refId || "",
      amount: d.amount, amountCls: (d.amount || 0) >= 0 ? "text-emerald-300" : "text-rose-300",
      meta: d,
    })));

    // Activity logs
    if (uid) tasks.push(runQ("activityLogs", "userId", uid, (id, d) => ({
      id: `act:${id}`, source: "activity", ts: toDateSafe(d.timestamp),
      title: d.action || "activity",
      detail: d.details || "",
      meta: d,
    })));

    await Promise.all(tasks);

    // dedupe by id
    const seen = new Set<string>();
    const dedup = out.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
    dedup.sort((a, b) => (b.ts?.getTime() || 0) - (a.ts?.getTime() || 0));
    setItems(dedup);
    setLoading(false);

    if (dedup.length === 0) toast("ไม่พบประวัติของผู้ใช้นี้");
  };

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return items.filter(r => {
      if (filterSource !== "all" && r.source !== filterSource) return false;
      if (from || to) {
        const t = r.ts?.getTime() ?? 0;
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      return true;
    });
  }, [items, filterSource, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let topup = 0, spend = 0;
    items.forEach(i => {
      if (i.source === "topup" && i.meta?.status === "success") topup += i.amount || 0;
      if (i.source === "claim") spend += Math.abs(i.amount || 0);
      if (i.source === "wheel") spend += Math.abs(i.amount || 0);
    });
    return { topup, spend };
  }, [items]);

  const exportXLSX = () => {
    if (filtered.length === 0) { toast.error("ไม่มีข้อมูล"); return; }
    const data = filtered.map(r => ({
      วันที่: fmt(r.ts), หมวด: SOURCE_META[r.source].label,
      หัวข้อ: r.title, รายละเอียด: r.detail, มูลค่า: r.amount ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "UserHistory");
    XLSX.writeFile(wb, `user-history_${(target?.email || target?.uid || "user")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const copy = (s?: string) => { if (!s) return; navigator.clipboard?.writeText(s); toast.success("คัดลอกแล้ว"); };

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "เครื่องมือจัดการ", path: "/hub" }, { label: "ประวัติทั้งหมดของผู้ใช้" }]}
        title="ประวัติทั้งหมดของผู้ใช้"
        subtitle="ค้นหารายละเอียดการกระทำทั้งหมดของผู้ใช้รายบุคคล (กดคีย์ / เติมเงิน / วงล้อ / ledger / กิจกรรม)"
        icon={History}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="glass-card !p-3 mb-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") search(); }}
                placeholder="กรอก Email หรือ UID ของผู้ใช้แล้วกด Enter"
                className="input-glass w-full pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <button onClick={search} disabled={loading} className="btn-gradient px-5 py-2.5 text-sm flex items-center gap-2 justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} ค้นหา
            </button>
          </div>
        </div>

        {target && (
          <div className="glass-card !p-3 mb-4 flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><UserIcon size={18} className="text-primary" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-foreground">{target.name || target.email || target.uid}</div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {target.email && <span className="flex items-center gap-1">{target.email}<button onClick={() => copy(target.email)}><Copy size={10} /></button></span>}
                {target.uid && <span className="flex items-center gap-1 font-mono">UID: {target.uid.slice(0, 12)}...<button onClick={() => copy(target.uid)}><Copy size={10} /></button></span>}
              </div>
            </div>
            <div className="flex gap-2">
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase">เติมรวม</div>
                <div className="font-bold text-emerald-300">+{totals.topup.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase">ใช้จ่าย</div>
                <div className="font-bold text-rose-300">-{totals.spend.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground uppercase">รายการ</div>
                <div className="font-bold">{items.length}</div>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="glass-card !p-3 mb-4">
            <div className="grid md:grid-cols-4 gap-2">
              <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="input-glass px-3 py-2 text-sm">
                <option value="all">ทุกหมวด</option>
                <option value="claim">กดคีย์</option>
                <option value="topup">เติมเงิน</option>
                <option value="wheel">วงล้อ</option>
                <option value="ledger">Ledger</option>
                <option value="activity">กิจกรรม</option>
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-glass px-2 py-2 text-xs" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-glass px-2 py-2 text-xs" />
              <button onClick={exportXLSX} className="btn-glass px-3 py-2 text-sm flex items-center gap-2 justify-center"><Download size={14} /> Export Excel</button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">แสดง {filtered.length} จาก {items.length} รายการ</p>
          </div>
        )}

        {loading ? (
          <div className="glass-card text-center py-12"><Loader2 className="animate-spin text-primary mx-auto mb-3" size={28} /><p className="text-muted-foreground text-sm">กำลังค้นหา...</p></div>
        ) : items.length === 0 && target ? (
          <div className="glass-card text-center py-12 text-muted-foreground">ไม่พบประวัติของผู้ใช้นี้</div>
        ) : items.length === 0 ? (
          <div className="glass-card text-center py-12 text-muted-foreground">กรอก Email หรือ UID เพื่อเริ่มค้นหา</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const meta = SOURCE_META[r.source];
              const Icon = meta.Icon;
              return (
                <div key={r.id} className="glass-card !p-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-background/40 flex items-center justify-center shrink-0 border border-border/40">
                    <Icon size={16} className="text-foreground/80" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${meta.cls}`}>{meta.label}</span>
                      <span className="text-sm font-bold text-foreground truncate">{r.title}</span>
                    </div>
                    {r.detail && <div className="text-xs text-muted-foreground mt-0.5 break-all">{r.detail}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">{fmt(r.ts)}</div>
                  </div>
                  {typeof r.amount === "number" && r.amount !== 0 && (
                    <div className={`text-sm font-bold whitespace-nowrap ${r.amountCls || ""}`}>
                      {r.amount > 0 ? "+" : ""}{r.amount.toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AllUserHistoryPage;
