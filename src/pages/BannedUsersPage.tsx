import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Ban, CheckCircle, Search, Shield, RefreshCw, AlertTriangle } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where, orderBy, limit } from "firebase/firestore";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface BannedUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  banned: boolean;
  bannedReason: string;
  bannedAt: string;
}

const BannedUsersPage = () => {
  const { user, profile, hasPermission } = useAuth();
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [unbanning, setUnbanning] = useState<string | null>(null);

  const loadBannedUsers = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("banned", "==", true));
      const snap = await getDocs(q);
      const users = snap.docs.map(d => ({
        id: d.id,
        email: d.data().email || "",
        displayName: d.data().displayName || d.data().email || "",
        role: d.data().role || "user",
        banned: true,
        bannedReason: d.data().bannedReason || "ไม่ระบุเหตุผล",
        bannedAt: d.data().bannedAt || "",
      }));
      setBannedUsers(users);
    } catch (err) {
      console.error("Failed to load banned users:", err);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadBannedUsers();
  }, [user, loadBannedUsers]);

  const handleUnban = async (userId: string, userName: string) => {
    if (!confirm(`ยืนยันปลดแบน "${userName}" ?`)) return;
    setUnbanning(userId);
    try {
      await updateDoc(doc(db, "users", userId), {
        banned: false,
        bannedReason: "",
        bannedAt: "",
        unbannedAt: new Date().toISOString(),
        unbannedBy: user?.email || "",
      });
      await logActivity(user!, profile, "unban", `ปลดแบน: ${userName} (${userId})`);
      toast.success(`ปลดแบน ${userName} สำเร็จ`);
      setBannedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error("Unban failed:", err);
      toast.error("ปลดแบนไม่สำเร็จ");
    } finally {
      setUnbanning(null);
    }
  };

  if (!user) return <RedirectToLogin />;
  if (!hasPermission("admin")) return <Navigate to="/" replace />;

  const filtered = bannedUsers.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.bannedReason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ผู้ถูกแบน" }]}
        title="รายงานผู้ถูกแบน"
        subtitle={`${bannedUsers.length} บัญชีที่ถูกระงับ`}
        icon={Ban}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ อีเมล หรือเหตุผล..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-muted/20 border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>
          <button
            onClick={loadBannedUsers}
            disabled={loading}
            className="btn-glass px-3 py-2.5 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            รีเฟรช
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">ถูกแบนทั้งหมด</p>
            <p className="text-2xl font-bold text-destructive">{bannedUsers.length}</p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">แบนอัตโนมัติ</p>
            <p className="text-2xl font-bold text-foreground">
              {bannedUsers.filter(u => u.bannedReason.includes("อัตโนมัติ")).length}
            </p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-1">แบนด้วยมือ</p>
            <p className="text-2xl font-bold text-foreground">
              {bannedUsers.filter(u => !u.bannedReason.includes("อัตโนมัติ")).length}
            </p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto text-emerald-500/30 mb-3" />
            <p className="text-sm font-semibold text-foreground">ไม่มีผู้ถูกแบน</p>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? "ไม่พบผลลัพธ์ที่ค้นหา" : "ยังไม่มีบัญชีที่ถูกระงับ"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card !p-4 !rounded-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">{u.displayName}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">แบน</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                    <div className="mt-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-foreground">{u.bannedReason}</p>
                      </div>
                    </div>
                    {u.bannedAt && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                        แบนเมื่อ: {new Date(u.bannedAt).toLocaleString("th-TH")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleUnban(u.id, u.displayName)}
                    disabled={unbanning === u.id}
                    className="shrink-0 px-3 py-2 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                  >
                    {unbanning === u.id ? "กำลังปลด..." : "ปลดแบน"}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default BannedUsersPage;
