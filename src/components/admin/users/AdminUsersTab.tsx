import { useState, useEffect } from "react";
import { Search, ArrowUpDown, Crown, Wallet, Key, DollarSign, Ban, ShieldOff, Trash2, Timer, Package, History } from "lucide-react";
import { useAuth, UserRole, UserProfile, ROLE_HIERARCHY, ROLE_LABELS } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { doc, updateDoc, getDoc, setDoc, increment, serverTimestamp, addDoc, collection, onSnapshot, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { applyLedger, generateAttemptId } from "@/lib/walletLedger";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import type { AdminTabWithUsersProps, FirestoreUser } from "../shared/AdminTabProps";
import { User } from "firebase/auth";

const ROLE_COLORS: Record<string, string> = {
  owner: "from-yellow-500 to-amber-400", admin: "from-red-500 to-rose-400",
  moderator: "from-blue-500 to-cyan-400", reseller: "from-emerald-500 to-teal-400",
  hightxcrew: "from-orange-500 to-amber-400",
  vip: "from-purple-500 to-violet-400", user: "from-slate-500 to-zinc-400",
};

const CreditDisplay = ({ userId }: { userId: string }) => {
  const [bal, setBal] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "wallets", userId), (snap) => {
      setBal(snap.exists() ? (snap.data().balance || 0) : 0);
    });
    return () => unsub();
  }, [userId]);
  if (bal === null) return <span className="text-xs text-muted-foreground">กำลังโหลด...</span>;
  return <span className="font-bold text-foreground">฿{bal.toLocaleString()}</span>;
};

