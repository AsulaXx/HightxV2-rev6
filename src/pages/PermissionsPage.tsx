import { motion } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_HIERARCHY, type UserRole } from "@/contexts/AuthContext";
import { useSiteSettings, DEFAULT_PERMISSIONS_LIST, DEFAULT_ROLE_PERMISSIONS_MAP } from "@/contexts/SiteSettingsContext";
import { Shield, CheckCircle, XCircle, Crown, Info, Award, ClipboardList } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { Link } from "react-router-dom";
import PermIcon from "@/components/PermIcon";

const ROLE_COLORS: Record<string, string> = {
  owner: "from-yellow-500 to-amber-400",
  admin: "from-red-500 to-rose-400",
  moderator: "from-blue-500 to-cyan-400",
  reseller: "from-emerald-500 to-teal-400",
  hightxcrew: "from-orange-500 to-amber-400",
  vip: "from-purple-500 to-violet-400",
  user: "from-slate-500 to-zinc-400",
};

const PermissionsPage = () => {
  const { profile } = useAuth();
  const { settings } = useSiteSettings();

  const permissions = settings.permissions?.length ? settings.permissions : DEFAULT_PERMISSIONS_LIST;
  const rolePermissions = settings.rolePermissions && Object.keys(settings.rolePermissions).length ? settings.rolePermissions : DEFAULT_ROLE_PERMISSIONS_MAP;

  const roles = ROLE_HIERARCHY.slice().reverse(); // user first, owner last

  return (
    <div className="relative z-10 max-w-[1720px] mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "สิทธิ์การใช้งาน" }]}
        title="สิทธิ์การใช้งาน"
        subtitle="ดูสิทธิ์ของแต่ละยศในระบบ"
        icon={Shield}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Current user role badge */}
        {profile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-5 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${ROLE_COLORS[profile.role] || "from-slate-500 to-zinc-400"} flex items-center justify-center`}>
                <Crown size={24} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ยศปัจจุบันของคุณ</p>
                <p className="text-2xl font-bold text-foreground">{ROLE_LABELS[profile.role]}</p>
              </div>
              <div className="ml-auto">
                <span className="text-sm text-muted-foreground">
                  {(rolePermissions[profile.role] || []).length} / {permissions.length} สิทธิ์
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Permission Matrix Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card overflow-x-auto">
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2"><ClipboardList size={20} /> ตารางสิทธิ์ทั้งหมด</h2>
          <div className="min-w-[700px]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-bold text-foreground py-3 px-4 min-w-[200px]">ฟังก์ชัน</th>
                  {roles.map((role) => (
                    <th key={role} className="text-center text-xs font-bold text-foreground py-3 px-2">
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r ${ROLE_COLORS[role] || "from-slate-500 to-zinc-400"} text-white`}>
                        {ROLE_LABELS[role as UserRole]?.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim() || role}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm, i) => (
                  <tr key={perm.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/10" : ""}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <PermIcon name={perm.icon || perm.id} size={14} className="text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{perm.label}</p>
                          <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </div>
                    </td>
                    {roles.map((role) => {
                      const has = rolePermissions[role]?.includes(perm.id);
                      const isCurrentRole = profile?.role === role;
                      return (
                        <td key={role} className={`text-center py-3 px-2 ${isCurrentRole ? "bg-primary/5" : ""}`}>
                          {has ? (
                            <CheckCircle size={18} className="inline text-emerald-400" />
                          ) : (
                            <XCircle size={18} className="inline text-muted-foreground/30" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Role Cards */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <h2 className="text-lg font-bold text-foreground mt-10 mb-6 flex items-center gap-2">
            <Award size={20} /> รายละเอียดแต่ละยศ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ROLE_HIERARCHY.map((role, i) => {
              const perms = rolePermissions[role] || [];
              const isCurrentRole = profile?.role === role;
              return (
                <motion.div
                  key={role}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  className={`glass-card relative ${isCurrentRole ? "ring-2 ring-primary" : ""}`}
                >
                  {isCurrentRole && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ยศของคุณ
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ROLE_COLORS[role] || "from-slate-500 to-zinc-400"} flex items-center justify-center`}>
                      <Shield size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{ROLE_LABELS[role as UserRole]}</p>
                      <p className="text-xs text-muted-foreground">{perms.length} สิทธิ์</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {permissions.map((perm) => {
                      const has = perms.includes(perm.id);
                      return (
                        <div key={perm.id} className={`flex items-center gap-2 text-xs ${has ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
                          {has ? <CheckCircle size={12} className="text-emerald-400 shrink-0" /> : <XCircle size={12} className="shrink-0" />}
                          <PermIcon name={perm.icon || perm.id} size={12} className="shrink-0" />
                          <span>{perm.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Info note */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 p-4 rounded-xl bg-muted/20 border border-border flex items-start gap-2">
          <Info size={16} className="text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">
              สิทธิ์การใช้งานถูกกำหนดโดย Owner ของระบบ หากต้องการเปลี่ยนแปลงยศ กรุณาติดต่อผู้ดูแลระบบ
            </p>
            <Link to="/" className="text-xs text-primary hover:underline mt-1 inline-block">← กลับหน้าหลัก</Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default PermissionsPage;
