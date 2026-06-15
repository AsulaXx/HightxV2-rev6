import { useState, useEffect } from "react";
import { FileDown } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/csvExport";

const AdminAuditLogTab = ({ form }: AdminTabProps) => {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

  useEffect(() => {
    setAuditLoading(true);
    getDocs(query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), firestoreLimit(200)))
      .then(snap => setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setAuditLoading(false));
  }, []);

  const filtered = auditLogs.filter((l: any) => {
    if (!auditSearch) return true;
    const s = auditSearch.toLowerCase();
    return (l.action || "").toLowerCase().includes(s) || (l.userName || "").toLowerCase().includes(s) || (l.userEmail || "").toLowerCase().includes(s) || (l.details || "").toLowerCase().includes(s);
  });

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const actionColors: Record<string, string> = {
    login: "bg-blue-500/20 text-blue-400",
    signup: "bg-emerald-500/20 text-emerald-400",
    claim_key: "bg-purple-500/20 text-purple-400",
    topup: "bg-green-500/20 text-green-400",
    purchase: "bg-amber-500/20 text-amber-400",
    ban: "bg-red-500/20 text-red-400",
    unban: "bg-teal-500/20 text-teal-400",
    settings: "bg-indigo-500/20 text-indigo-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">ประวัติกิจกรรมของผู้ใช้และแอดมินทั้งหมด</p>
        </div>
        <button onClick={() => {
          downloadCSV(filtered.map((l: any) => ({ วันที่: formatDate(l.timestamp), ผู้ใช้: l.userName || l.userEmail || "-", การกระทำ: l.action || "-", รายละเอียด: l.details || "-" })), "audit_log");
          toast.success("ดาวน์โหลด Audit Log สำเร็จ");
        }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1" disabled={!filtered.length}>
          <FileDown size={14} /> Export CSV
        </button>
      </div>

      <div className="glass-card p-4">
        <input type="text" placeholder="🔍 ค้นหา action, ชื่อ, อีเมล, รายละเอียด..." className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
      </div>

      {auditLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">ไม่มีข้อมูล</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((l: any) => {
            const color = actionColors[l.action] || "bg-muted/20 text-muted-foreground";
            return (
              <div key={l.id} className="glass-card !p-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{l.action}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground">{l.details || "-"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{l.userName || l.userEmail || "ไม่ระบุ"}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{formatDate(l.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogTab;
