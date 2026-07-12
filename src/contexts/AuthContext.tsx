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
import { doc, getDoc, setDoc } from "firebase/firestore";

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
        const siteSettingsRef = doc(db, "siteSettings", "main");
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Partial<UserProfile> & { role?: string };
            // Check if user is banned
            if (data.banned) {
              await signOut(auth);
              setUser(null);
              setProfile(null);
              setLoading(false);
              alert(`บัญชีของคุณถูกระงับ${data.bannedReason ? `: ${data.bannedReason}` : ''}`);
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
           // Always clear pending login flag after auth state settles —
           // prevents a stale `true` from firing a fake login webhook on next refresh
           // when the previous Firestore profile load failed.
           pendingLoginWebhookRef.current = false;
         }
         setUser(firebaseUser);
         // Bridge Firebase session → Supabase Auth (fire-and-forget; storage
         // uploads await the same promise via getSupabaseUploadPrefix).
         syncSupabaseSession(true).catch((err) => logError("AuthContext.syncSupabase", err));
      } else {
        setUser(null);
        setProfile(null);
        clearSupabaseSession();
      }
      setLoading(false);
    });
    return unsubscribe;
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
      const siteSettingsRef = doc(db, "siteSettings", "main");
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
    </AuthContext.Provider>
  );
};