const ResetCooldownSection = ({ user, profile, users }: { user: User; profile: UserProfile; users: FirestoreUser[] }) => {
  const { settings } = useSiteSettings();
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  const [resetting, setResetting] = useState(false);

  const products = (settings.products || []).filter(p => p.enabled && p.name);

  const handleReset = async () => {
    if (!userId) return;
    const targetUser = users.find(u => u.uid === userId);
    const productLabel = selectedProductId === "all" ? "ทั้งหมด" : products.find(p => p.id === selectedProductId)?.name || selectedProductId;
    if (!confirm(`รีเซ็ต Cooldown ${productLabel} ของ ${targetUser?.displayName || targetUser?.email}?`)) return;
    setResetting(true);
    try {
      let q;
      if (selectedProductId === "all") {
        q = query(collection(db, "claimHistory"), where("userId", "==", userId));
      } else {
        q = query(collection(db, "claimHistory"), where("userId", "==", userId), where("productId", "==", selectedProductId));
      }
      const snap = await getDocs(q);
      const deletes = snap.docs.map(d => deleteDoc(doc(db, "claimHistory", d.id)));
      await Promise.all(deletes);
      toast.success(`รีเซ็ต Cooldown ${productLabel} ของ ${targetUser?.displayName || targetUser?.email} สำเร็จ (ลบ ${snap.size} รายการ)`);
      await logActivity(user, profile, "admin_reset_cooldown", `รีเซ็ต Cooldown ${productLabel} ของ ${targetUser?.displayName || targetUser?.email} (${snap.size} รายการ)`);
      setUserId(""); setSearch(""); setSelectedProductId("all");
    } catch (err) { console.error(err); toast.error("ไม่สามารถรีเซ็ต Cooldown ได้"); }
    setResetting(false);
  };

  return (
    <div className="glass-card space-y-4">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Timer size={16} className="text-primary" /> รีเซ็ต Cooldown ผู้ใช้</h3>
      <p className="text-xs text-muted-foreground">ลบประวัติ Cooldown ของผู้ใช้ ทั้งหมดหรือเฉพาะสินค้าที่เลือก</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-xs text-muted-foreground mb-1">ค้นหาผู้ใช้</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) setUserId(""); }} onFocus={() => setDropdownOpen(true)} className="input-glass w-full pl-9 pr-3 py-2.5 text-sm" placeholder="พิมพ์ชื่อหรืออีเมล..." />
          </div>
          {dropdownOpen && search && (
            <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {users.filter(u => { const s = search.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">ไม่พบผู้ใช้</div>
              ) : (
                users.filter(u => { const s = search.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).map(u => (
                  <button key={u.uid} onClick={() => { setUserId(u.uid); setSearch(u.displayName || u.email); setDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between">
                    <span className="truncate">{u.displayName || u.email}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{ROLE_LABELS[u.role]}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">สินค้า</label>
          <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="input-glass w-full px-3 py-2.5 text-sm">
            <option value="all">🔄 ทั้งหมด (รีเซ็ตทุกสินค้า)</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>📦 {p.name}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        disabled={resetting || !userId}
        onClick={handleReset}
        className="w-full btn-gradient py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-medium"
      >
        <Timer size={14} /> {resetting ? "กำลังดำเนินการ..." : "รีเซ็ต Cooldown"}
      </button>
    </div>
  );
};

const LegacySpendSection = ({ user, profile, users }: { user: User; profile: UserProfile; users: FirestoreUser[] }) => {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const value = Math.abs(parseFloat(amount));
    if (!userId || !value || isNaN(value)) { toast.error("กรุณาเลือกผู้ใช้และกรอกจำนวนเงิน"); return; }
    const target = users.find(u => u.uid === userId);
    if (!confirm(`บันทึกยอดสะสมย้อนหลัง ฿${value.toLocaleString()} ให้ ${target?.displayName || target?.email}?\n(ยอดนี้จะนับรวมเข้า VIP Tier และประวัติการเติมเงิน แต่ไม่เพิ่มเครดิตในกระเป๋า)`)) return;
    setSaving(true);
    try {
      const ts = Date.now();
      const reason = note || "ย้ายข้อมูลจากระบบเดิม";
      // 1) walletTransactions purchase record → counts toward VIP totalSpend
      await addDoc(collection(db, "walletTransactions"), {
        userId,
        userEmail: target?.email || "",
        userName: target?.displayName || target?.email || "",
        amount: value,
        type: "purchase",
        method: "legacy_migration",
        note: `[ย้ายระบบ] ${reason}`,
        adminBy: user.uid,
        adminName: profile?.displayName || profile?.email || "",
        createdAt: serverTimestamp(),
      });
      // 2) topUpHistory record → shows in user's top-up history
      await addDoc(collection(db, "topUpHistory"), {
        userId,
        userEmail: target?.email || "",
        userName: target?.displayName || target?.email || "",
        amount: value,
        transRef: `LEGACY_${ts}`,
        status: "success",
        method: "legacy_migration",
        adminNote: `[ย้ายระบบ] ${reason}`,
        adminBy: user.uid,
        legacy: true,
        createdAt: serverTimestamp(),
      });
      await logActivity(user, profile, "admin_legacy_spend", `เพิ่มยอดสะสมย้อนหลัง ฿${value.toLocaleString()} ให้ ${target?.displayName || target?.email} (${reason})`);
      toast.success(`เพิ่มยอดสะสม ฿${value.toLocaleString()} ให้ ${target?.displayName || target?.email} สำเร็จ`);
      setUserId(""); setSearch(""); setAmount(""); setNote("");
    } catch (err) { console.error(err); toast.error("ไม่สามารถบันทึกได้"); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card space-y-4">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><History size={16} className="text-primary" /> เพิ่มยอดสะสมย้อนหลัง (ย้ายระบบ)</h3>
        <p className="text-xs text-muted-foreground mt-1">บันทึกยอดเติมเงิน/ใช้จ่ายสะสมจากระบบเดิม เพื่อให้ผู้ใช้ได้รับยศ VIP Tier ตามยอดสะสมเดิม <span className="text-amber-400">(ไม่เพิ่มเครดิตในกระเป๋า)</span></p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <label className="block text-xs text-muted-foreground mb-1">ค้นหาผู้ใช้</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); if (!e.target.value) setUserId(""); }} onFocus={() => setDropdownOpen(true)} className="input-glass w-full pl-9 pr-3 py-2.5 text-sm" placeholder="ชื่อ, อีเมล หรือ UID..." />
          </div>
          {dropdownOpen && search && (
            <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {users.filter(u => { const s = search.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.uid?.toLowerCase().includes(s)); }).slice(0, 20).map(u => (
                <button key={u.uid} onClick={() => { setUserId(u.uid); setSearch(u.displayName || u.email); setDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between">
                  <span className="truncate">{u.displayName || u.email}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">{u.email}</span>
                </button>
              ))}
              {users.filter(u => { const s = search.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.uid?.toLowerCase().includes(s)); }).length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">ไม่พบผู้ใช้</div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">ยอดสะสม (฿)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value.replace("-", ""))} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="เช่น 5000" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">หมายเหตุ (ไม่บังคับ)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="เช่น ย้ายจากเว็บเก่า, ยอดสะสม Discord ฯลฯ" />
      </div>
      <button disabled={saving || !userId || !amount} onClick={handleAdd} className="w-full btn-gradient py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-medium">
        <History size={14} /> {saving ? "กำลังบันทึก..." : "บันทึกยอดสะสมย้อนหลัง"}
      </button>
    </div>
  );
};

const AdminUsersTab = ({ form, setForm, handleSave, user, profile, users, loadUsers, isOwner, isAdmin }: AdminTabWithUsersProps) => {
  const [userSearch, setUserSearch] = useState("");
  const [userDisplayLimit, setUserDisplayLimit] = useState(10);
  const [userSortBy, setUserSortBy] = useState<"name" | "role" | "email">("role");
  const [userSortAsc, setUserSortAsc] = useState(true);
  const [userFilterRole, setUserFilterRole] = useState<string>("all");
  const [creditUserId, setCreditUserId] = useState("");
  const [creditUserSearch, setCreditUserSearch] = useState("");
  const [creditDropdownOpen, setCreditDropdownOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditMode, setCreditMode] = useState<"add" | "deduct">("add");
  const [creditNote, setCreditNote] = useState("");
  const [addingCredit, setAddingCredit] = useState(false);
  const [resetPwUserSearch, setResetPwUserSearch] = useState("");
  const [resetPwUserId, setResetPwUserId] = useState("");
  const [resetPwDropdownOpen, setResetPwDropdownOpen] = useState(false);
  const [resetPwNewPassword, setResetPwNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);


  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if ((newRole === "owner" || newRole === "admin") && !isOwner) { toast.error("เฉพาะ Owner เท่านั้นที่สามารถกำหนดยศนี้ได้"); return; }
    try {
      await updateDoc(doc(db, "users", uid), { role: newRole });
      toast.success("อัปเดตยศสำเร็จ!");
      loadUsers();
    } catch (e: any) {
      console.error("[updateUserRole] failed:", e);
      toast.error(`ไม่สามารถอัปเดตยศได้: ${e?.code || e?.message || String(e)}`);
    }
  };

  const getAssignableRoles = (): UserRole[] => {
    if (isOwner) return [...ROLE_HIERARCHY];
    if (isAdmin) return ["moderator", "hightxcrew", "vip", "user"];
    return [];
  };

  const filteredUsers = users
    .filter((u) => {
      if (userFilterRole !== "all" && u.role !== userFilterRole) return false;
      if (!userSearch) return true;
      const search = userSearch.toLowerCase();
      return u.email?.toLowerCase().includes(search) || u.displayName?.toLowerCase().includes(search) || u.uid?.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      let cmp = 0;
      if (userSortBy === "name") cmp = (a.displayName || a.email).localeCompare(b.displayName || b.email);
      else if (userSortBy === "email") cmp = a.email.localeCompare(b.email);
      else if (userSortBy === "role") cmp = ROLE_HIERARCHY.indexOf(a.role) - ROLE_HIERARCHY.indexOf(b.role);
      return userSortAsc ? cmp : -cmp;
    });

  const roleStats = ROLE_HIERARCHY.map((role) => ({ role, count: users.filter((u) => u.role === role).length }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">จัดการยศผู้ใช้</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} ผู้ใช้ทั้งหมด</p>
      </div>

      {/* Role overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {roleStats.map((rs) => (
          <button key={rs.role} onClick={() => setUserFilterRole(userFilterRole === rs.role ? "all" : rs.role)}
            className={`glass-card !p-3 text-center transition-all ${userFilterRole === rs.role ? "ring-2 ring-primary" : ""}`}>
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ROLE_COLORS[rs.role]} flex items-center justify-center mx-auto mb-1.5`}>
              <Crown size={12} className="text-white" />
            </div>
            <p className="text-[10px] text-muted-foreground">{ROLE_LABELS[rs.role as UserRole]?.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim()}</p>
            <p className="text-lg font-bold text-foreground">{rs.count}</p>
          </button>
        ))}
      </div>

      <div className="glass-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">รายชื่อผู้ใช้</h2>
          <button onClick={loadUsers} className="btn-glass px-3 py-1.5 text-xs">🔄 รีเฟรช</button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="input-glass w-full pl-9 pr-4 py-2.5 text-sm" placeholder="ค้นหา..." />
          </div>
          <div className="flex gap-2">
            <select value={userFilterRole} onChange={(e) => setUserFilterRole(e.target.value)} className="input-glass px-3 py-2 text-xs">
              <option value="all">ทุกยศ</option>
              {ROLE_HIERARCHY.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button onClick={() => setUserSortAsc(!userSortAsc)} className="btn-glass px-3 py-2 text-xs"><ArrowUpDown size={12} /></button>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">แสดง:</label>
            <select value={userDisplayLimit} onChange={(e) => setUserDisplayLimit(Number(e.target.value))} className="input-glass px-2 py-1.5 text-xs w-24">
              {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              <option value={999999}>ทั้งหมด</option>
            </select>
            <span className="text-xs text-muted-foreground">รายการ</span>
          </div>
          <p className="text-xs text-muted-foreground">{filteredUsers.length} จาก {users.length}</p>
        </div>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">ไม่พบผู้ใช้</p>
          ) : filteredUsers.slice(0, userDisplayLimit).map((u) => (
            <div key={u.uid} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-muted/20 border border-border hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ROLE_COLORS[u.role]} flex items-center justify-center shrink-0`}>
                  <span className="text-white text-sm font-bold">{(u.displayName || u.email || "?")[0].toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">{u.displayName || u.email}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg bg-gradient-to-r ${ROLE_COLORS[u.role]} text-white whitespace-nowrap`}>{ROLE_LABELS[u.role]}</span>
                {u.banned && <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-destructive/20 text-destructive border border-destructive/30">ถูกแบน</span>}
                {u.uid !== profile?.uid && (
                  <>
                    <select value={u.role} onChange={(e) => updateUserRole(u.uid, e.target.value as UserRole)} className="input-glass px-2 py-1.5 text-xs flex-1 sm:flex-none">
                      {getAssignableRoles().map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button
                      onClick={async () => {
                        if (u.banned) {
                          if (!confirm(`ปลดแบน ${u.displayName || u.email}?`)) return;
                          await updateDoc(doc(db, "users", u.uid), { banned: false, bannedReason: "", bannedAt: "" });
                          toast.success("ปลดแบนสำเร็จ");
                          await logActivity(user!, profile!, "user_unban", `ปลดแบน: ${u.displayName || u.email}`);
                        } else {
                          const reason = prompt(`เหตุผลในการแบน ${u.displayName || u.email}:`);
                          if (reason === null) return;
                          await updateDoc(doc(db, "users", u.uid), { banned: true, bannedReason: reason || "ไม่ระบุ", bannedAt: new Date().toISOString() });
                          toast.success("แบนผู้ใช้สำเร็จ");
                          await logActivity(user!, profile!, "user_ban", `แบน: ${u.displayName || u.email} | เหตุผล: ${reason || "ไม่ระบุ"}`);
                        }
                        loadUsers();
                      }}
                      className={`p-1.5 rounded-lg text-xs transition-all ${u.banned ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-destructive/20 text-destructive hover:bg-destructive/30'}`}
                      title={u.banned ? "ปลดแบน" : "แบน"}
                    >
                      {u.banned ? <ShieldOff size={14} /> : <Ban size={14} />}
                    </button>
                  </>
                )}
                {u.uid === profile?.uid && <span className="text-[10px] text-muted-foreground italic">คุณ</span>}
              </div>
            </div>
          ))}
          {filteredUsers.length > userDisplayLimit && (
            <p className="text-xs text-center text-muted-foreground pt-2">แสดง {userDisplayLimit} จาก {filteredUsers.length} — เพิ่มจำนวนแสดงด้านบน</p>
          )}
        </div>
      </div>

      {/* Credit Management */}
      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Wallet size={16} className="text-primary" /> แอดเครดิตให้ผู้ใช้</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <label className="block text-xs text-muted-foreground mb-1">ค้นหาผู้ใช้</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={creditUserSearch} onChange={(e) => { setCreditUserSearch(e.target.value); setCreditDropdownOpen(true); if (!e.target.value) setCreditUserId(""); }} onFocus={() => setCreditDropdownOpen(true)} className="input-glass w-full pl-9 pr-3 py-2.5 text-sm" placeholder="พิมพ์ชื่อหรืออีเมล..." />
            </div>
            {creditDropdownOpen && creditUserSearch && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {users.filter(u => { const s = creditUserSearch.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">ไม่พบผู้ใช้</div>
                ) : (
                  users.filter(u => { const s = creditUserSearch.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).map(u => (
                    <button key={u.uid} onClick={() => { setCreditUserId(u.uid); setCreditUserSearch(u.displayName || u.email); setCreditDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <span className="truncate">{u.displayName || u.email}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{ROLE_LABELS[u.role]}</span>
                    </button>
                  ))
                )}
              </div>
            )}
            {creditUserId && (() => {
              const selectedUser = users.find(u => u.uid === creditUserId);
              return selectedUser ? (
                <div className="mt-2 p-2.5 rounded-lg bg-accent/30 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet size={14} className="text-primary" />
                    <span className="text-muted-foreground">เครดิตปัจจุบัน:</span>
                    <CreditDisplay userId={creditUserId} />
                  </div>
                </div>
              ) : null;
            })()}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">จำนวนเงิน (฿)</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCreditMode("add")} className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${creditMode === "add" ? "bg-primary/15 text-primary border-primary/30" : "bg-muted/10 text-muted-foreground border-border/30 hover:bg-primary/10"}`}>+ เพิ่ม</button>
              <button type="button" onClick={() => setCreditMode("deduct")} className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${creditMode === "deduct" ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-muted/10 text-muted-foreground border-border/30 hover:bg-destructive/10"}`}>− ลบ</button>
              <input type="number" min="0" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value.replace("-", ""))} className="input-glass flex-1 px-3 py-2.5 text-sm" placeholder="100" />
            </div>
            {creditMode === "deduct" && creditAmount && (
              <p className="text-[10px] text-destructive mt-1">⚠️ จะหักเครดิต ฿{Math.abs(parseFloat(creditAmount) || 0).toLocaleString()} ออกจากกระเป๋า</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">หมายเหตุ (ไม่บังคับ)</label>
          <input type="text" value={creditNote} onChange={(e) => setCreditNote(e.target.value)} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="เช่น โบนัส, ชดเชย, หักคืน ฯลฯ" />
        </div>
        <button
          disabled={addingCredit || !creditUserId || !creditAmount}
          onClick={async () => {
            if (!creditUserId || !creditAmount) return;
            const rawAmount = Math.abs(parseFloat(creditAmount));
            if (isNaN(rawAmount) || rawAmount === 0) { toast.error("จำนวนเงินไม่ถูกต้อง"); return; }
            const amount = creditMode === "deduct" ? -rawAmount : rawAmount;
            if (amount < 0) {
              const walletRef = doc(db, "wallets", creditUserId);
              const walletSnap = await getDoc(walletRef);
              const currentBalance = walletSnap.exists() ? (walletSnap.data().balance || 0) : 0;
              if (currentBalance + amount < 0) { toast.error(`ยอดเงินไม่พอ (คงเหลือ ฿${currentBalance.toLocaleString()})`); return; }
            }
            setAddingCredit(true);
            try {
              const targetUser = users.find(u => u.uid === creditUserId);
              const adminAttemptId = generateAttemptId(creditMode === "deduct" ? "admindeduct" : "adminadd");
              await applyLedger({
                userId: creditUserId,
                userEmail: targetUser?.email || "",
                userName: targetUser?.displayName || targetUser?.email || "",
                amount,
                type: creditMode === "deduct" ? "topup_admin_deduct" : "topup_admin_add",
                description: creditNote || `${creditMode === "deduct" ? "หัก" : "เพิ่ม"}เครดิตโดย ${profile?.displayName || profile?.email}`,
                refId: `ADMIN_${creditMode === "deduct" ? "DEDUCT" : "ADD"}_${Date.now()}`,
                method: "admin",
                actorId: user.uid,
                actorName: profile?.displayName || profile?.email || "",
                meta: { attemptId: adminAttemptId, note: creditNote || "" },
              });
              await addDoc(collection(db, "topUpHistory"), {
                userId: creditUserId, userEmail: targetUser?.email || "", userName: targetUser?.displayName || targetUser?.email || "",
                amount, transRef: `ADMIN_${creditMode === "deduct" ? "DEDUCT" : "ADD"}_${Date.now()}`, status: "success", method: "admin",
                adminNote: creditNote || `${creditMode === "deduct" ? "ลบเครดิต" : "แอดเครดิต"}โดย ${profile?.displayName || profile?.email}`,
                adminBy: user.uid, attemptId: adminAttemptId, createdAt: serverTimestamp(),
              });
              await logActivity(user, profile, "admin_credit", `${creditMode === "deduct" ? "ลบ" : "แอด"}เครดิต ฿${rawAmount.toLocaleString()} ${creditMode === "deduct" ? "จาก" : "ให้"} ${targetUser?.displayName || targetUser?.email}${creditNote ? ` (${creditNote})` : ""}`);
              toast.success(`${creditMode === "deduct" ? "หัก" : "เพิ่ม"}เครดิต ฿${rawAmount.toLocaleString()} ${creditMode === "deduct" ? "จาก" : "ให้"} ${targetUser?.displayName || targetUser?.email} สำเร็จ`);
              setCreditUserId(""); setCreditAmount(""); setCreditNote(""); setCreditUserSearch(""); setCreditMode("add");
            } catch (err) { console.error(err); toast.error("ไม่สามารถดำเนินการได้"); }
            finally { setAddingCredit(false); }
          }}
          className={`w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-medium transition-all ${creditMode === "deduct" ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20" : "btn-gradient"}`}
        >
          <DollarSign size={14} /> {addingCredit ? "กำลังดำเนินการ..." : (creditMode === "deduct" ? "ลบเครดิต" : "แอดเครดิต")}
        </button>
      </div>

      {/* Password Reset */}
      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Key size={16} className="text-primary" /> ตั้งรหัสผ่านใหม่ให้ผู้ใช้</h3>
        <p className="text-xs text-muted-foreground">สำหรับกรณีที่ลูกค้าลืมรหัสผ่านและต้องการให้แอดมินตั้งรหัสใหม่ให้</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <label className="block text-xs text-muted-foreground mb-1">ค้นหาผู้ใช้</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={resetPwUserSearch} onChange={(e) => { setResetPwUserSearch(e.target.value); setResetPwDropdownOpen(true); if (!e.target.value) setResetPwUserId(""); }} onFocus={() => setResetPwDropdownOpen(true)} className="input-glass w-full pl-9 pr-3 py-2.5 text-sm" placeholder="พิมพ์ชื่อหรืออีเมล..." />
            </div>
            {resetPwDropdownOpen && resetPwUserSearch && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {users.filter(u => { const s = resetPwUserSearch.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">ไม่พบผู้ใช้</div>
                ) : (
                  users.filter(u => { const s = resetPwUserSearch.toLowerCase(); return (u.displayName?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)); }).map(u => (
                    <button key={u.uid} onClick={() => { setResetPwUserId(u.uid); setResetPwUserSearch(u.displayName || u.email); setResetPwDropdownOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between">
                      <span className="truncate">{u.displayName || u.email}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{u.email}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">รหัสผ่านใหม่</label>
            <input type="text" value={resetPwNewPassword} onChange={(e) => setResetPwNewPassword(e.target.value)} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)" />
          </div>
        </div>
        <button
          disabled={resettingPw || !resetPwUserId || !resetPwNewPassword || resetPwNewPassword.length < 6}
          onClick={async () => {
            if (!resetPwUserId || !resetPwNewPassword || resetPwNewPassword.length < 6) { toast.error("กรุณาเลือกผู้ใช้และกรอกรหัสผ่านอย่างน้อย 6 ตัว"); return; }
            const targetUser = users.find(u => u.uid === resetPwUserId);
            if (!confirm(`ตั้งรหัสผ่านใหม่ให้ ${targetUser?.displayName || targetUser?.email}?`)) return;
            setResettingPw(true);
            try {
              const { getIdToken } = await import("@/lib/firebaseIdToken");
              const idToken = await getIdToken();
              const { data, error } = await supabase.functions.invoke('admin-reset-password', { body: { uid: resetPwUserId, newPassword: resetPwNewPassword, idToken } });
              if (error) throw error;
              if (data?.success) {
                toast.success(`ตั้งรหัสผ่านใหม่ให้ ${targetUser?.displayName || targetUser?.email} สำเร็จ`);
                await logActivity(user, profile, "admin_reset_password", `ตั้งรหัสผ่านใหม่ให้ ${targetUser?.displayName || targetUser?.email}`);
                setResetPwUserId(""); setResetPwUserSearch(""); setResetPwNewPassword("");
              } else { toast.error(data?.error || "ไม่สามารถตั้งรหัสผ่านได้"); }
            } catch (err: any) { console.error(err); toast.error("ไม่สามารถตั้งรหัสผ่านได้: " + (err.message || "")); }
            setResettingPw(false);
          }}
          className="w-full btn-gradient py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl font-medium"
        >
          <Key size={14} /> {resettingPw ? "กำลังดำเนินการ..." : "ตั้งรหัสผ่านใหม่"}
        </button>
      </div>

      {/* Reset Cooldown */}
      <ResetCooldownSection user={user} profile={profile} users={users} />

      {/* Legacy Spend Migration */}
      <LegacySpendSection user={user} profile={profile} users={users} />
    </div>
  );
};

export default AdminUsersTab;
