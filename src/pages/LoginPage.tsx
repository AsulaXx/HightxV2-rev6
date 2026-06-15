import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo.png";
import { LogIn, UserPlus, ArrowLeft, Mail, KeyRound, RefreshCw, CheckCircle, AlertTriangle, Gift, Link2, Shield, FileText, ScrollText } from "lucide-react";
import { checkRateLimit, formatRetryTime, resetRateLimit } from "@/lib/rateLimiter";
import { db, auth as firebaseAuth } from "@/lib/firebase";
import { doc, getDoc, setDoc, increment, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const LoginPage = () => {
  const location = useLocation();
  const redirectTo = (location.state as any)?.from?.pathname || "/";
  const { user, loading: authLoading, login, register, resetPassword, resendVerification, sendEmailLink, signInWithGoogle, isEmailVerified, logout } = useAuth();
  const { settings } = useSiteSettings();
  const initialMode = new URLSearchParams(location.search).get("mode") === "signup" ? "register" : "login";
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "verify" | "emaillink">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [showTos, setShowTos] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  // Handle email link sign-in callback
  useEffect(() => {
    if (isSignInWithEmailLink(firebaseAuth, window.location.href)) {
      let emailForSignIn = window.localStorage.getItem("emailForSignIn");
      if (!emailForSignIn) {
        emailForSignIn = window.prompt("กรุณากรอกอีเมลของคุณเพื่อยืนยัน") || "";
      }
      if (emailForSignIn) {
        signInWithEmailLink(firebaseAuth, emailForSignIn, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
          })
          .catch((err) => {
            console.error("Email link sign-in error:", err);
            setError("ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาลองใหม่");
          });
      }
    }
  }, []);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground text-sm">กำลังโหลด...</p></div>;

  // Block unverified users - show verify screen
  if (user && !isEmailVerified) {
    return (
      <div className="relative z-10 min-h-[80vh] flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card w-full max-w-sm !rounded-2xl text-center">
          <div className="mb-4">
            <Mail size={40} className="mx-auto text-warning mb-3" />
            <h1 className="text-xl font-bold gradient-text">ยืนยันอีเมลของคุณ</h1>
            <p className="text-muted-foreground text-xs mt-2">กรุณาตรวจสอบกล่องจดหมาย (รวมถึง Spam/Junk) แล้วคลิกลิงก์ยืนยันเพื่อเข้าใช้งาน</p>
          </div>
          <div className="space-y-3">
            <button
              onClick={async () => {
                try { await resendVerification(); }
                catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("LoginPage.resendVerification", err, "warn"); }
              }}
              className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2"
            >
              <RefreshCw size={15} /> ส่งอีเมลยืนยันอีกครั้ง
            </button>
            <button onClick={logout} className="btn-glass w-full py-3 text-xs flex items-center justify-center gap-2">
              <ArrowLeft size={15} /> ออกจากระบบ
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (user) return <Navigate to={redirectTo} replace />;

  const resetForm = () => { setEmail(""); setPassword(""); setConfirmPassword(""); setDisplayName(""); setReferralCode(""); setError(""); setSuccess(""); };
  const switchMode = (newMode: typeof mode) => { resetForm(); setMode(newMode); };

  const requireTosAcceptance = (action: () => Promise<void>) => {
    if (settings.tosContent?.trim()) {
      setPendingAction(() => action);
      setTosAccepted(false);
      setShowTos(true);
    } else {
      action();
    }
  };

  const handleTosAccept = () => {
    setShowTos(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const executeLogin = async () => {
    setError(""); setLoading(true);
    const rl = checkRateLimit("login");
    if (!rl.allowed) {
      setError(`ล็อกอินมากเกินไป กรุณารออีก ${formatRetryTime(rl.retryAfterMs)}`);
      setLoading(false);
      return;
    }
    try {
      await login(email, password);
      resetRateLimit("login");
    } catch (err: any) {
      console.error("Login error:", err.code, err.message);
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      else if (err.code === "auth/too-many-requests") setError("ล็อกอินผิดหลายครั้ง กรุณารอสักครู่");
      else if (err.code === "auth/network-request-failed") setError("ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต");
      else setError(`เกิดข้อผิดพลาด: ${err.code || err.message || "กรุณาลองใหม่"}`);
    } finally { setLoading(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    requireTosAcceptance(executeLogin);
  };


  const executeRegister = async () => {
    setError(""); setSuccess("");
    if (!displayName.trim()) { setError("กรุณากรอกชื่อที่แสดง"); return; }
    if (displayName.trim().length > 50) { setError("ชื่อที่แสดงต้องไม่เกิน 50 ตัวอักษร"); return; }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (password !== confirmPassword) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    setLoading(true);
    try {
      await register(email, password, displayName.trim());
      // Handle referral after registration
      if (referralCode.trim() && settings.referral?.enabled) {
        try {
          const { getAuth } = await import("firebase/auth");
          const currentUser = getAuth().currentUser;
          if (currentUser) {
            // Find referrer by checking users collection for matching referral code (uid-based)
            const referrerRef = doc(db, "users", referralCode.trim());
            const referrerSnap = await getDoc(referrerRef);
            if (referrerSnap.exists() && referralCode.trim() !== currentUser.uid) {
              const referrerData = referrerSnap.data();
              const referralCount = referrerData.referralCount || 0;
              if (referralCount < (settings.referral.maxReferrals || 50)) {
                if (settings.referral.rewardType === "credit") {
                  // Give credit to referrer
                  const referrerWalletRef = doc(db, "wallets", referralCode.trim());
                  const referrerWalletSnap = await getDoc(referrerWalletRef);
                  if (referrerWalletSnap.exists()) {
                    await setDoc(referrerWalletRef, { balance: increment(settings.referral.referrerReward) }, { merge: true });
                  } else {
                    await setDoc(referrerWalletRef, { balance: settings.referral.referrerReward, userId: referralCode.trim() });
                  }
                  await addDoc(collection(db, "walletTransactions"), { userId: referralCode.trim(), amount: settings.referral.referrerReward, description: `รางวัลแนะนำเพื่อน: ${displayName.trim()}`, type: "referral_reward", createdAt: serverTimestamp() });

                  // Give credit to referee
                  const refereeWalletRef = doc(db, "wallets", currentUser.uid);
                  await setDoc(refereeWalletRef, { balance: settings.referral.refereeReward, userId: currentUser.uid }, { merge: true });
                  await addDoc(collection(db, "walletTransactions"), { userId: currentUser.uid, amount: settings.referral.refereeReward, description: `รางวัลสมัครจากการแนะนำ`, type: "referral_bonus", createdAt: serverTimestamp() });
                }
                // Update referrer count
                await setDoc(referrerRef, { referralCount: increment(1) }, { merge: true });
                // Store referral info on new user
                await setDoc(doc(db, "users", currentUser.uid), { referredBy: referralCode.trim() }, { merge: true });
              }
            }
          }
        } catch (refErr) { console.error("Referral error:", refErr); }
      }
      setSuccess("สมัครสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยัน (หากไม่พบ ให้เช็คกล่องจดหมายขยะ/Spam)");
    }
    catch (err: any) {
      if (err.code === "auth/email-already-in-use") setError("อีเมลนี้ถูกใช้งานแล้ว");
      else if (err.code === "auth/weak-password") setError("รหัสผ่านไม่ปลอดภัยเพียงพอ");
      else if (err.code === "auth/invalid-email") setError("รูปแบบอีเมลไม่ถูกต้อง");
      else setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate before showing TOS
    if (!displayName.trim()) { setError("กรุณากรอกชื่อที่แสดง"); return; }
    if (displayName.trim().length > 50) { setError("ชื่อที่แสดงต้องไม่เกิน 50 ตัวอักษร"); return; }
    if (password.length < 6) { setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    if (password !== confirmPassword) { setError("รหัสผ่านไม่ตรงกัน"); return; }
    requireTosAcceptance(executeRegister);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess("");
    if (!email.trim()) { setError("กรุณากรอกอีเมล"); return; }
    setLoading(true);
    try { await resetPassword(email); setSuccess("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว (หากไม่พบ ให้เช็คกล่องจดหมายขยะ/Spam)"); }
    catch (err: any) {
      if (err.code === "auth/user-not-found") setError("ไม่พบบัญชีที่ใช้อีเมลนี้");
      else if (err.code === "auth/too-many-requests") setError("ส่งคำขอมากเกินไป กรุณารอสักครู่");
      else setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally { setLoading(false); }
  };

  const inputCls = "input-glass w-full px-4 py-3 text-xs";

  return (
    <div className="relative z-10 min-h-[80vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="glass-card w-full max-w-sm !rounded-2xl" key={mode}>
        <div className="text-center mb-6">
          <img src={logo} alt="Logo" className="w-12 h-12 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold gradient-text">
            {mode === "login" && "เข้าสู่ระบบ"}
            {mode === "register" && "สมัครสมาชิก"}
            {mode === "forgot" && "รีเซ็ตรหัสผ่าน"}
            {mode === "emaillink" && "เข้าสู่ระบบด้วยลิงก์"}
          </h1>
          <p className="text-muted-foreground text-xs mt-1.5">
            {mode === "login" && "เข้าสู่ระบบเพื่อเข้าถึงฟีเจอร์ทั้งหมด"}
            {mode === "register" && "สร้างบัญชีใหม่เพื่อเริ่มใช้งาน"}
            {mode === "forgot" && "กรอกอีเมลเพื่อรับลิงก์รีเซ็ต"}
            {mode === "emaillink" && "กรอกอีเมลเพื่อรับลิงก์เข้าสู่ระบบ ไม่ต้องใช้รหัสผ่าน"}
          </p>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">รหัสผ่าน</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" required />
            </div>
            {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl px-3 py-2 text-xs">{error}</div>}
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <LogIn size={15} /> {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <div className="relative flex items-center my-1">
              <div className="flex-grow border-t border-border/40"></div>
              <span className="px-3 text-[10px] text-muted-foreground">หรือ</span>
              <div className="flex-grow border-t border-border/40"></div>
            </div>

            <button type="button" onClick={() => {
              const executeGoogle = async () => {
                setError(""); setLoading(true);
                try { await signInWithGoogle(); }
                catch (err: any) {
                  if (err.code === "auth/popup-closed-by-user") { /* user cancelled */ }
                  else if (err.code === "auth/cancelled-popup-request") { /* duplicate popup */ }
                  else setError(`เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${err.code || err.message}`);
                } finally { setLoading(false); }
              };
              requireTosAcceptance(executeGoogle);
            }} className="btn-glass w-full py-3 text-xs flex items-center justify-center gap-2 hover:border-primary/40 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              เข้าสู่ระบบด้วย Google
            </button>

            <button type="button" onClick={() => switchMode("emaillink")} className="btn-glass w-full py-3 text-xs flex items-center justify-center gap-2 hover:border-primary/40 transition-colors">
              <Link2 size={15} /> เข้าสู่ระบบด้วยลิงก์อีเมล
            </button>

            <div className="flex flex-col items-center gap-1.5">
              <button type="button" onClick={() => switchMode("forgot")} className="text-[11px] text-muted-foreground hover:text-primary transition-colors">ลืมรหัสผ่าน?</button>
              <button type="button" onClick={() => switchMode("register")} className="text-xs text-primary hover:underline font-semibold">ยังไม่มีบัญชี? สมัครสมาชิก</button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ชื่อที่แสดง</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="ชื่อของคุณ" required maxLength={50} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">รหัสผ่าน (6+ ตัวอักษร)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" required minLength={6} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ยืนยันรหัสผ่าน</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} placeholder="••••••••" required minLength={6} />
            </div>
            {settings.referral?.enabled && (
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1"><Gift size={12} /> รหัสแนะนำ (ไม่บังคับ)</label>
                <input type="text" value={referralCode} onChange={(e) => setReferralCode(e.target.value.trim())} className={inputCls} placeholder="กรอก User ID ผู้แนะนำ" />
                <p className="text-[10px] text-muted-foreground mt-0.5">ทั้งคุณและผู้แนะนำจะได้รับรางวัล {settings.referral.rewardType === "credit" ? `฿${settings.referral.refereeReward}` : `${settings.referral.refereeReward}%`}</p>
              </div>
            )}
            {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl px-3 py-2 text-xs">{error}</div>}
            {success && <div className="bg-success/10 text-foreground border border-success/20 rounded-xl px-3 py-2 text-xs flex items-start gap-1.5"><CheckCircle size={13} className="shrink-0 mt-0.5 text-success" />{success}</div>}
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <UserPlus size={15} /> {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>

            <div className="relative flex items-center my-1">
              <div className="flex-grow border-t border-border/40"></div>
              <span className="px-3 text-[10px] text-muted-foreground">หรือ</span>
              <div className="flex-grow border-t border-border/40"></div>
            </div>

            <button type="button" onClick={() => {
              const executeGoogle = async () => {
                setError(""); setLoading(true);
                try { await signInWithGoogle(); }
                catch (err: any) {
                  if (err.code === "auth/popup-closed-by-user") { /* user cancelled */ }
                  else if (err.code === "auth/cancelled-popup-request") { /* duplicate popup */ }
                  else setError(`เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${err.code || err.message}`);
                } finally { setLoading(false); }
              };
              requireTosAcceptance(executeGoogle);
            }} className="btn-glass w-full py-3 text-xs flex items-center justify-center gap-2 hover:border-primary/40 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              สมัครด้วย Google
            </button>

            <div className="text-center">
              <button type="button" onClick={() => switchMode("login")} className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1">
                <ArrowLeft size={12} /> กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" required />
            </div>
            {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl px-3 py-2 text-xs">{error}</div>}
            {success && <div className="bg-success/10 text-foreground border border-success/20 rounded-xl px-3 py-2 text-xs flex items-start gap-1.5"><CheckCircle size={13} className="shrink-0 mt-0.5 text-success" />{success}</div>}
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <KeyRound size={15} /> {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => switchMode("login")} className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1">
                <ArrowLeft size={12} /> กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}

        {mode === "emaillink" && (
          <form onSubmit={async (e) => {
            e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
            try {
              await sendEmailLink(email);
              setSuccess("ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว! กรุณาตรวจสอบกล่องจดหมาย (หากไม่พบ ให้เช็คกล่องจดหมายขยะ/Spam)");
            } catch (err: any) {
              console.error("Email link error:", err);
              if (err.code === "auth/invalid-email") setError("รูปแบบอีเมลไม่ถูกต้อง");
              else if (err.code === "auth/too-many-requests") setError("ส่งคำขอมากเกินไป กรุณารอสักครู่");
              else setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
            } finally { setLoading(false); }
          }} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">อีเมล</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="example@email.com" required />
            </div>
            {error && <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl px-3 py-2 text-xs">{error}</div>}
            {success && <div className="bg-success/10 text-foreground border border-success/20 rounded-xl px-3 py-2 text-xs flex items-start gap-1.5"><CheckCircle size={13} className="shrink-0 mt-0.5 text-success" />{success}</div>}
            <button type="submit" disabled={loading} className="btn-gradient w-full py-3 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <Link2 size={15} /> {loading ? "กำลังส่ง..." : "ส่งลิงก์เข้าสู่ระบบ"}
            </button>
            <p className="text-[10px] text-muted-foreground text-center">ระบบจะส่งลิงก์ไปที่อีเมลของคุณ คลิกลิงก์เพื่อเข้าสู่ระบบโดยไม่ต้องใช้รหัสผ่าน</p>
            <div className="text-center">
              <button type="button" onClick={() => switchMode("login")} className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-1">
                <ArrowLeft size={12} /> กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {/* TOS Acceptance Dialog */}
      <Dialog open={showTos} onOpenChange={(open) => { if (!open) { setShowTos(false); setPendingAction(null); } }}>
        <DialogContent className="max-w-md !rounded-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ScrollText size={18} className="text-primary" />
              ข้อตกลงการใช้บริการ
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 -mr-1">
            <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed p-3 rounded-xl bg-muted/10 border border-border/15 max-h-[40vh] overflow-y-auto">
              {settings.tosContent || "ยังไม่มีข้อตกลงการใช้บริการ"}
            </div>
          </div>
          <div className="pt-3 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-primary text-primary focus:ring-primary"
              />
              <span className="text-xs text-foreground leading-relaxed">
                ฉันได้อ่านและยอมรับ{" "}
                <Link to="/terms" target="_blank" className="text-primary hover:underline font-semibold">ข้อตกลงการใช้บริการ</Link>
                {" "}แล้ว
              </span>
            </label>
            <DialogFooter className="gap-2">
              <button onClick={() => { setShowTos(false); setPendingAction(null); }} className="btn-glass px-4 py-2.5 text-xs">
                ยกเลิก
              </button>
              <button onClick={handleTosAccept} disabled={!tosAccepted} className="btn-gradient px-4 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckCircle size={13} /> ยอมรับและดำเนินการต่อ
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
