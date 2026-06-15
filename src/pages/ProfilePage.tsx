import RedirectToLogin from "@/components/RedirectToLogin";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth, ROLE_LABELS, ROLE_COLORS, ROLE_BADGE_STYLES } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import { User, Save, KeyRound, Shield, Mail, Crown, Copy, Gift, LogIn, ArrowRight, Trophy } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { auth, db } from "@/lib/firebase";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential, GoogleAuthProvider, reauthenticateWithPopup } from "firebase/auth";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";


const ProfilePage = () => {
  const { user, profile, loading: authLoading, isEmailVerified } = useAuth();
  const { settings } = useSiteSettings();
  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [totalSpend, setTotalSpend] = useState(0);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Load total spending for VIP tier
    const loadSpend = async () => {
      try {
        const q = query(collection(db, "walletTransactions"), where("userId", "==", user.uid), where("type", "==", "purchase"));
        const snap = await getDocs(q);
        const total = snap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
        setTotalSpend(total);
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("ProfilePage.loadSpend", err, "warn"); }
    };
    // Load referral count
    const loadReferrals = async () => {
      try {
        const q = query(collection(db, "users"), where("referredBy", "==", user.uid));
        const snap = await getDocs(q);
        setReferralCount(snap.size);
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("ProfilePage.loadReferrals", err, "warn"); }
    };
    loadSpend();
    if (settings.referral?.enabled) loadReferrals();
  }, [user, settings.referral?.enabled]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground text-sm">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;

  const handleSaveProfile = async () => {
    if (!displayName.trim()) { toast.error("กรุณากรอกชื่อที่แสดง"); return; }
    if (displayName.trim().length > 50) { toast.error("ชื่อต้องไม่เกิน 50 ตัวอักษร"); return; }
    setSaving(true);
    try {
      await updateProfile(auth.currentUser!, { displayName: displayName.trim() });
      await updateDoc(doc(db, "users", user.uid), { displayName: displayName.trim() });
      toast.success("บันทึกโปรไฟล์สำเร็จ!");
    } catch { toast.error("ไม่สามารถบันทึกได้"); }
    setSaving(false);
  };

  const hasPasswordProvider = user?.providerData?.some(p => p.providerId === "password") ?? false;
  const isGoogleOnly = user?.providerData?.some(p => p.providerId === "google.com") && !hasPasswordProvider;

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (newPassword !== confirmPassword) { toast.error("รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    setChangingPassword(true);
    try {
      if (isGoogleOnly) {
        // Google-only user: reauthenticate via Google popup, then set password
        const googleProvider = new GoogleAuthProvider();
        await reauthenticateWithPopup(auth.currentUser!, googleProvider);
        await updatePassword(auth.currentUser!, newPassword);
        toast.success("ตั้งรหัสผ่านสำเร็จ! ตอนนี้คุณสามารถเข้าสู่ระบบด้วยอีเมลและรหัสผ่านได้แล้ว");
      } else {
        if (!currentPassword) { toast.error("กรุณากรอกรหัสผ่านปัจจุบัน"); setChangingPassword(false); return; }
        const cred = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(auth.currentUser!, cred);
        await updatePassword(auth.currentUser!, newPassword);
        toast.success("เปลี่ยนรหัสผ่านสำเร็จ!");
      }
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") toast.error("รหัสผ่านปัจจุบันไม่ถูกต้อง");
      else if (err.code === "auth/weak-password") toast.error("รหัสผ่านใหม่ไม่ปลอดภัยเพียงพอ");
      else if (err.code === "auth/popup-closed-by-user") toast.error("การยืนยันตัวตนถูกยกเลิก");
      else if (err.code === "auth/requires-recent-login") toast.error("กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง");
      else toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
    setChangingPassword(false);
  };

  // VIP Tier calculation
  const vipTiers = settings.vipTiers;
  const currentVipTier = vipTiers?.enabled
    ? [...(vipTiers.tiers || [])].sort((a, b) => b.minSpend - a.minSpend).find(t => totalSpend >= t.minSpend) || null
    : null;
  const nextVipTier = vipTiers?.enabled
    ? [...(vipTiers.tiers || [])].sort((a, b) => a.minSpend - b.minSpend).find(t => totalSpend < t.minSpend) || null
    : null;

  const inputCls = "input-glass w-full px-4 py-3 text-xs";

  return (
    <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "โปรไฟล์" }]}
        title="โปรไฟล์"
        subtitle="จัดการข้อมูลส่วนตัว"
        icon={User}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        

        <div className="glass-card mb-4 !rounded-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ROLE_COLORS[profile.role]} flex items-center justify-center`}>
              <span className="text-primary-foreground text-lg font-bold">{(profile.displayName || profile.email || "?")[0].toUpperCase()}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{profile.displayName || profile.email}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border ${ROLE_BADGE_STYLES[profile.role]}`}>{ROLE_LABELS[profile.role]}</span>
                {currentVipTier && (
                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r ${currentVipTier.color} text-white`}>
                    {currentVipTier.icon} {currentVipTier.name}
                  </span>
                )}
                {isEmailVerified ? (
                  <span className="text-[9px] text-success flex items-center gap-0.5"><Mail size={9} /> ยืนยันแล้ว</span>
                ) : (
                  <span className="text-[9px] text-warning flex items-center gap-0.5"><Mail size={9} /> ยังไม่ยืนยัน</span>
                )}
              </div>
              {/* Login method badges */}
              <div className="flex items-center gap-1.5 mt-1">
                <LogIn size={9} className="text-muted-foreground/50" />
                {user.providerData?.some(p => p.providerId === "google.com") && (
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Google</span>
                )}
                {user.providerData?.some(p => p.providerId === "password") && (
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Email/Password</span>
                )}
                {(!user.providerData || user.providerData.length === 0) && (
                  <span className="text-[9px] font-medium px-2 py-0.5 rounded-md bg-muted/20 text-muted-foreground border border-border/20">Magic Link</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">🆔 UID (รหัสผู้ใช้)</label>
              <div className="flex items-center gap-2">
                <input type="text" value={user.uid} readOnly className={`${inputCls} font-mono text-[10px] opacity-70 cursor-default`} />
                <button onClick={() => { navigator.clipboard.writeText(user.uid); toast.success("คัดลอก UID แล้ว"); }} className="btn-glass px-3 py-3 shrink-0">
                  <Copy size={14} />
                </button>
              </div>
              {user.providerData?.some(p => p.providerId === "google.com") && !user.providerData?.some(p => p.providerId === "password") && (
                <p className="text-[9px] text-amber-400 mt-1">💡 คุณเข้าสู่ระบบผ่าน Google — สามารถใช้ UID นี้เป็นรหัสผ่านเริ่มต้นได้ (แนะนำให้เปลี่ยนรหัสผ่านด้านล่าง)</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมล</label>
              <input type="email" value={user.email || ""} disabled className={`${inputCls} opacity-50 cursor-not-allowed`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ชื่อที่แสดง</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="ชื่อของคุณ" maxLength={50} />
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="btn-gradient w-full py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={14} /> {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
            </button>
          </div>
        </div>

        {/* VIP Tier Progress */}
        {vipTiers?.enabled && (
          <div className="glass-card mb-4 !rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Crown size={15} /> VIP Tier</h2>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">ยอดซื้อสะสม</p>
              <p className="text-sm font-bold text-primary">฿{totalSpend.toLocaleString()}</p>
            </div>
            {currentVipTier && (
              <div className={`p-3 rounded-xl bg-gradient-to-r ${currentVipTier.color} text-white`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{currentVipTier.icon}</span>
                  <div>
                    <p className="text-sm font-bold">{currentVipTier.name}</p>
                    <p className="text-[10px] opacity-80">ส่วนลด {currentVipTier.discountPercent}% ทุกสินค้า</p>
                  </div>
                </div>
              </div>
            )}
            {nextVipTier && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">ต่อไป: {nextVipTier.icon} {nextVipTier.name}</span>
                  <span className="text-foreground font-semibold">อีก ฿{(nextVipTier.minSpend - totalSpend).toLocaleString()}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted/20 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (totalSpend / nextVipTier.minSpend) * 100)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${nextVipTier.color}`}
                  />
                </div>
              </div>
            )}
            {/* Tier ladder */}
            <div className="flex gap-1.5 flex-wrap">
              {[...(vipTiers.tiers || [])].sort((a, b) => a.minSpend - b.minSpend).map(tier => {
                const achieved = totalSpend >= tier.minSpend;
                return (
                  <div key={tier.id} className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${achieved ? `bg-gradient-to-r ${tier.color} text-white border-transparent` : 'bg-muted/10 text-muted-foreground/50 border-border/20'}`}>
                    {tier.icon} {tier.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Referral */}
        {settings.referral?.enabled && (
          <div className="glass-card mb-4 !rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Gift size={15} /> แนะนำเพื่อน</h2>
            <p className="text-[10px] text-muted-foreground">แชร์รหัสด้านล่างให้เพื่อน เมื่อเพื่อนสมัครคุณจะได้รับรางวัล {settings.referral.rewardType === "credit" ? `฿${settings.referral.referrerReward}` : `${settings.referral.referrerReward}%`}</p>
            <div className="flex items-center gap-2">
              <input type="text" value={user.uid} readOnly className={`${inputCls} font-mono text-[10px]`} />
              <button onClick={() => { navigator.clipboard.writeText(user.uid); toast.success("คัดลอกรหัสแนะนำแล้ว"); }} className="btn-glass px-3 py-3 shrink-0">
                <Copy size={14} />
              </button>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <span className="text-xs text-muted-foreground">แนะนำไปแล้ว</span>
              <span className="text-sm font-bold text-primary">{referralCount} / {settings.referral.maxReferrals} คน</span>
            </div>
            <Link to="/referral" className="flex items-center justify-between p-2.5 rounded-xl bg-muted/10 border border-border/20 hover:border-primary/30 transition-all group">
              <span className="text-xs font-semibold text-foreground">ดู Dashboard แนะนำเพื่อน</span>
              <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          </div>
        )}

        <Link to="/wheel-history" className="glass-card !rounded-2xl flex items-center justify-between hover:border-primary/40 transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <Trophy size={18} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">ประวัติการหมุนวงล้อ</div>
              <div className="text-[11px] text-muted-foreground">ดูรางวัล วันที่ และสถานะตัดเครดิต/สต็อก</div>
            </div>
          </div>
          <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>

        <div className="glass-card !rounded-2xl">
          <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
            <KeyRound size={15} /> {isGoogleOnly ? "ตั้งรหัสผ่าน" : "เปลี่ยนรหัสผ่าน"}
          </h2>
          {isGoogleOnly && (
            <p className="text-[10px] text-amber-400 mb-3">🔑 คุณเข้าสู่ระบบผ่าน Google — ตั้งรหัสผ่านเพื่อใช้เข้าสู่ระบบด้วยอีเมลได้ (ยืนยันตัวตนผ่าน Google Popup)</p>
          )}
          <div className="space-y-3">
            {!isGoogleOnly && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">รหัสผ่านปัจจุบัน</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">{isGoogleOnly ? "รหัสผ่านใหม่ (6+ ตัวอักษร)" : "รหัสผ่านใหม่ (6+ ตัวอักษร)"}</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
            </div>
            <button onClick={handleChangePassword} disabled={changingPassword} className="btn-gradient w-full py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <KeyRound size={14} /> {changingPassword ? "กำลังดำเนินการ..." : isGoogleOnly ? "ตั้งรหัสผ่าน" : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfilePage;
