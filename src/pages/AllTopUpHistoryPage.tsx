import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { Link } from "react-router-dom";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { History, Search, Filter, Download, CheckCircle, XCircle, AlertTriangle, RefreshCw, CreditCard, Smartphone, Gift, Banknote } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from "firebase/firestore";
import * as XLSX from "xlsx";

interface TopUpRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  transRef: string;
  status: "success" | "failed" | "duplicate";
  method?: string;
  error?: string;
  errorMessage?: string;
  needsManualReview?: boolean;
  voucherUrl?: string;
  createdAt: any;
  slipData?: any;
}

const AllTopUpHistoryPage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();

  const [records, setRecords] = useState<TopUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "duplicate">("all");
  const [methodFilter, setMethodFilter] = useState<"all" | "bank" | "truewallet" | "voucher" | "giftcode">("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [displayLimit, setDisplayLimit] = useState(25);

  const isAllowed = hasPermission("hightxcrew");

  useEffect(() => {
    if (!isAllowed) return;
    loadRecords();
  }, [isAllowed]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "topUpHistory"), firestoreLimit(500));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TopUpRecord));
      data.sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() || 0;
        const tb = b.createdAt?.toDate?.()?.getTime() || 0;
        return tb - ta;
      });
      setRecords(data);
    } catch (err) {
      console.error("Failed to load top-up history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user || !profile) return <RedirectToLogin />;
  if (!isAllowed) return <Navigate to="/hub" replace />;

  const filtered = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (methodFilter !== "all" && (r.method || "bank") !== methodFilter) return false;
    if (reviewOnly && !r.needsManualReview) return false;
    const ts = r.createdAt?.toDate?.()?.getTime() || 0;
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      if (ts < fromTs) return false;
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      if (ts > toTs) return false;
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        (r.userName || "").toLowerCase().includes(s) ||
        (r.userEmail || "").toLowerCase().includes(s) ||
        (r.transRef || "").toLowerCase().includes(s) ||
        (r.error || "").toLowerCase().includes(s) ||
        (r.errorMessage || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalSuccess = filtered.filter((r) => r.status === "success").reduce((s, r) => s + (r.amount || 0), 0);

  const getMethodIcon = (method?: string) => {
    switch (method) {
      case "truewallet": return <Smartphone size={14} className="text-orange-400" />;
      case "voucher": return <Gift size={14} className="text-pink-400" />;
      case "giftcode": return <Gift size={14} className="text-purple-400" />;
      default: return <Banknote size={14} className="text-emerald-400" />;
    }
  };

  const getMethodLabel = (method?: string) => {
    switch (method) {
      case "truewallet": return "TrueWallet";
      case "voucher": return "ซองอั่งเปา";
      case "giftcode": return "Gift Code";
      default: return "สลิปธนาคาร";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"><CheckCircle size={10} /> สำเร็จ</span>;
      case "duplicate":
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400"><AlertTriangle size={10} /> ซ้ำ</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive"><XCircle size={10} /> ล้มเหลว</span>;
    }
  };

  const buildExportRows = () => filtered.map((r) => ({
    "วันที่": r.createdAt?.toDate?.()?.toLocaleString("th-TH") || "-",
    "ผู้ใช้": r.userName || r.userEmail || "-",
    "อีเมล": r.userEmail || "-",
    "จำนวน (฿)": r.amount || 0,
    "Ref": r.transRef || "-",
    "ช่องทาง": getMethodLabel(r.method),
    "สถานะ": r.status === "success" ? "สำเร็จ" : r.status === "duplicate" ? "ซ้ำ" : "ล้มเหลว",
    "ต้องตรวจสอบ": r.needsManualReview ? "Yes" : "",
    "หมายเหตุ": r.error || r.errorMessage || "",
    "Voucher URL": r.voucherUrl || "",
  }));

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TopUp History");
    XLSX.writeFile(wb, `topup-history-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportCSV = () => {
    const rows = buildExportRows();
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape((r as any)[h])).join(","))].join("\n");
    // BOM for Excel UTF-8 compatibility
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `topup-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${maxWidthClass} mx-auto px-3 sm:px-4 py-6 sm:py-8`}>
      <PageBreadcrumb title="ประวัติเติมเงินทั้งหมด" items={[{ label: "Hub", path: "/hub" }, { label: "ประวัติเติมเงินทั้งหมด" }]} />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <History className="text-primary" size={22} /> ประวัติเติมเงินทั้งหมด
            </h1>
            <p className="text-xs text-muted-foreground mt-1">ดูรายการเติมเงินของผู้ใช้ทุกคนในระบบ</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={loadRecords} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
              <RefreshCw size={13} /> รีเฟรช
            </button>
            <button onClick={exportExcel} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
              <Download size={13} /> Excel
            </button>
            <button onClick={exportCSV} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
              <Download size={13} /> CSV
            </button>
            <Link to="/admin/reconcile" className="bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">
              <AlertTriangle size={13} /> Reconcile
            </Link>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "รายการทั้งหมด", value: filtered.length, color: "text-foreground" },
            { label: "สำเร็จ", value: filtered.filter((r) => r.status === "success").length, color: "text-emerald-400" },
            { label: "ซ้ำ", value: filtered.filter((r) => r.status === "duplicate").length, color: "text-yellow-400" },
            { label: "ล้มเหลว", value: filtered.filter((r) => r.status === "failed").length, color: "text-destructive" },
            { label: "ยอดรวม (สำเร็จ)", value: `฿${totalSuccess.toLocaleString()}`, color: "text-primary" },
          ].map((s) => (
            <div key={s.label} className="glass-card !p-4 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ, อีเมล, Ref..."
              className="input-glass w-full pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input-glass px-3 py-2.5 text-sm"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="success">สำเร็จ</option>
            <option value="duplicate">ซ้ำ</option>
            <option value="failed">ล้มเหลว</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="input-glass px-3 py-2.5 text-sm"
          >
            <option value="all">ทุกช่องทาง</option>
            <option value="bank">สลิปธนาคาร</option>
            <option value="truewallet">TrueWallet</option>
            <option value="voucher">ซองอั่งเปา</option>
            <option value="giftcode">Gift Code</option>
          </select>
        </div>

        {/* Date range + extras */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">ตั้งแต่:</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-glass px-2 py-1.5 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">ถึง:</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-glass px-2 py-1.5 text-xs" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="btn-glass px-2 py-1.5 text-xs">ล้างวันที่</button>
          )}
          <label className="flex items-center gap-1.5 text-xs text-yellow-400 cursor-pointer">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
            <AlertTriangle size={12} /> ต้องตรวจสอบเท่านั้น
          </label>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label className="text-xs text-muted-foreground">แสดง:</label>
            <select value={displayLimit} onChange={(e) => setDisplayLimit(Number(e.target.value))} className="input-glass px-2 py-1.5 text-xs w-24">
              {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
              <option value={999999}>ทั้งหมด</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass-card !p-8 text-center">
            <RefreshCw size={20} className="animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card !p-8 text-center">
            <p className="text-sm text-muted-foreground">ไม่พบรายการ</p>
          </div>
        ) : (
          <div className="glass-card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left p-3 text-muted-foreground font-medium">วันที่</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">ผู้ใช้</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">ช่องทาง</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">จำนวน</th>
                    <th className="text-left p-3 text-muted-foreground font-medium">Ref</th>
                    <th className="text-center p-3 text-muted-foreground font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, displayLimit).map((r) => {
                    const date = r.createdAt?.toDate?.();
                    return (
                      <tr key={r.id} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {date ? date.toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) : "-"}
                          <span className="ml-1 opacity-60">{date ? date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-foreground truncate max-w-[140px] flex items-center gap-1">
                            {r.userName || "-"}
                            {r.needsManualReview && <span title="ต้องตรวจสอบด้วยตัวเอง"><AlertTriangle size={11} className="text-yellow-400" /></span>}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{r.userEmail}</p>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1">
                            {getMethodIcon(r.method)}
                            <span className="text-muted-foreground">{getMethodLabel(r.method)}</span>
                          </span>
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          ฿{(r.amount || 0).toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono text-[10px] truncate max-w-[160px]" title={r.error || r.errorMessage || r.transRef}>
                          <div className="truncate">{r.transRef || "-"}</div>
                          {(r.error || r.errorMessage) && (
                            <div className="text-[9px] text-destructive/80 truncate mt-0.5 normal-case font-sans">{r.error || r.errorMessage}</div>
                          )}
                        </td>
                        <td className="p-3 text-center">{getStatusBadge(r.status)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > displayLimit && (
              <p className="text-xs text-center text-muted-foreground p-3">แสดง {Math.min(displayLimit, filtered.length)} จาก {filtered.length} รายการ</p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AllTopUpHistoryPage;
