import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { logActivity } from "@/lib/activityLogger";
import { sendWebhook, getClientInfo, parseUserAgent } from "@/lib/webhookSender";
import { loginEmbed, signupEmbed, maskEmail, maskIp, isPiiMaskingEnabled } from "@/lib/webhookTemplates";
import { logError } from "@/lib/errorLogger";
import { syncSupabaseSession, clearSupabaseSession } from "@/lib/supabaseSync";

import {
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  User, 
  updateProfile, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { AlertTriangle, Ban } from "lucide-react";

export type UserRole = "owner" | "admin" | "moderator" | "reseller" | "hightxcrew" | "vip" | "user";

export const ROLE_HIERARCHY: UserRole[] = ["owner", "admin", "moderator", "reseller", "hightxcrew", "vip", "user"];

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "👑 Owner",
  admin: "🛡️ Admin",
  moderator: "⚔️ Moderator",
  reseller: "💎 Reseller",
  hightxcrew: "🔥 HightXCrew",
  vip: "⭐ VIP",
  user: "👤 Member",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  owner: "from-yellow-400 to-amber-600",
  admin: "from-red-400 to-rose-600",
  moderator: "from-blue-400 to-indigo-600",
  reseller: "from-emerald-400 to-teal-600",
  hightxcrew: "from-orange-400 to-red-500",
  vip: "from-purple-400 to-violet-600",
  user: "from-gray-400 to-slate-500",
};

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  owner: "bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/30",
  admin: "bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border-red-500/30",
  moderator: "bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30",
  reseller: "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30",
  hightxcrew: "bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/30",
  vip: "bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30",
  user: "bg-muted/30 text-muted-foreground border-border/30",
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
}

