import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { CircleDot, Search, Filter, ArrowLeft, RefreshCw, Download, Copy, Key, Trophy, Coins } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as fLimit } from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface WheelClaim {
  id: string;
  wheelId?: string;
  wheelName?: string;
  prizeId?: string;
  prizeLabel?: string;
  productId?: string;
  productName?: string;
  durationLabel?: string;
  key?: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  costCredit?: number;
  attemptId?: string;
  claimedAt?: any;
}

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

const fmt = (v: any) => {
  const d = toDateSafe(v);
  return d ? d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
};

const AllWheelHistoryPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const [rows, setRows] = useState<WheelClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterWheel, setFilterWheel] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "wheelClaims"), orderBy("claimedAt", "desc"), fLimit(2000)));
      setRows(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error("Failed to load wheelClaims:", e);
      toast.error("โหลดไม่สำเร็จ");
    }
    setLoading(false);
  };

  useEffect(() => { if (user && hasPermission("admin")) load(); }, [user]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user) return <RedirectToLogin />;
  if (!hasPermission("admin")) return <Navigate to="/" replace />;

  const wheelOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => { if (r.wheelId) m.set(r.wheelId, r.wheelName || r.wheelId); });
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(r => {
      if (filterWheel !== "all" && r.wheelId !== filterWheel) return false;
      if (from || to) {
        const t = toDateSafe(r.claimedAt)?.getTime() ?? 0;
        if (from && t < from) return false;
        if (to && t > to) return false;
      }
      if (q) {
        const blob = `${r.userEmail || ""} ${r.userName || ""} ${r.userId || ""} ${r.prizeLabel || ""} ${r.productName || ""} ${r.key || ""} ${r.attemptId || ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterWheel, dateFrom, dateTo, searchQuery]);

  const totalRev = filtered.reduce((s, r) => s + (r.costCredit || 0), 0);
  const uniqueUsers = new Set(filtered.map(r => r.userId).filter(Boolean)).size;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportXLSX = () => {
    if (filtered.length === 0) { toast.error("ไม่มีข้อมูล"); return; }
    const data = filtered.map(r => ({
      วันที่: fmt(r.claimedAt),
      วงล้อ: r.wheelName || r.wheelId || "",
      รางวัล: r.prizeLabel || "",
      สินค้า: r.productName || "",
      ระยะเวลา: r.durationLabel || "",
      คีย์: r.key || "",
      ผู้ใช้: r.userName || r.userEmail || r.userId || "",
      Email: r.userEmail || "",
      UID: r.userId || "",
      ค่าหมุน: r.costCredit || 0,
      AttemptId: r.attemptId || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WheelClaims");
    XLSX.writeFile(wb, `wheel-history_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const copy = (s?: string) => { if (!s) return; navigator.clipboard?.writeText(s); toast.success("คัดลอกแล้ว"); };

  return (
    <div className="relative z-10 max-w-[1720px] mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "เครื่องมือจัดการ", path: "/hub" }, { label: "ประวัติวงล้อทั้งหมด" }]}
        title="ประวัติวงล้อทั้งหมด"
        subtitle="ดูประวัติการหมุนของผู้ใช้ทุกคน รวมถึงรางวัลและคีย์ที่จ่ายออกไป"
        icon={CircleDot}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
          <button onClick={exportXLSX} className="btn-glass px-4 py-2 text-sm flex items-center gap-2"><Download size={14} /> Export Excel</button>
          <button onClick={load} className="btn-glass px-4 py-2 text-sm flex items-center gap-2"><RefreshCw size={14} /> รีเฟรช</button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="glass-card text-center !p-3"><CircleDot className="text-violet-400 mx-auto mb-1" size={20} /><div className="text-xl font-extrabold">{filtered.length}</div><div className="text-[10px] uppercase text-muted-foreground">รายการ</div></div>
          <div className="glass-card text-center !p-3"><Coins className="text-amber-400 mx-auto mb-1" size={20} /><div className="text-xl font-extrabold text-amber-300">{totalRev.toLocaleString()}</div><div className="text-[10px] uppercase text-muted-foreground">รายได้รวม (เครดิต)</div></div>
          <div className="glass-card text-center !p-3"><Trophy className="text-emerald-400 mx-auto mb-1" size={20} /><div className="text-xl font-extrabold">{uniqueUsers}</div><div className="text-[10px] uppercase text-muted-foreground">ผู้ใช้ไม่ซ้ำ</div></div>
        </div>

        <div className="glass-card !p-3 mb-4">
          <div className="grid md:grid-cols-4 gap-2">
            <div className="md:col-span-2 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหา ผู้ใช้/อีเมล/รางวัล/คีย์/attemptId" className="input-glass w-full pl-9 pr-3 py-2 text-sm" />
            </div>
            <select value={filterWheel} onChange={e => { setFilterWheel(e.target.value); setCurrentPage(1); }} className="input-glass px-3 py-2 text-sm">
              <option value="all">ทุกวงล้อ</option>
              {wheelOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} className="input-glass px-2 py-2 text-xs flex-1" />
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} className="input-glass px-2 py-2 text-xs flex-1" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="glass-card text-center py-12"><p className="text-muted-foreground">กำลังโหลด...</p></div>
        ) : filtered.length === 0 ? (
          <div className="glass-card text-center py-12"><CircleDot size={42} className="mx-auto mb-3 opacity-40 text-muted-foreground" /><p className="text-muted-foreground">ไม่มีข้อมูล</p></div>
        ) : (
          <div className="glass-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 border-b border-border/40">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5">วันที่</th>
                    <th className="px-3 py-2.5">ผู้ใช้</th>
                    <th className="px-3 py-2.5">วงล้อ</th>
                    <th className="px-3 py-2.5">รางวัล</th>
                    <th className="px-3 py-2.5">คีย์</th>
                    <th className="px-3 py-2.5 text-right">ค่าหมุน</th>
                    <th className="px-3 py-2.5">Attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r, i) => (
                    <tr key={r.id} className={`border-b border-border/30 last:border-0 ${i % 2 === 0 ? "bg-background/20" : ""} hover:bg-primary/5`}>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{fmt(r.claimedAt)}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-semibold text-foreground">{r.userName || "-"}</div>
                        <div className="text-[10px] text-muted-foreground">{r.userEmail || r.userId || "-"}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.wheelName || r.wheelId || "-"}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="font-semibold text-foreground">{r.prizeLabel}</div>
                        {r.productName && <div className="text-[10px] text-emerald-300">{r.productName}{r.durationLabel ? ` · ${r.durationLabel}` : ""}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.key ? (
                          <div className="flex items-center gap-1">
                            <Key size={10} className="text-amber-400 shrink-0" />
                            <code className="font-mono text-[11px] bg-background/60 px-1.5 py-0.5 rounded max-w-[180px] truncate">{r.key}</code>
                            <button onClick={() => copy(r.key)} className="p-0.5 text-muted-foreground hover:text-primary"><Copy size={10} /></button>
                          </div>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-right font-bold">{r.costCredit ? <span className="text-rose-300">-{r.costCredit}</span> : <span className="text-emerald-300">ฟรี</span>}</td>
                      <td className="px-3 py-2 text-[10px] text-muted-foreground">
                        {r.attemptId ? (
                          <Link to={`/attempt-status?id=${r.attemptId}`} className="text-sky-300 hover:underline font-mono">{r.attemptId.slice(0, 8)}...</Link>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 p-3 border-t border-border/40 text-xs">
              <div className="text-muted-foreground">แสดง {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} จาก {filtered.length}</div>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setCurrentPage(1); }} className="input-glass px-2 py-1 text-xs">
                  {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}/หน้า</option>)}
                </select>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-glass px-2 py-1 disabled:opacity-40">‹</button>
                <span>{page} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-glass px-2 py-1 disabled:opacity-40">›</button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AllWheelHistoryPage;
