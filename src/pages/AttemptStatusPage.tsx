import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import RedirectToLogin from "@/components/RedirectToLogin";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, limit as flimit } from "firebase/firestore";
import { Search, CheckCircle2, AlertTriangle, XCircle, Loader2, Wallet, CircleDot, ReceiptText, Clock, Copy } from "lucide-react";
import { toast } from "sonner";

type FoundRecord = {
  source: "topUpHistory" | "wheelClaims" | "walletLedger";
  id: string;
  data: any;
};

const fmt = (ts: any) => {
  if (!ts) return "-";
  const d = ts?.toDate ? ts.toDate() : (typeof ts === "number" ? new Date(ts) : new Date(ts));
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const statusBadge = (s?: string) => {
  const map: Record<string, { cls: string; label: string; Icon: any }> = {
    success: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "สำเร็จ", Icon: CheckCircle2 },
    failed: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", label: "ล้มเหลว", Icon: XCircle },
    pending: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "รอดำเนินการ", Icon: Clock },
  };
  const v = map[s || ""] || { cls: "bg-muted/30 text-muted-foreground border-border", label: s || "-", Icon: AlertTriangle };
  const I = v.Icon;
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${v.cls}`}><I className="w-3 h-3" />{v.label}</span>;
};

const sourceMeta: Record<string, { label: string; color: string; Icon: any }> = {
  topUpHistory: { label: "Top-Up", color: "text-emerald-300", Icon: Wallet },
  wheelClaims: { label: "Wheel", color: "text-violet-300", Icon: CircleDot },
  walletLedger: { label: "Ledger", color: "text-sky-300", Icon: ReceiptText },
};

const AttemptStatusPage = () => {
  const { user, profile, hasPermission, loading: authLoading } = useAuth();
  const { maxWidthClass } = useLayoutConfig();
  const [params, setParams] = useSearchParams();
  const initial = params.get("id") || "";
  const [input, setInput] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<FoundRecord[]>([]);

  const isAdmin = hasPermission?.("admin");

  if (authLoading) return null;
  if (!user) return <RedirectToLogin />;

  const search = async (raw?: string) => {
    const id = (raw ?? input).trim();
    if (!id) {
      toast.error("กรุณากรอก attemptId หรือ transRef");
      return;
    }
    setParams({ id }, { replace: true });
    setLoading(true);
    setSearched(true);
    setResults([]);
    const found: FoundRecord[] = [];

    const runQ = async (source: FoundRecord["source"], col: string, field: string, value: string) => {
      try {
        const constraints: any[] = [where(field, "==", value)];
        if (!isAdmin) constraints.push(where("userId", "==", user.uid));
        constraints.push(flimit(20));
        const snap = await getDocs(query(collection(db, col), ...constraints));
        snap.forEach((d) => found.push({ source, id: d.id, data: d.data() }));
      } catch (e) {
        console.warn(`[attempt-status] ${col}.${field} query failed`, e);
      }
    };

    await Promise.all([
      runQ("topUpHistory", "topUpHistory", "attemptId", id),
      runQ("topUpHistory", "topUpHistory", "transRef", id),
      runQ("wheelClaims", "wheelClaims", "attemptId", id),
      runQ("walletLedger", "walletLedger", "meta.attemptId", id),
      runQ("walletLedger", "walletLedger", "refId", id),
    ]);

    const seen = new Set<string>();
    const dedup = found.filter((r) => {
      const k = `${r.source}:${r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    setResults(dedup);
    setLoading(false);
  };

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => toast.success("คัดลอกแล้ว"));
  };

  return (
    <div className={`min-h-screen ${maxWidthClass} mx-auto px-4 sm:px-6 py-6 sm:py-10`}>
      <PageBreadcrumb title="ตรวจสอบสถานะคำสั่ง" icon={Search} items={[{ label: "ตรวจสอบสถานะ" }]} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" /> ตรวจสอบสถานะคำสั่ง
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ใส่ <code className="px-1 rounded bg-muted/40">attemptId</code> หรือ <code className="px-1 rounded bg-muted/40">transRef</code> เพื่อตรวจสอบว่าออเดอร์เติมเงิน / สปินวงล้อ ถูกประมวลผลและเข้าระบบเรียบร้อยหรือยัง
          {!isAdmin && <span className="block mt-1 text-xs">* ผู้ใช้ทั่วไปจะเห็นเฉพาะรายการของตนเองเท่านั้น</span>}
        </p>
      </motion.div>

      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur p-4 mb-6">
        <form
          onSubmit={(e) => { e.preventDefault(); search(); }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="เช่น att_xxxxxxxxxx หรือ TRANSREFxxxx"
            className="flex-1 px-3 py-2 rounded-lg bg-background/60 border border-border focus:border-primary outline-none text-sm font-mono"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2 text-sm font-medium"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ตรวจสอบ
          </button>
        </form>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> กำลังค้นหา...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-300 mx-auto mb-2" />
          <p className="font-medium">ไม่พบรายการที่ตรงกับรหัสนี้</p>
          <p className="text-xs text-muted-foreground mt-1">
            หากเพิ่งทำรายการ กรุณารอสักครู่แล้วลองใหม่ หรือ
            {isAdmin
              ? <Link to="/admin/reconcile" className="text-primary underline ml-1">ไปที่หน้า Reconcile</Link>
              : <Link to="/profile" className="text-primary underline ml-1">ติดต่อแอดมินจากหน้าโปรไฟล์</Link>}
          </p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">พบ {results.length} รายการ</p>
          {results.map((r) => {
            const meta = sourceMeta[r.source];
            const Icon = meta.Icon;
            const d = r.data || {};
            return (
              <motion.div
                key={`${r.source}:${r.id}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/60 bg-card/40 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" /> {meta.label}
                  </span>
                  {statusBadge(d.status || (r.source === "wheelClaims" ? "success" : (d.amount > 0 || d.amount < 0 ? "success" : undefined)))}
                  {d.needsManualReview && (
                    <span className="text-xs px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">รอตรวจสอบโดยแอดมิน</span>
                  )}
                  {d.reviewStatus && d.reviewStatus !== "pending" && (
                    <span className="text-xs px-2 py-0.5 rounded-md border border-border text-muted-foreground">
                      {d.reviewStatus === "approved" ? "แอดมินอนุมัติแล้ว" : "แอดมินปฏิเสธ"}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{fmt(d.createdAt || d.claimedAt || d.at)}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {(d.attemptId || d.meta?.attemptId) && (
                    <Field label="Attempt ID" mono onCopy={copy} value={d.attemptId || d.meta?.attemptId} />
                  )}
                  {d.transRef && <Field label="Trans Ref" mono onCopy={copy} value={d.transRef} />}
                  {d.method && <Field label="ช่องทาง" value={d.method} />}
                  {typeof d.amount === "number" && <Field label="จำนวน" value={`฿${Number(d.amount).toLocaleString()}`} />}
                  {typeof d.creditAmount === "number" && d.creditAmount !== d.amount && (
                    <Field label="เครดิตที่เข้า" value={`฿${Number(d.creditAmount).toLocaleString()}`} />
                  )}
                  {typeof d.balanceBefore === "number" && <Field label="ยอดก่อน" value={`฿${Number(d.balanceBefore).toLocaleString()}`} />}
                  {typeof d.balanceAfter === "number" && <Field label="ยอดหลัง" value={`฿${Number(d.balanceAfter).toLocaleString()}`} />}
                  {d.prizeLabel && <Field label="รางวัล" value={d.prizeLabel} />}
                  {d.wheelName && <Field label="วงล้อ" value={d.wheelName} />}
                  {typeof d.cost === "number" && <Field label="ค่าสปิน" value={`฿${Number(d.cost).toLocaleString()}`} />}
                  {d.productKey && <Field label="คีย์ที่ได้" mono onCopy={copy} value={d.productKey} />}
                  {isAdmin && d.userEmail && <Field label="ผู้ใช้" value={`${d.userName || ""} (${d.userEmail})`} />}
                  {(d.errorMessage || d.error) && (
                    <Field label="ข้อความผิดพลาด" value={d.errorMessage || d.error} className="text-rose-300" />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, mono, onCopy, className }: { label: string; value: string; mono?: boolean; onCopy?: (v: string) => void; className?: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className={`flex items-center gap-2 ${mono ? "font-mono text-xs" : ""} ${className || ""}`}>
      <span className="break-all">{value}</span>
      {onCopy && (
        <button type="button" onClick={() => onCopy(value)} className="text-muted-foreground hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      )}
    </span>
  </div>
);

export default AttemptStatusPage;