const normalizeUserRole = (role: unknown): UserRole => {
  const roleValue = typeof role === "string" ? role.toLowerCase().trim() : "";
  return ROLE_HIERARCHY.includes(roleValue as UserRole) ? (roleValue as UserRole) : "user";
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  hasPermission: (requiredRole: UserRole) => boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  resetPassword: async () => {},
  resendVerification: async () => {},
  sendEmailLink: async () => {},
  signInWithGoogle: async () => {},
  hasPermission: () => false,
  isEmailVerified: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Track whether current auth change is from an actual login action (not page refresh)
  const pendingLoginWebhookRef = useRef(false);

  // Helper: send login webhook (fire-and-forget)
  const fireLoginWebhook = (userProfile: UserProfile, method: string = "Email/Password") => {
    (async () => {
      try {
        const siteSettingsRef = doc(db, "settings", "site");
        const siteSettingsSnap = await getDoc(siteSettingsRef);
        if (!siteSettingsSnap.exists()) return;

        const siteSettings = siteSettingsSnap.data();
        const clientInfo = await getClientInfo();
        const mask = isPiiMaskingEnabled(siteSettings);
        await sendWebhook(siteSettings, "login", [loginEmbed({
          userName: userProfile.displayName || "-",
          email: mask ? maskEmail(userProfile.email || "-") : (userProfile.email || "-"),
          role: userProfile.role || "user",
          method,
          deviceInfo: parseUserAgent(clientInfo.userAgent),
          ip: `\`${mask ? maskIp(clientInfo.ip) : clientInfo.ip}\``,
          brandName: siteSettings.brandName || "System",
        })]);
      } catch (err) { logError("fireLoginWebhook", err); }
    })();
  };

  // Popup state for ban notification (replaces window.alert + adds real-time kick)
  const [bannedInfo, setBannedInfo] = useState<{ reason: string } | null>(null);
  const banListenerRef = useRef<null | (() => void)>(null);

  const forceSignOutBanned = async (reason: string) => {
    setBannedInfo({ reason: reason || "ไม่ระบุเหตุผล" });
    try { await signOut(auth); } catch (err) { logError("AuthContext.forceSignOutBanned", err); }
    setUser(null);
    setProfile(null);
    clearSupabaseSession();
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down previous real-time ban listener on any auth change
      if (banListenerRef.current) { banListenerRef.current(); banListenerRef.current = null; }

      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Partial<UserProfile> & { role?: string };
            // Check if user is banned
            if (data.banned) {
              await forceSignOutBanned(data.bannedReason || "");
              return;
            }
            const normalizedProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: data.email || firebaseUser.email || "",
              displayName: data.displayName || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
              role: normalizeUserRole(data.role),
              banned: data.banned || false,
              bannedReason: data.bannedReason || "",
            };
            setProfile(normalizedProfile);
            await setDoc(docRef, normalizedProfile, { merge: true });
            
            // Only fire login webhook if this was an actual login action (not page refresh)
            if (pendingLoginWebhookRef.current) {
              pendingLoginWebhookRef.current = false;
              fireLoginWebhook(normalizedProfile, "Email/Password");
            }

          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
              role: "user",
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
          } catch (err) {
           logError("AuthContext.loadProfile", err);
           setProfile({
             uid: firebaseUser.uid,
             email: firebaseUser.email || "",
             displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
             role: "user",
           });
         } finally {
           pendingLoginWebhookRef.current = false;
         }
         setUser(firebaseUser);
         // Reuse existing Supabase session if still valid (page refresh);
         // only mint a fresh one when none exists (fresh login).
         syncSupabaseSession(false).catch((err) => logError("AuthContext.syncSupabase", err));

         // Real-time ban listener — kicks user out instantly when admin bans them
         try {
           const liveRef = doc(db, "users", firebaseUser.uid);
           banListenerRef.current = onSnapshot(liveRef, (snap) => {
             if (!snap.exists()) return;
             const d = snap.data() as Partial<UserProfile>;
             if (d.banned && auth.currentUser?.uid === firebaseUser.uid) {
               forceSignOutBanned(d.bannedReason || "");
             }
           }, (err) => logError("AuthContext.banListener", err));
         } catch (err) { logError("AuthContext.banListener.setup", err); }
      } else {
        setUser(null);
        setProfile(null);
        clearSupabaseSession();
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (banListenerRef.current) { banListenerRef.current(); banListenerRef.current = null; }
    };
  }, []);


  const login = async (email: string, password: string) => {
    pendingLoginWebhookRef.current = true;
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    try { await updateProfile(cred.user, { displayName }); } catch (err) { logError("register.updateProfile", err); }
    // Send verification email (don't let failure block signup webhook)
    try { await sendEmailVerification(cred.user); } catch (err) { logError("register.sendEmailVerification", err); }
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName,
      role: "user",
    };
    await setDoc(doc(db, "users", cred.user.uid), newProfile);
    setProfile(newProfile);
    try { await logActivity(cred.user, newProfile, "user_register", `สมัครสมาชิกใหม่: ${displayName}`); } catch (err) { logError("register.logActivity", err); }
    
    // Signup webhook
    try {
      const siteSettingsRef = doc(db, "settings", "site");

      const siteSettingsSnap = await getDoc(siteSettingsRef);
      if (siteSettingsSnap.exists()) {
        const siteSettings = siteSettingsSnap.data();
        const clientInfo = await getClientInfo();
        const mask = isPiiMaskingEnabled(siteSettings);
        await sendWebhook(siteSettings, "signup", [signupEmbed({
          userName: displayName || "-",
          email: mask ? maskEmail(email || "-") : (email || "-"),
          method: "Email + Password",
          deviceInfo: parseUserAgent(clientInfo.userAgent),
          ip: `\`${mask ? maskIp(clientInfo.ip) : clientInfo.ip}\``,
          timezone: clientInfo.timezone,
          language: clientInfo.language,
          screenSize: clientInfo.screenSize,
          referrer: document.referrer || undefined,
          brandName: siteSettings.brandName || "System",
          fieldsEnabled: siteSettings.signupEmbedFields,
        })]);
      }
    } catch (err) { logError("register.signupWebhook", err); }
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const sendEmailLink = async (email: string) => {
    const actionCodeSettings = {
      url: window.location.origin + "/login",
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    // Check/create profile in Firestore
    const docRef = doc(db, "users", firebaseUser.uid);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "",
        role: "user",
      };
      await setDoc(docRef, newProfile);
      setProfile(newProfile);
      try { await logActivity(firebaseUser, newProfile, "user_register", `สมัครสมาชิกใหม่ (Google): ${newProfile.displayName}`); } catch (err) { logError("googleSignup.logActivity", err); }
      
      // Signup webhook for Google
      try {
        const siteSettingsRef = doc(db, "siteSettings", "main");
        const siteSettingsSnap = await getDoc(siteSettingsRef);
        if (siteSettingsSnap.exists()) {
          const siteSettings = siteSettingsSnap.data();
          const clientInfo = await getClientInfo();
          const mask = isPiiMaskingEnabled(siteSettings);
          await sendWebhook(siteSettings, "signup", [signupEmbed({
            userName: newProfile.displayName || "-",
            email: mask ? maskEmail(newProfile.email || "-") : (newProfile.email || "-"),
            method: "Google OAuth",
            deviceInfo: parseUserAgent(clientInfo.userAgent),
            ip: `\`${mask ? maskIp(clientInfo.ip) : clientInfo.ip}\``,
            timezone: clientInfo.timezone,
            language: clientInfo.language,
            screenSize: clientInfo.screenSize,
            referrer: document.referrer || undefined,
            brandName: siteSettings.brandName || "System",
            fieldsEnabled: siteSettings.signupEmbedFields,
          })]);
        }
      } catch (err) { logError("googleSignup.webhook", err); }
    } else {
      // Existing user logging in via Google — fire login webhook
      const data = docSnap.data() as Partial<UserProfile>;
      const existingProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: data.email || firebaseUser.email || "",
        displayName: data.displayName || firebaseUser.displayName || "",
        role: normalizeUserRole(data.role),
      };
      fireLoginWebhook(existingProfile, "Google Sign-In");
    }
  };

  const hasPermission = (requiredRole: UserRole): boolean => {
    if (!profile) return false;
    const userRole = normalizeUserRole(profile.role);
    const userIndex = ROLE_HIERARCHY.indexOf(userRole);
    const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
    if (userIndex < 0 || requiredIndex < 0) return false;
    return userIndex <= requiredIndex;
  };

  const isEmailVerified = user?.emailVerified ?? false;

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, resetPassword, resendVerification, sendEmailLink, signInWithGoogle, hasPermission, isEmailVerified }}>
      {children}
      {bannedInfo && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-card !p-6 !rounded-2xl max-w-sm w-full border border-destructive/30 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mb-3 ring-1 ring-destructive/30">
                <Ban size={28} className="text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground">บัญชีของคุณถูกระงับ</h2>
              <p className="text-xs text-muted-foreground mt-1">
                คุณถูกดีดออกจากระบบโดยอัตโนมัติ
              </p>
              <div className="mt-4 w-full p-3 rounded-lg bg-destructive/5 border border-destructive/15 text-left">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground break-words">{bannedInfo.reason}</p>
                </div>
              </div>
              <button
                onClick={() => setBannedInfo(null)}
                className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold bg-destructive/90 hover:bg-destructive text-destructive-foreground transition-colors"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
