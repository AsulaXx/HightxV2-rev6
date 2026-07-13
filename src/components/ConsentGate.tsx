import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, Shield, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { logConsent } from "@/lib/consentLogger";
import { toast } from "sonner";

/**
 * Blocks the app with a re-consent modal when the current published
 * termsVersion / privacyVersion is higher than what the user last accepted.
 * Records an audit trail to consentLogs on accept.
 */
const ConsentGate = ({ children }: { children: React.ReactNode }) => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const [accepting, setAccepting] = useState(false);
  const [checkedTos, setCheckedTos] = useState(false);
  const [checkedPrivacy, setCheckedPrivacy] = useState(false);
  // Local optimistic accept (AuthContext doesn't live-subscribe to profile changes)
  const [localAccepted, setLocalAccepted] = useState<{ t: number; p: number } | null>(null);

  const s = settings as any;
  const p = profile as any;
  const currentTermsV = Number(s.termsVersion || 1);
  const currentPrivacyV = Number(s.privacyVersion || 1);

  // LocalStorage cache: once accepted on this device, don't re-ask until the
  // published version bumps (survives reloads even before profile refetch).
  const lsKey = user ? `consent:${user.uid}` : null;
  const readLS = (): { t: number; p: number } => {
    if (!lsKey) return { t: 0, p: 0 };
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return { t: 0, p: 0 };
      const j = JSON.parse(raw);
      return { t: Number(j.t || 0), p: Number(j.p || 0) };
    } catch { return { t: 0, p: 0 }; }
  };
  const lsAccepted = readLS();

  const acceptedTermsV = Math.max(
    Number(p?.acceptedTermsVersion || 0),
    localAccepted?.t || 0,
    lsAccepted.t
  );
  const acceptedPrivacyV = Math.max(
    Number(p?.acceptedPrivacyVersion || 0),
    localAccepted?.p || 0,
    lsAccepted.p
  );

  // Reset local accept when user changes (logout/login)
  useEffect(() => {
    setLocalAccepted(null);
  }, [user?.uid]);

  const needsAccept = !!user && !!profile && (acceptedTermsV < currentTermsV || acceptedPrivacyV < currentPrivacyV);
  const isFirstTime = Number(p?.acceptedTermsVersion || 0) === 0 && lsAccepted.t === 0 && !localAccepted;

  // Reset checkboxes each time modal reopens
  useEffect(() => {
    if (needsAccept) {
      setCheckedTos(false);
      setCheckedPrivacy(false);
    }
  }, [needsAccept]);

  const handleAccept = async () => {
    if (!user || !checkedTos || !checkedPrivacy) return;
    setAccepting(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        acceptedTermsVersion: currentTermsV,
        acceptedPrivacyVersion: currentPrivacyV,
        acceptedAt: serverTimestamp(),
        email: user.email || "",
        uid: user.uid,
      }, { merge: true });
      // Optimistically hide the modal — AuthContext doesn't watch profile changes live
      setLocalAccepted({ t: currentTermsV, p: currentPrivacyV });
      // Persist so reloads/re-logins on this device don't re-prompt until next version bump
      if (lsKey) {
        try { localStorage.setItem(lsKey, JSON.stringify({ t: currentTermsV, p: currentPrivacyV })); } catch {}
      }
      logConsent({
        userId: user.uid,
        userEmail: user.email || "",
        type: "both",
        termsVersion: currentTermsV,
        privacyVersion: currentPrivacyV,
      }).catch((e) => console.error("consent log failed:", e));
      toast.success("บันทึกการยอมรับข้อตกลงสำเร็จ");
    } catch (err) {
      console.error(err);
      toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <>
      {children}
      <AnimatePresence>
        {needsAccept && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="glass-card !rounded-2xl max-w-lg w-full p-6 sm:p-8"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Shield size={22} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {isFirstTime ? "ยินดีต้อนรับ" : "ข้อตกลงมีการอัปเดต"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isFirstTime
                      ? "กรุณาอ่านและยอมรับข้อตกลงก่อนใช้งาน"
                      : `ข้อตกลง/นโยบายมีการอัปเดตเป็นเวอร์ชันใหม่ (TOS v${currentTermsV} / Privacy v${currentPrivacyV})`}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 mb-5">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors border border-border/30">
                  <input
                    type="checkbox"
                    checked={checkedTos}
                    onChange={(e) => setCheckedTos(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                  />
                  <div className="flex-1 text-xs text-foreground">
                    ฉันได้อ่านและยอมรับ{" "}
                    <Link to="/terms?tab=tos" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                      <FileText size={11} /> ข้อตกลงการใช้บริการ (v{currentTermsV})
                    </Link>
                  </div>
                </label>
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors border border-border/30">
                  <input
                    type="checkbox"
                    checked={checkedPrivacy}
                    onChange={(e) => setCheckedPrivacy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary shrink-0"
                  />
                  <div className="flex-1 text-xs text-foreground">
                    ฉันได้อ่านและยอมรับ{" "}
                    <Link to="/terms?tab=privacy" target="_blank" className="text-primary hover:underline inline-flex items-center gap-1">
                      <Shield size={11} /> นโยบายความเป็นส่วนตัว (v{currentPrivacyV})
                    </Link>
                  </div>
                </label>
              </div>

              <button
                onClick={handleAccept}
                disabled={!checkedTos || !checkedPrivacy || accepting}
                className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 size={16} />
                {accepting ? "กำลังบันทึก..." : "ยอมรับและใช้งานต่อ"}
              </button>

              <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
                การกดยอมรับจะถูกบันทึกไว้ (IP + เวลา) เพื่อการตรวจสอบตาม PDPA/GDPR
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ConsentGate;
