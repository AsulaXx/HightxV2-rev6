import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import RedirectToLogin from "@/components/RedirectToLogin";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, serverTimestamp, limit as flimit } from "firebase/firestore";
import { applyLedger, generateAttemptId } from "@/lib/walletLedger";
import { logActivity } from "@/lib/activityLogger";
import { toast } from "sonner";
import { AlertTriangle, Check, X, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";

interface ReviewRecord {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  amount: number;
  creditAmount?: number;
  transRef?: string;
  method?: string;
  errorMessage?: string;
  error?: string;
  voucherUrl?: string;
  attemptId?: string;
  createdAt?: any;
  reviewStatus?: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: any;
  needsManualReview?: boolean;
}

const AdminReconcilePage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { maxWidthClass } = useLayoutConfig();
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const isAllowed = hasPermission("admin");

  const load = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "topUpHistory"), where("needsManualReview", "==", true), flimit(500));
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ReviewRecord));
      rows.sort((a, b) => (b.createdAt?.toDate?.()?.getTime?.() || 0) - (a.createdAt?.toDate?.()?.getTime?.() || 0));
      setRecords(rows);
    } catch (e) {
      console.error("[reconcile] load failed", e);
      toast.error("โหลดรายการไม่สำเร็จ");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isAllowed) load(); }, [isAllowed]);

  if (!user || !profile) return <RedirectToLogin />;
  if (!isAllowed) return <Navigate to="/hub" replace />;

  const filtered = useMemo(() => records.filter(r => {
    if (!showResolved && (r.reviewStatus === "approved" || r.reviewStatus === "rejected")) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return [r.userEmail, r.userName, r.transRef, r.attemptId, r.voucherUrl, r.errorMessage, r.error]
      .some(v => (v || "").toString().toLowerCase().includes(s));
  }), [records, search, showResolved]);

  const approve = async (r: ReviewRecord) => {
    if (busyId) return;
    const amt = Number(r.creditAmount ?? r.amount) || 0;
    if (amt <= 0) { toast.error("ยอดเงินไม่ถูกต้อง"); return; }
    if (!confirm(`อนุมัติเครดิต ฿${amt.toLocaleString()} ให้ ${r.userName || r.userEmail}?`)) return;
    setBusyId(r.id);
    try {
      const attemptId = generateAttemptId("recon");
      await applyLedger({
        userId: r.userId, userEmail: r.userEmail, userName: r.userName,
        amount: amt, type: "topup_reconcile_approve",
        description: `อนุมัติด้วยตนเอง — เดิมจาก ${r.method || "?"} (Ref: ${r.transRef || "-"})`,
        refId: r.transRef || r.id, method: r.method,
        actorId: user.uid, actorName: profile?.displayName || profile?.email || "",
        meta: { attemptId, originalAttemptId: r.attemptId, originalDocId: r.id },
      });
      await updateDoc(doc(db, "topUpHistory", r.id), {
        reviewStatus: "approved",
        reviewedBy: user.uid,
        reviewedByName: profile?.displayName || profile?.email || "",
        reviewedAt: serverTimestamp(),
        needsManualReview: false,
        status: "success",
        reconcileAttemptId: attemptId,
      });
      await logActivity(user, profile, "admin_credit", `อนุมัติเครดิตจากการตรวจสอบ ฿${amt.toLocaleString()} ให้ ${r.userName || r.userEmail} (Ref: ${r.transRef})`);
      toast.success("อนุมัติสำเร็จ");
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "อนุมัติไม่สำเร็จ");
    } finally { setBusyId(null); }
  };

  const reject = async (r: ReviewRecord) => {
    if (busyId) return;
    const reason = prompt("เหตุผลที่ปฏิเสธ?", r.errorMessage || "");
    if (reason === null) return;
    setBusyId(r.id);
    try {
      await updateDoc(doc(db, "topUpHistory", r.id), {
        reviewStatus: "rejected",
        reviewedBy: user.uid,
        reviewedByName: profile?.displayName || profile?.email || "",
        reviewedAt: serverTimestamp(),
        rejectReason: reason || "",
        needsManualReview: false,
      });
      await logActivity(user, profile, "admin_credit", `ปฏิเสธคำขอเติมเงิน Ref: ${r.transRef} (${reason || "-"})`);
      toast.success("ปฏิเสธแล้ว");
      load();
    } catch (e: any) {
      console.error(e);
      toast.error("ปฏิเสธไม่สำเร็จ");
    } finally { setBusyId(null); }
  };

  return (
    <div className={`${maxWidthClass} mx-auto px-3 sm:px-4 py-6 sm:py-8`}>
      <PageBreadcrumb title="ตรวจสอบรายการเติมเงิน" items={[{ label: "Admin", path: "/admin" }, { label: "ตรวจสอบรายการเติมเงิน" }]} />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="text-primary" size={22} /> ตรวจสอบรายการเติมเงิน
            </h1>
            <p className="text-xs text-muted-foreground mt-1">รายการที่ต้องตรวจสอบด้วยตัวเอง — อนุมัติเพื่อเครดิตเงินแบบ atomic ผ่าน ledger</p>
          </div>
          <button onClick={load} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
            <RefreshCw size={13} /> รีเฟรช
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา email / ref / attemptId..." className="input-glass w-full pl-9 pr-4 py-2.5 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
            แสดงรายการที่ดำเนินการแล้ว
          </label>
        </div>

        {loading ? (
          <div className="glass-card !p-8 text-center"><RefreshCw className="animate-spin mx-auto text-primary mb-2" size={20} /><p className="text-sm text-muted-foreground">กำลังโหลด...</p></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card !p-8 text-center">
            <ShieldCheck className="mx-auto text-emerald-400 mb-2" size={28} />
            <p className="text-sm text-muted-foreground">ไม่มีรายการที่ต้องตรวจสอบ</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const date = r.createdAt?.toDate?.();
              const amt = Number(r.creditAmount ?? r.amount) || 0;
              const resolved = r.reviewStatus === "approved" || r.reviewStatus === "rejected";
              return (
                <div key={r.id} className={`glass-card !p-4 border ${resolved ? "border-border/20 opacity-70" : "border-yellow-500/30"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle size={14} className="text-yellow-400" />
                        <span className="text-sm font-bold text-foreground truncate">{r.userName || r.userEmail || r.userId}</span>
                        <span className="text-[10px] text-muted-foreground truncate">{r.userEmail}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Wallet size={11} /> <b className="text-primary">฿{amt.toLocaleString()}</b></span>
                        <span>วิธี: <b className="text-foreground">{r.method || "-"}</b></span>
                        <span>Ref: <span className="font-mono">{r.transRef || "-"}</span></span>
                        {r.attemptId && <span>Attempt: <span className="font-mono text-[10px]">{r.attemptId}</span></span>}
                        <span>{date ? date.toLocaleString("th-TH") : "-"}</span>
                      </div>
                      {(r.errorMessage || r.error) && (
                        <p className="text-[11px] text-destructive mt-1.5">{r.errorMessage || r.error}</p>
                      )}
                      {r.voucherUrl && (
                        <a href={r.voucherUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline break-all">{r.voucherUrl}</a>
                      )}
                      {resolved && (
                        <p className="text-[10px] mt-1 text-muted-foreground">
                          {r.reviewStatus === "approved" ? "✓ อนุมัติแล้ว" : "✗ ปฏิเสธแล้ว"}
                          {(r as any).reviewedByName ? ` โดย ${(r as any).reviewedByName}` : ""}
                        </p>
                      )}
                    </div>
                    {!resolved && (
                      <div className="flex gap-2 shrink-0">
                        <button disabled={busyId === r.id} onClick={() => approve(r)} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50">
                          <Check size={13} /> อนุมัติ
                        </button>
                        <button disabled={busyId === r.id} onClick={() => reject(r)} className="bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50">
                          <X size={13} /> ปฏิเสธ
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AdminReconcilePage;
