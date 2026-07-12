import { useState, useEffect } from "react";
import { Save, Plus, Trash2, RotateCcw, Shield, CheckCircle, XCircle } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import { ROLE_HIERARCHY, ROLE_LABELS, useAuth, type UserRole } from "@/contexts/AuthContext";
import { DEFAULT_PERMISSIONS_LIST, DEFAULT_ROLE_PERMISSIONS_MAP, type PermissionItem, type RolePermissions } from "@/contexts/SiteSettingsContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import PermIcon from "@/components/PermIcon";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const ROLE_COLORS: Record<string, string> = {
  owner: "from-yellow-500 to-amber-400", admin: "from-red-500 to-rose-400",
  moderator: "from-blue-500 to-cyan-400", reseller: "from-emerald-500 to-teal-400",
  hightxcrew: "from-orange-500 to-amber-400",
  vip: "from-purple-500 to-violet-400", user: "from-slate-500 to-zinc-400",
};

const AdminPermissionsTab = ({ form }: AdminTabProps) => {
  const { settings, updateSettings } = useSiteSettings();
  const { user, profile } = useAuth();
  const [editPermissions, setEditPermissions] = useState<PermissionItem[]>(settings.permissions?.length ? settings.permissions : DEFAULT_PERMISSIONS_LIST);
  const [editRolePerms, setEditRolePerms] = useState<RolePermissions>(settings.rolePermissions && Object.keys(settings.rolePermissions).length ? settings.rolePermissions : DEFAULT_ROLE_PERMISSIONS_MAP);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });

  useEffect(() => {
    setEditPermissions(settings.permissions?.length ? settings.permissions : DEFAULT_PERMISSIONS_LIST);
    setEditRolePerms(settings.rolePermissions && Object.keys(settings.rolePermissions).length ? settings.rolePermissions : DEFAULT_ROLE_PERMISSIONS_MAP);
  }, [settings]);

  const toggleRolePermission = (role: string, permId: string) => {
    setEditRolePerms((prev) => {
      const current = prev[role] || [];
      const updated = current.includes(permId) ? current.filter((p) => p !== permId) : [...current, permId];
      return { ...prev, [role]: updated };
    });
  };
  const addPermission = () => { setEditPermissions([...editPermissions, { id: generateId(), label: "", description: "", icon: "Wrench" }]); };
  const updatePermission = (id: string, updates: Partial<PermissionItem>) => { setEditPermissions(editPermissions.map((p) => (p.id === id ? { ...p, ...updates } : p))); };
  const removePermission = (id: string) => {
    const perm = editPermissions.find(p => p.id === id);
    setConfirmDialog({
      open: true,
      title: "ลบฟังก์ชัน",
      description: `ต้องการลบ "${perm?.label || id}"? การกระทำนี้จะลบสิทธิ์จากทุกยศด้วย`,
      onConfirm: () => {
        setEditPermissions(editPermissions.filter((p) => p.id !== id));
        setEditRolePerms((prev) => { const updated: RolePermissions = {}; for (const [role, perms] of Object.entries(prev)) { updated[role] = perms.filter((p) => p !== id); } return updated; });
      },
    });
  };
  const savePermissions = () => {
    updateSettings({ permissions: editPermissions, rolePermissions: editRolePerms });
    // Audit trail — record who changed perms and a summary
    if (user) {
      const beforeCount = Object.values(settings.rolePermissions || {}).reduce((s: number, p: any) => s + (p?.length || 0), 0);
      const afterCount = Object.values(editRolePerms).reduce((s: number, p: any) => s + (p?.length || 0), 0);
      logActivity(user, profile, "permission_change", `perms=${editPermissions.length} · role-grants: ${beforeCount}→${afterCount}`);
    }
    toast.success("บันทึกสิทธิ์สำเร็จ!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">สิทธิ์และฟังก์ชัน</h1>
          <p className="text-sm text-muted-foreground mt-1">กำหนดว่ายศไหนใช้อะไรได้</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setConfirmDialog({ open: true, title: "รีเซ็ตสิทธิ์", description: "ต้องการรีเซ็ตสิทธิ์ทั้งหมดกลับเป็นค่าเริ่มต้น?", onConfirm: () => { setEditPermissions([...DEFAULT_PERMISSIONS_LIST]); setEditRolePerms({...DEFAULT_ROLE_PERMISSIONS_MAP}); toast.success("รีเซ็ตสิทธิ์กลับค่าเริ่มต้นแล้ว"); } }); }} className="px-3 py-2 text-xs flex items-center gap-1.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground transition-all"><RotateCcw size={12} /> รีเซ็ต</button>
          <button onClick={addPermission} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1.5"><Plus size={12} /> เพิ่ม</button>
        </div>
      </div>

      {/* Display limit */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">แสดง:</label>
        <select value={displayLimit} onChange={(e) => setDisplayLimit(Number(e.target.value))} className="input-glass px-2 py-1.5 text-xs w-20">
          {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">จาก {editPermissions.length} รายการ</span>
      </div>

      <div className="space-y-3">
        {editPermissions.slice(0, displayLimit).map((perm) => (
          <div key={perm.id} className="glass-card !p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <PermIcon name={perm.icon || perm.id} size={18} className="text-primary" />
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" value={perm.label} onChange={(e) => updatePermission(perm.id, { label: e.target.value })} className="input-glass px-3 py-2 text-sm" placeholder="ชื่อฟังก์ชัน" />
                <input type="text" value={perm.description} onChange={(e) => updatePermission(perm.id, { description: e.target.value })} className="input-glass px-3 py-2 text-sm" placeholder="คำอธิบาย" />
              </div>
              <button onClick={() => removePermission(perm.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"><Trash2 size={13} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_HIERARCHY.map((role) => {
                const has = editRolePerms[role]?.includes(perm.id);
                return (
                  <button key={role} onClick={() => toggleRolePermission(role, perm.id)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${has ? `bg-gradient-to-r ${ROLE_COLORS[role]} text-white` : "bg-muted/30 text-muted-foreground/50 border border-border"}`}>
                    {has ? <CheckCircle size={9} className="inline mr-0.5" /> : <XCircle size={9} className="inline mr-0.5" />}
                    {ROLE_LABELS[role as UserRole]?.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim()}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <h2 className="text-base font-bold text-foreground mb-3">ตารางสิทธิ์</h2>
        <div className="min-w-[500px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-bold text-foreground py-2 px-3">ฟังก์ชัน</th>
                {ROLE_HIERARCHY.map((role) => (
                  <th key={role} className="text-center text-[10px] font-bold text-foreground py-2 px-1">
                    {ROLE_LABELS[role as UserRole]?.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editPermissions.map((perm, i) => (
                <tr key={perm.id} className={`border-b border-border/50 ${i % 2 === 0 ? "bg-muted/5" : ""}`}>
                  <td className="py-2 px-3 text-xs text-foreground flex items-center gap-1.5"><PermIcon name={perm.icon || perm.id} size={12} className="text-muted-foreground" /> {perm.label}</td>
                  {ROLE_HIERARCHY.map((role) => (
                    <td key={role} className="text-center py-2 px-1">
                      {editRolePerms[role]?.includes(perm.id) ? <CheckCircle size={13} className="inline text-emerald-400" /> : <XCircle size={13} className="inline text-muted-foreground/20" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editPermissions.length > displayLimit && (
        <p className="text-xs text-center text-muted-foreground">แสดง {displayLimit} จาก {editPermissions.length} รายการ — เพิ่มจำนวนแสดงด้านบนเพื่อดูเพิ่มเติม</p>
      )}

      <button onClick={savePermissions} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกสิทธิ์ทั้งหมด</button>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}>
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPermissionsTab;
