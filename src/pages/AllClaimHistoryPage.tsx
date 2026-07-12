import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { History, Search, Filter, Copy, ArrowLeft, RefreshCw, Banknote, ShoppingCart, Gift, Download } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as fbLimit } from "firebase/firestore";

const INITIAL_LOAD_LIMIT = 1000;
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ClaimRecord {
  id: string;
  key: string;
  productId: string;
  durationId: string;
  claimedBy: string;
  claimedByEmail: string;
  claimedByName: string;
  claimedAt: any;
  price?: number;
  purchaseType?: string;
}

const AllClaimHistoryPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (user && hasPermission("admin")) loadClaims();
  }, [user]);

  const [hasMore, setHasMore] = useState(false);

  const loadClaims = async () => {
    setLoading(true);
    try {
      // Cap server-side: latest N claims by claimedAt (server-ordered) — avoids loading the
      // entire keys collection on large stores. Falls back to unordered if no index.
      let snapshot;
      try {
        snapshot = await getDocs(query(
          collection(db, "keys"),
          where("claimed", "==", true),
          orderBy("claimedAt", "desc"),
          fbLimit(INITIAL_LOAD_LIMIT),
        ));
      } catch (e) {
        console.warn("[allClaim] orderBy fallback (likely missing index):", e);
        snapshot = await getDocs(query(
          collection(db, "keys"),
          where("claimed", "==", true),
          fbLimit(INITIAL_LOAD_LIMIT),
        ));
      }
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClaimRecord));
      data.sort((a, b) => {
        const ta = (a.claimedAt?.toDate?.()?.getTime?.()) || (a.claimedAt ? new Date(a.claimedAt as any).getTime() : 0) || 0;
        const tb = (b.claimedAt?.toDate?.()?.getTime?.()) || (b.claimedAt ? new Date(b.claimedAt as any).getTime() : 0) || 0;
        return tb - ta;
      });
      setClaims(data);
      setHasMore(data.length >= INITIAL_LOAD_LIMIT);
    } catch (err) {
      console.error("Failed to load all claims:", err);
    }
    setLoading(false);
  };

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!hasPermission("admin")) return <Navigate to="/" replace />;

  const getProductName = (pid: string) => settings.products?.find((p) => p.id === pid)?.name || pid;
  const getDurationLabel = (pid: string, did: string) => {
    const p = settings.products?.find((p) => p.id === pid);
    return p?.durations.find((d) => d.id === did)?.label || did;
  };

  // Robust converter that handles Firestore Timestamp / Date / ISO string / number / locale string
  const toDateSafe = (v: any): Date | null => {
    if (!v) return null;
    try {
      if (typeof v?.toDate === "function") return v.toDate();
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      if (typeof v === "number") return new Date(v);
      if (typeof v === "string") {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return d;
      }
      if (typeof v === "object" && typeof v.seconds === "number") return new Date(v.seconds * 1000);
    } catch {}
    return null;
  };
  const toMillis = (v: any): number => toDateSafe(v)?.getTime() || 0;

  const formatDate = (ts: any) => {
    const d = toDateSafe(ts);
    return d ? d.toLocaleString("th-TH") : "ไม่ทราบ";
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("คัดลอกคีย์สำเร็จ!");
  };

  const filteredClaims = claims.filter((c) => {
    if (filterProduct !== "all" && c.productId !== filterProduct) return false;
    const ts = toMillis(c.claimedAt);
    if (dateFrom) {
      const fromTs = new Date(dateFrom + "T00:00:00").getTime();
      if (!ts || ts < fromTs) return false;
    }
    if (dateTo) {
      const toTs = new Date(dateTo + "T23:59:59").getTime();
      if (!ts || ts > toTs) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.claimedByEmail?.toLowerCase().includes(q) ||
        c.claimedByName?.toLowerCase().includes(q) ||
        c.key?.toLowerCase().includes(q) ||
        getProductName(c.productId).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportExcel = () => {
    const rows = filteredClaims.map((c) => ({
      "วันที่": formatDate(c.claimedAt),
      "ผู้ใช้": c.claimedByName || c.claimedByEmail || "-",
      "อีเมล": c.claimedByEmail || "-",
      "สินค้า": getProductName(c.productId),
      "ระยะเวลา": getDurationLabel(c.productId, c.durationId),
      "คีย์": c.key,
      "ราคา (฿)": c.price || 0,
      "ประเภท": c.purchaseType || (c.price && c.price > 0 ? "ซื้อ" : "ฟรี"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Claims");
    XLSX.writeFile(wb, `claims-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalRevenue = claims.reduce((sum, c) => sum + (c.price || 0), 0);
  const paidClaims = claims.filter(c => c.price && c.price > 0);
  const freeClaims = claims.filter(c => !c.price || c.price === 0);

  return (
    <div className="relative z-10 max-w-[1720px] mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Dashboard", path: "/dashboard" }, { label: "ประวัติการกดคีย์ทั้งหมด" }]}
        title="ประวัติการกดคีย์ทั้งหมด"
        subtitle="ดูประวัติคีย์ของผู้ใช้ทั้งหมด"
        icon={History}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground">คีย์ทั้งหมด</p>
            <p className="text-lg font-bold text-foreground">{claims.length.toLocaleString()}</p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground">รายได้รวม</p>
            <p className="text-lg font-bold text-primary">฿{totalRevenue.toLocaleString()}</p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><ShoppingCart size={10} /> ซื้อ</p>
            <p className="text-lg font-bold text-foreground">{paidClaims.length.toLocaleString()}</p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Gift size={10} /> ฟรี</p>
            <p className="text-lg font-bold text-foreground">{freeClaims.length.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex items-center justify-end mb-6">
          <div className="flex gap-2">
            <button onClick={exportExcel} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2">
              <Download size={16} /> Export Excel
            </button>
            <button onClick={loadClaims} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2">
              <RefreshCw size={16} /> รีเฟรช
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card mb-6">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-glass w-full pl-11 pr-5 py-3 text-sm"
                placeholder="ค้นหา (ชื่อ, อีเมล, คีย์, สินค้า)..."
              />
            </div>
            <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="input-glass px-3 py-3 text-sm">
              <option value="all">ทุกสินค้า</option>
              {(settings.products || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2 items-stretch sm:items-center">
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
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            แสดง {filteredClaims.length} จาก {claims.length} รายการ
            {hasMore && <span className="ml-1 text-amber-400">· (จำกัดที่ {INITIAL_LOAD_LIMIT.toLocaleString()} รายการล่าสุด — ใช้ตัวกรองเพื่อค้นหาที่เก่ากว่า)</span>}
          </p>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3">
            <span className="text-xs text-muted-foreground">แสดง:</span>
            {[10, 20, 50, 100, 250, 500, 0].map((size) => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  pageSize === size
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
                }`}
              >
                {size === 0 ? "ทั้งหมด" : size}
              </button>
            ))}
          </div>
        </div>

        {/* Claims List */}
        {loading ? (
          <div className="glass-card text-center py-16"><p className="text-muted-foreground">กำลังโหลด...</p></div>
        ) : filteredClaims.length === 0 ? (
          <div className="glass-card text-center py-16">
            <History size={48} className="mx-auto mb-4 opacity-40 text-muted-foreground" />
            <p className="text-muted-foreground">ไม่พบประวัติการกดคีย์</p>
          </div>
        ) : (
          <>
          <div className="space-y-2">
            {(() => {
              const effectiveSize = pageSize === 0 ? filteredClaims.length : pageSize;
              const totalPg = Math.max(1, Math.ceil(filteredClaims.length / effectiveSize));
              const safePage = Math.min(currentPage, totalPg);
              const paginated = filteredClaims.slice((safePage - 1) * effectiveSize, safePage * effectiveSize);
              return paginated.map((claim, i) => (
              <motion.div
                key={claim.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.5) }}
                className="glass-card !p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{claim.claimedByName || claim.claimedByEmail || "Unknown"}</span>
                    <span className="badge-primary text-[10px]">{getProductName(claim.productId)}</span>
                    <span className="text-[10px] text-muted-foreground">{getDurationLabel(claim.productId, claim.durationId)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <code className="text-xs font-mono text-emerald-400 truncate max-w-[200px] sm:max-w-none">{claim.key}</code>
                    <button onClick={() => copyKey(claim.key)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      <Copy size={12} />
                    </button>
                    {claim.price !== undefined && claim.price > 0 ? (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-0.5 shrink-0">
                        <Banknote size={9} /> ฿{claim.price.toLocaleString()}
                        {claim.purchaseType === "reseller" && <span className="text-amber-500">(Reseller)</span>}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-medium shrink-0">ฟรี</span>
                    )}
                  </div>
                  {claim.claimedByEmail && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{claim.claimedByEmail}</p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatDate(claim.claimedAt)}</span>
              </motion.div>
              ));
            })()}
          </div>

          {/* Pagination */}
          {(() => {
            const effectiveSize = pageSize === 0 ? filteredClaims.length : pageSize;
            const totalPg = Math.max(1, Math.ceil(filteredClaims.length / effectiveSize));
            const safePage = Math.min(currentPage, totalPg);
            return totalPg > 1 ? (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">ก่อนหน้า</button>
                <span className="text-xs text-muted-foreground">หน้า {safePage} / {totalPg}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPg, p + 1))} disabled={safePage >= totalPg} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">ถัดไป</button>
              </div>
            ) : null;
          })()}
          </>
        )}
      </motion.div>
    </div>
  );
};

export default AllClaimHistoryPage;
