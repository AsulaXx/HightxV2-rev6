import { useState, useMemo, useEffect, Fragment } from "react";
import { Save, RotateCcw, Shield, CheckCircle2, Users, Eye, Lock, Copy, ChevronDown, ChevronRight, Search } from "lucide-react";
import { ROLE_HIERARCHY, ROLE_LABELS, ROLE_BADGE_STYLES, useAuth, type UserRole } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { PERMISSION_GROUPS, ALL_FEATURE_IDS, buildDefaultRoleFeatures } from "@/lib/permissionRegistry";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Mode = "byrole" | "matrix";

const AdminRoleAccessTab = () => {
  const { settings, updateSettings } = useSiteSettings();
  const { user, profile } = useAuth();

  const defaults = useMemo(() => buildDefaultRoleFeatures(), []);
  const [roleFeatures, setRoleFeatures] = useState<Record<string, string[]>>(() => {
    const stored = (settings as any)?.roleFeatures || {};
    // Merge: keep customised, seed missing roles from defaults
    const merged: Record<string, string[]> = { ...defaults };
    for (const r of Object.keys(stored)) merged[r] = Array.isArray(stored[r]) ? [...stored[r]] : merged[r];
    merged.owner = ALL_FEATURE_IDS.slice(); // Owner always has all
    return merged;
  });
  const [selectedRole, setSelectedRole] = useState<UserRole>("admin");
  const [mode, setMode] = useState<Mode>("byrole");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState<null | { title: string; desc: string; onOk: () => void }>(null);

  // Sync from settings when it changes externally
  useEffect(() => {
    const stored = (settings as any)?.roleFeatures;
    if (!stored) return;
    setRoleFeatures((prev) => {
      const merged: Record<string, string[]> = { ...defaults, ...prev };
      for (const r of Object.keys(stored)) if (Array.isArray(stored[r])) merged[r] = [...stored[r]];
      merged.owner = ALL_FEATURE_IDS.slice();
      return merged;
    });
  }, [settings, defaults]);

  const toggle = (role: UserRole, permId: string) => {
    if (role === "owner") return; // locked
    setRoleFeatures((prev) => {
      const list = prev[role] || [];
      const next = list.includes(permId) ? list.filter((x) => x !== permId) : [...list, permId];
      return { ...prev, [role]: next };
    });
  };

  const toggleGroup = (role: UserRole, groupId: string) => {
    if (role === "owner") return;
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setRoleFeatures((prev) => {
      const list = new Set(prev[role] || []);
      const ids = group.items.map((i) => i.id);
      const allOn = ids.every((id) => list.has(id));
      if (allOn) ids.forEach((id) => list.delete(id));
      else ids.forEach((id) => list.add(id));
      return { ...prev, [role]: Array.from(list) };
    });
  };

  const copyFromRole = (targetRole: UserRole, sourceRole: UserRole) => {
    if (targetRole === "owner") return;
    setRoleFeatures((prev) => ({ ...prev, [targetRole]: [...(prev[sourceRole] || [])] }));
    toast.success(`คัดสิทธิ์จาก ${ROLE_LABELS[sourceRole]} → ${ROLE_LABELS[targetRole]} แล้ว`);
  };

  const resetRole = (role: UserRole) => {
    setConfirmOpen({
      title: `รีเซ็ต ${ROLE_LABELS[role]}`,
      desc: "จะกลับไปใช้สิทธิ์เริ่มต้นของยศนี้",
      onOk: () => {
        setRoleFeatures((prev) => ({ ...prev, [role]: [...defaults[role]] }));
        toast.success("รีเซ็ตแล้ว");
      },
    });
  };

  const resetAll = () => {
    setConfirmOpen({
      title: "รีเซ็ตสิทธิ์ทั้งหมด",
      desc: "จะรีเซ็ตทุกยศกลับเป็นค่าเริ่มต้น การแก้ไขของคุณจะหายไป",
      onOk: () => { setRoleFeatures({ ...defaults }); toast.success("รีเซ็ตทั้งหมดแล้ว"); },
    });
  };

  const save = () => {
    // Safety: never save without owner having all perms
    const toSave = { ...roleFeatures, owner: ALL_FEATURE_IDS.slice() };
    updateSettings({ roleFeatures: toSave } as any);
    if (user) {
      const total = Object.values(toSave).reduce((s, v) => s + v.length, 0);
      logActivity(user, profile, "permission_change", `Role Access saved · ${total} grants`);
    }
    toast.success("บันทึกสิทธิ์สำเร็จ");
  };

  const currentList = roleFeatures[selectedRole] || [];
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const totalPerms = ALL_FEATURE_IDS.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield size={20} className="text-primary" /> Role Access
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            จัดการว่าแต่ละยศเข้าหน้าไหน / เห็น section ไหนในระบบได้ ({totalPerms} สิทธิ์)
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={resetAll} className="px-3 py-2 text-xs flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground">
            <RotateCcw size={12} /> รีเซ็ตทั้งหมด
          </button>
          <button onClick={save} className="btn-gradient px-4 py-2 text-xs flex items-center gap-1.5">
            <Save size={12} /> บันทึก
          </button>
        </div>
      </div>

      {/* Mode switch */}
      <div className="inline-flex rounded-xl bg-muted/30 p-1 gap-1">
        <button onClick={() => setMode("byrole")}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${mode === "byrole" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Users size={12} className="inline mr-1" /> By Role
        </button>
        <button onClick={() => setMode("matrix")}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${mode === "matrix" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Eye size={12} className="inline mr-1" /> Matrix
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสิทธิ์..."
          className="input-glass w-full pl-8 pr-3 py-2 text-sm" />
      </div>

      {mode === "byrole" ? (
        <div className="space-y-3">
          {/* Role picker */}
          <div className="glass-card !p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {ROLE_HIERARCHY.map((r) => {
                const active = selectedRole === r;
                const count = (roleFeatures[r] || []).length;
                return (
                  <button key={r} onClick={() => setSelectedRole(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? "bg-primary/15 text-primary border-primary/40 shadow-sm" : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"}`}>
                    {ROLE_LABELS[r]} <span className="opacity-60">· {count}</span>
                  </button>
                );
              })}
            </div>

            {/* Actions for selected role */}
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] px-2 py-1 rounded-full border ${ROLE_BADGE_STYLES[selectedRole]}`}>
                {ROLE_LABELS[selectedRole]}
              </span>
              <span className="text-[11px] text-muted-foreground">มี {currentList.length}/{totalPerms} สิทธิ์</span>
              <div className="ml-auto flex items-center gap-1.5">
                {selectedRole === "owner" && (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1"><Lock size={10} /> Owner ล็อกไว้ทุกสิทธิ์</span>
                )}
                {selectedRole !== "owner" && (
                  <>
                    <div className="relative">
                      <select onChange={(e) => { if (e.target.value) { copyFromRole(selectedRole, e.target.value as UserRole); e.target.value = ""; } }}
                        className="input-glass px-2 py-1 text-[11px] pr-6" defaultValue="">
                        <option value="">คัดสิทธิ์จาก...</option>
                        {ROLE_HIERARCHY.filter((r) => r !== selectedRole).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={() => resetRole(selectedRole)}
                      className="px-2 py-1 text-[11px] rounded-lg border border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground flex items-center gap-1">
                      <RotateCcw size={10} /> รีเซ็ตยศนี้
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Groups */}
          {filteredGroups.map((g) => {
            const groupIds = g.items.map((i) => i.id);
            const hasAll = groupIds.every((id) => currentList.includes(id));
            const hasSome = groupIds.some((id) => currentList.includes(id));
            const isCollapsed = collapsed[g.id];
            return (
              <div key={g.id} className="glass-card !p-3">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => setCollapsed((p) => ({ ...p, [g.id]: !p[g.id] }))}
                    className="p-1 hover:bg-muted/40 rounded">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <h3 className="text-sm font-bold text-foreground flex-1">{g.label}</h3>
                  <span className="text-[10px] text-muted-foreground">
                    {groupIds.filter((id) => currentList.includes(id)).length}/{groupIds.length}
                  </span>
                  <button onClick={() => toggleGroup(selectedRole, g.id)}
                    disabled={selectedRole === "owner"}
                    className={`px-2 py-1 text-[10px] rounded-lg font-semibold transition-all ${hasAll ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" : hasSome ? "bg-amber-500/15 text-amber-500 border border-amber-500/30" : "bg-muted/30 text-muted-foreground border border-border"} disabled:opacity-50`}>
                    {hasAll ? "ทั้งหมด" : hasSome ? "บางส่วน" : "ไม่มีเลย"}
                  </button>
                </div>
                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {g.items.map((p) => {
                      const has = currentList.includes(p.id);
                      const locked = selectedRole === "owner";
                      return (
                        <button key={p.id} onClick={() => toggle(selectedRole, p.id)} disabled={locked}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all disabled:opacity-70 ${has ? "bg-emerald-500/10 border-emerald-500/30 text-foreground" : "bg-muted/10 border-border text-muted-foreground hover:bg-muted/25"}`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${has ? "bg-emerald-500 text-white" : "border border-border"}`}>
                            {has && <CheckCircle2 size={10} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{p.label}</div>
                            <div className="text-[10px] text-muted-foreground/70 font-mono truncate">{p.id}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Matrix view
        <div className="glass-card !p-3 overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-xs font-bold text-foreground py-2 px-2 sticky left-0 bg-card z-10">สิทธิ์</th>
                {ROLE_HIERARCHY.map((r) => (
                  <th key={r} className="text-center text-[10px] font-bold py-2 px-1.5 whitespace-nowrap">
                    <div className={`inline-block px-2 py-0.5 rounded-full border ${ROLE_BADGE_STYLES[r]}`}>
                      {ROLE_LABELS[r]}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {(roleFeatures[r] || []).length}/{totalPerms}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => (
                <Fragment key={g.id}>

                  <tr key={`h-${g.id}`} className="bg-muted/20">
                    <td colSpan={ROLE_HIERARCHY.length + 1} className="text-[11px] font-bold text-primary py-1.5 px-2">
                      {g.label}
                    </td>
                  </tr>
                  {g.items.map((p) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/10">
                      <td className="py-1.5 px-2 sticky left-0 bg-card z-10">
                        <div className="text-xs text-foreground">{p.label}</div>
                        <div className="text-[9px] font-mono text-muted-foreground/60">{p.id}</div>
                      </td>
                      {ROLE_HIERARCHY.map((r) => {
                        const has = (roleFeatures[r] || []).includes(p.id);
                        const locked = r === "owner";
                        return (
                          <td key={r} className="text-center py-1 px-1">
                            <button onClick={() => toggle(r, p.id)} disabled={locked}
                              className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-all disabled:opacity-70 ${has ? "bg-emerald-500 text-white" : "bg-muted/20 hover:bg-muted/40 border border-border text-muted-foreground/40"}`}>
                              {has ? <CheckCircle2 size={12} /> : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>

              ))}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmOpen?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmOpen?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmOpen?.onOk(); setConfirmOpen(null); }}>ยืนยัน</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRoleAccessTab;
