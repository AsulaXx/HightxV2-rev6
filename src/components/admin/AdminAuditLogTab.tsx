import { useState, useEffect, useMemo } from "react";
import { FileDown, Filter } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csvExport";

const AdminAuditLogTab = ({ form }: AdminTabProps) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [limitCount, setLimitCount] = useState(200);

  useEffect(() => {
    setAuditLoading(true);
    getDocs(query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), firestoreLimit(limitCount)))
      .then(snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setAuditLoading(false));
  }, [limitCount]);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l: any) => l.action && set.add(l.action));
    return Array.from(set).sort();
  }, [auditLogs]);

  const filtered = useMemo(() => {
    const fromMs = fromDate ? new Date(fromDate).getTime() : 0;
    const toMs = toDate ? new Date(toDate).getTime() + 86400000 : Infinity;
    const s = auditSearch.toLowerCase();
    return auditLogs.filter((l: any) => {
      if (actionFilter && l.action !== actionFilter) return false;
      const ts = l.timestamp?.toDate ? l.timestamp.toDate().getTime() : (l.timestamp?.seconds ? l.timestamp.seconds * 1000 : 0);
      if (ts && (ts < fromMs || ts > toMs)) return false;
      if (s) {
        return (l.action || "").toLowerCase().includes(s)
          || (l.userName || "").toLowerCase().includes(s)
          || (l.userEmail || "").toLowerCase().includes(s)
          || (l.details || "").toLowerCase().includes(s)
          || (l.ip || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [auditLogs, auditSearch, actionFilter, fromDate, toDate]);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const clearFilters = () => { setAuditSearch(""); setActionFilter(""); setFromDate(""); setToDate(""); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">ประวัติกิจกรรมของผู้ใช้และแอดมินทั้งหมด (IP + User-Agent)</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={limitCount} onChange={(e) => setLimitCount(Number(e.target.value))} className="input-glass px-2 py-2 text-xs">
            {[100, 200, 500, 1000].map(n => <option key={n} value={n}>{n} แถว</option>)}
          </select>
          <button onClick={() => {
            downloadCSV(filtered.map((l: any) => ({
              วันที่: formatDate(l.timestamp),
              ผู้ใช้: l.userName || l.userEmail || "-",
              การกระทำ: l.action || "-",
              IP: l.ip || "-",
              รายละเอียด: l.details || "-",
            })), "audit_log");
            toast.success("ดาวน์โหลด Audit Log สำเร็จ");
          }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1" disabled={!filtered.length}>
            <FileDown size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Filter size={12} /> ตัวกรอง
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="🔍 ค้นหา..."
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">ทุกประเภท action</option>
            {actionOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            title="จากวันที่"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
            title="ถึงวันที่"
          />
        </div>
        {(auditSearch || actionFilter || fromDate || toDate) && (
          <button onClick={clearFilters} className="text-[10px] text-primary hover:underline">
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>

      {auditLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">ไม่มีข้อมูล</div>
      ) : (
        <div className="rounded-xl border border-border/30 bg-[#0a0e14] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 text-[10px] font-mono text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-500/70" />
            <span className="w-2 h-2 rounded-full bg-amber-500/70" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
            <span className="ml-2">audit.log — {filtered.length} / {auditLogs.length} entries</span>
          </div>
          <pre className="max-h-[70vh] overflow-auto px-4 py-3 m-0 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">
{filtered.map((l: any) => {
  const t = formatDate(l.timestamp);
  const user = l.userName || l.userEmail || "system";
  const action = (l.action || "unknown").padEnd(18, " ");
  const ip = l.ip ? ` @${l.ip}` : "";
  return (
    <div key={l.id} className="hover:bg-white/5 px-1 -mx-1 rounded">
      <span className="text-slate-500">[{t}]</span>{" "}
      <span className="text-amber-400 font-bold">{action}</span>{" "}
      <span className="text-cyan-400">{user}</span>
      <span className="text-slate-600">{ip}</span>
      {l.details && <span className="text-slate-400"> — {l.details}</span>}
    </div>
  );
})}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogTab;
