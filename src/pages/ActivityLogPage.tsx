import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth, ROLE_LABELS, type UserRole } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { ScrollText, RefreshCw, Search, Trash2, Key, PlusCircle, Trash, Crown, Settings, UserPlus, LogIn, Megaphone, ClipboardList, Globe, ExternalLink } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as fbLimit, writeBatch, doc } from "firebase/firestore";
import { useCollapsible } from "@/hooks/useCollapsible";
import CollapsibleSection from "@/components/CollapsibleSection";
import { lookupIpGeo, getCachedIpGeo, formatGeoLabel, type IpGeo } from "@/lib/ipGeo";

const maskIp = (ip: string): string => {
  if (!ip || ip === "Unknown") return ip;
  // IPv4: x.x.x.123
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) return `xxx.xxx.xxx.${v4[4]}`;
  // IPv6 or other: keep last 4 chars
  return `xxxx:${ip.slice(-4)}`;
};

const IpGeoTag = ({ ip, masked }: { ip: string; masked: boolean }) => {
  const [geo, setGeo] = useState<IpGeo | null>(() => getCachedIpGeo(ip));
  useEffect(() => {
    let cancelled = false;
    if (!geo) lookupIpGeo(ip).then(g => { if (!cancelled && g) setGeo(g); });
    return () => { cancelled = true; };
  }, [ip]);
  const display = masked ? maskIp(ip) : ip;
  // For masked viewers, don't link out (no PII leak), just show geo tag
  const Tag: any = masked ? "span" : "a";
  const linkProps = masked ? {} : { href: `https://ipinfo.io/${ip}`, target: "_blank", rel: "noopener noreferrer" };
  return (
    <Tag
      {...linkProps}
      title={geo ? `${formatGeoLabel(geo)}${masked ? "" : " — คลิกเพื่อดูบน ipinfo.io"}` : (masked ? "IP ถูกซ่อน (สิทธิ์ไม่พอ)" : "ดูตำแหน่ง IP บน ipinfo.io")}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono transition-colors max-w-full ${masked ? "bg-muted/30 text-muted-foreground" : "bg-primary/10 hover:bg-primary/20 text-primary"}`}
    >
      <Globe size={10} className="shrink-0" />
      <span className="truncate">{display}</span>
      {geo && (
        <span className="font-sans not-italic text-foreground/80 truncate">
          · {geo.flag} {[geo.city, geo.country].filter(Boolean).join(", ") || geo.countryName}
        </span>
      )}
      {!masked && <ExternalLink size={9} className="opacity-60 shrink-0" />}
    </Tag>
  );
};

// Action keys considered "admin actions" for the admin-only filter
const ADMIN_ACTIONS = new Set([
  "key_add", "key_delete", "key_import",
  "role_change", "settings_update",
  "announcement_create",
  "user_ban", "user_unban", "credit_edit",
]);

interface ActivityLog {
  id: string;
  action: string;
  userId: string;
  userEmail: string;
  userName: string;
  details: string;
  ip?: string;
  userAgent?: string;
  timestamp: any;
}

const ACTION_ICONS: Record<string, any> = {
  key_claim: Key,
  key_add: PlusCircle,
  key_delete: Trash,
  role_change: Crown,
  settings_update: Settings,
  user_register: UserPlus,
  user_login: LogIn,
  announcement_create: Megaphone,
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  key_claim: { label: "กดคีย์", color: "text-emerald-400" },
  key_add: { label: "เพิ่มคีย์", color: "text-blue-400" },
  key_delete: { label: "ลบคีย์", color: "text-destructive" },
  role_change: { label: "เปลี่ยนยศ", color: "text-yellow-400" },
  settings_update: { label: "อัปเดตตั้งค่า", color: "text-purple-400" },
  user_register: { label: "สมัครสมาชิก", color: "text-cyan-400" },
  user_login: { label: "เข้าสู่ระบบ", color: "text-muted-foreground" },
  announcement_create: { label: "สร้างประกาศ", color: "text-orange-400" },
};

const ActivityLogPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterScope, setFilterScope] = useState<"all" | "admin" | "foreign">("all");
  const [showFilters, toggleFilters] = useCollapsible("actlog-filters", true);
  // Only Admin+ (admin/owner) sees full IP. Moderators see masked IP for PDPA.
  const canSeeFullIp = hasPermission("admin");

  useEffect(() => {
    if (user && hasPermission("moderator")) loadLogs();
  }, [user]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), fbLimit(500));
      const snapshot = await getDocs(q);
      setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog)));
    } catch (err) {
      console.error("Failed to load activity logs:", err);
    }
    setLoading(false);
  };

  const trimLogs = async () => {
    if (!confirm("ลบบันทึกเก่า เหลือแค่ 10 รายการล่าสุด?")) return;
    try {
      const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const docsToDelete = snapshot.docs.slice(10);
      if (docsToDelete.length === 0) { return; }
      const batch = writeBatch(db);
      docsToDelete.forEach((d) => batch.delete(doc(db, "activityLogs", d.id)));
      await batch.commit();
      await loadLogs();
    } catch (err) { console.error("Failed to trim logs:", err); }
  };

  const deleteAllLogs = async () => {
    if (!confirm("ลบบันทึกกิจกรรมทั้งหมด?")) return;
    try {
      const snapshot = await getDocs(collection(db, "activityLogs"));
      if (snapshot.empty) return;
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(doc(db, "activityLogs", d.id)));
      await batch.commit();
      setLogs([]);
    } catch (err) { console.error("Failed to delete all logs:", err); }
  };

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!hasPermission("moderator")) return <Navigate to="/" replace />;

  const filteredLogs = logs.filter((log) => {
    if (filterAction !== "all" && log.action !== filterAction) return false;
    if (filterScope === "admin" && !ADMIN_ACTIONS.has(log.action)) return false;
    if (filterScope === "foreign") {
      if (!log.ip) return false;
      const geo = getCachedIpGeo(log.ip);
      // Treat unknown geo as not-foreign to avoid false positives; require an explicit non-TH country
      if (!geo || !geo.country || geo.country === "TH") return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        log.userEmail?.toLowerCase().includes(q) ||
        log.userName?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q) ||
        log.ip?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatTimestamp = (ts: any) => {
    if (!ts) return "ไม่ทราบ";
    const date = ts.toDate?.() || new Date(ts);
    return date.toLocaleString("th-TH");
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "เครื่องมือจัดการ", path: "/hub" }, { label: "บันทึกกิจกรรม" }]}
        title="บันทึกกิจกรรม"
        subtitle="ดูประวัติการใช้งานระบบ"
        icon={ScrollText}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-end gap-2 mb-6">
          <button onClick={deleteAllLogs} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 size={16} /> ลบทั้งหมด
          </button>
          <button onClick={trimLogs} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 size={16} /> เหลือ 10 ล่าสุด
          </button>
          <button onClick={loadLogs} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2">
            <RefreshCw size={16} /> รีเฟรช
          </button>
        </div>

        {/* Filters - collapsible */}
        <div className="mb-6">
          <CollapsibleSection title="🔍 ค้นหาและตัวกรอง" isOpen={showFilters} onToggle={toggleFilters} glass>
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-glass w-full pl-11 pr-5 py-3 text-sm"
                  placeholder="ค้นหา (ชื่อ, อีเมล, รายละเอียด)..."
                />
              </div>
              <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-glass px-3 py-3 text-sm">
                <option value="all">ทุกกิจกรรม</option>
                {Object.entries(ACTION_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select value={filterScope} onChange={(e) => setFilterScope(e.target.value as any)} className="input-glass px-3 py-3 text-sm" title="ตัวกรองพิเศษ">
                <option value="all">ทุกขอบเขต</option>
                <option value="admin">เฉพาะ Admin actions</option>
                <option value="foreign">เฉพาะ IP ต่างประเทศ</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              แสดง {filteredLogs.length} จาก {logs.length} รายการ
              {!canSeeFullIp && <span className="ml-2 text-amber-500/80">· IP ถูกซ่อนสำหรับสิทธิ์ Moderator</span>}
            </p>
          </CollapsibleSection>
        </div>

        {/* Logs */}
        {loading ? (
          <div className="glass-card text-center py-16"><p className="text-muted-foreground">กำลังโหลด...</p></div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass-card text-center py-16">
            <ScrollText size={48} className="mx-auto mb-4 opacity-40 text-muted-foreground" />
            <p className="text-muted-foreground">ยังไม่มีบันทึกกิจกรรม</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/30 bg-[#0a0e14] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 text-[10px] font-mono text-slate-500">
              <span className="w-2 h-2 rounded-full bg-red-500/70" />
              <span className="w-2 h-2 rounded-full bg-amber-500/70" />
              <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
              <span className="ml-2">activity.log — {filteredLogs.length} entries</span>
            </div>
            <div className="max-h-[75vh] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {filteredLogs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "text-slate-400" };
                const user = log.userName || log.userEmail || "system";
                const action = (log.action || "unknown").padEnd(16, " ");
                return (
                  <div key={log.id} className="hover:bg-white/5 px-1 -mx-1 rounded flex flex-wrap items-baseline gap-x-2 whitespace-pre-wrap break-words">
                    <span className="text-slate-500">[{formatTimestamp(log.timestamp)}]</span>
                    <span className={`font-bold ${actionInfo.color}`}>{action}</span>
                    <span className="text-cyan-400">{user}</span>
                    {log.ip && log.ip !== "Unknown" && <IpGeoTag ip={log.ip} masked={!canSeeFullIp} />}
                    {log.details && <span className="text-slate-400">— {log.details}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ActivityLogPage;
