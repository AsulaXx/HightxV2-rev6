import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Wallet, Upload, CheckCircle, XCircle, History, X, CreditCard, ArrowRight, AlertTriangle, Ban, Copy, Check, Smartphone, Gift, Info, CircleCheck, Megaphone, Bell } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import TopUpBankSlip from "@/components/topup/TopUpBankSlip";
import TopUpTrueWallet from "@/components/topup/TopUpTrueWallet";
import TopUpVoucher from "@/components/topup/TopUpVoucher";
import TopUpGiftCode from "@/components/topup/TopUpGiftCode";
import TopUpQR from "@/components/topup/TopUpQR";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, query, where, getDocs, limit, runTransaction } from "firebase/firestore";
import { applyLedger, generateAttemptId } from "@/lib/walletLedger";
import { toast } from "sonner";
import { checkRateLimit, formatRetryTime } from "@/lib/rateLimiter";
import { logActivity } from "@/lib/activityLogger";
import { supabase } from "@/integrations/supabase/client";
import { parseUserAgent, sendWebhook } from "@/lib/webhookSender";
import { invalidateCache } from "@/lib/firestoreCache";
import { logError, getErrorMessage } from "@/lib/errorLogger";
import { useNotifications } from "@/components/NotificationPanel";
import {
  topUpSuccessEmbed,
  topUpTrueWalletSuccessEmbed,
  duplicateSlipEmbed,
  wrongAccountBankEmbed,
  wrongAccountTrueWalletEmbed,
  topUpQrSuccessEmbed,
  giftCodeRedeemEmbed,
} from "@/lib/webhookTemplates";

// Hooks
import { useSlipFile } from "@/hooks/useSlipFile";
import { useTopUpWallet, type TopUpRecord } from "@/hooks/useTopUpWallet";
import { useTopUpHelpers } from "@/hooks/useTopUpHelpers";
import { safeAddTopUpHistory, flushTopUpHistoryQueue } from "@/lib/topUpHistory";

interface SlipData {
  transRef: string;
  date: string;
  amount: number;
  fee: number;
  sender: { name: string; bank: string; account: string };
  receiver: { name: string; bank: string; account: string };
  isDuplicate: boolean;
}

const imageAttachment = (prefix: string, dataUrl?: string | null) => {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const contentType = dataUrl.match(/^data:([^;]+);/)?.[1] || "image/png";
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return { name: `${prefix}-${Date.now()}.${ext}`, contentType, dataUrl };
};

const TopUpPage = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();

  const topUpSettings = settings.topUp || { enabled: true, bankSlipEnabled: true, truewalletEnabled: true, voucherEnabled: true, giftCodeEnabled: false, truewalletFeeEnabled: false, truewalletFeePercent: 2.9, minTopUp: 0, maxTopUp: 0, qrEnabled: false, qrProvider: 'plernpay', qrPromptPayTarget: '' };
  const { addNotification } = useNotifications();

  // Custom hooks
  const bankSlip = useSlipFile();
  const truewalletSlip = useSlipFile();
  const wallet = useTopUpWallet(user?.uid);
  const { userDisplay, logSlipVerification, checkAndAutoBan } = useTopUpHelpers(user, profile, settings);

  // Local state
  const getDefaultMode = (): "bank" | "truewallet" | "voucher" | "giftcode" | "qr" => {
    if (topUpSettings.bankSlipEnabled) return "bank";
    if (topUpSettings.qrEnabled) return "qr";
    if (topUpSettings.truewalletEnabled) return "truewallet";
    if (topUpSettings.voucherEnabled) return "voucher";
    if (topUpSettings.giftCodeEnabled) return "giftcode";
    return "bank";
  };

  const [topUpMode, setTopUpMode] = useState<"bank" | "truewallet" | "voucher" | "giftcode" | "qr">(getDefaultMode());
  const [voucherUrl, setVoucherUrl] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verifyLockRef = useRef(false);
  const giftCodeLockRef = useRef(false);
  const [verifyResult, setVerifyResult] = useState<SlipData | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [giftCodeInput, setGiftCodeInput] = useState("");
  const [redeemingGiftCode, setRedeemingGiftCode] = useState(false);
  const [slipPayload, setSlipPayload] = useState("");

  const webhookMeta = {
    userName: profile?.displayName || user?.displayName || user?.email || "-",
    userEmail: user?.email || "-",
    deviceInfo: typeof navigator !== "undefined"
      ? `${parseUserAgent(navigator.userAgent)} • ${navigator.platform || "Unknown"}`
      : "Unknown",
  };

  const topUpWebhookOptions = (event: string, transRef: string, attachment?: ReturnType<typeof imageAttachment> | null) => ({
    dedupeKey: `topup:${event}:${transRef || "-"}:${user?.uid || "-"}`,
    ...(attachment ? { attachments: [attachment] } : {}),
  });

  // Phase 5: Only Thunder + PlernPay are supported. Legacy provider settings are ignored.
  const activeSlipProvider = 'thunder' as const;
  const activeTrueWalletProvider = 'thunder' as const;
  const slip2goMode = false;
  const bankIsQr = false;
  const providerLabel = (p: string) => (({ thunder: 'Thunder', plernpay: 'PlernPay' } as Record<string,string>)[p] || p);

  if (!user) return <RedirectToLogin />;
  if (!topUpSettings.enabled) return (
    <div className="relative z-10 max-w-2xl mx-auto px-4 py-20 text-center">
      <Wallet size={48} className="mx-auto text-muted-foreground/30 mb-4" />
      <h2 className="text-lg font-bold text-foreground mb-2">ระบบเติมเงินปิดอยู่</h2>
      <p className="text-sm text-muted-foreground">ระบบเติมเงินถูกปิดชั่วคราว กรุณาติดต่อ Admin</p>
      <Link to="/" className="btn-glass px-4 py-2 text-sm mt-4 inline-block">กลับหน้าหลัก</Link>
    </div>
  );

  const resetAll = () => {
    bankSlip.reset();
    truewalletSlip.reset();
    setVoucherUrl("");
    setSlipPayload("");
    setVerifyResult(null);
    setVerifyError(null);
  };

  // ───────────────── BANK SLIP VERIFY ─────────────────
  const verifySlip = async () => {
    if (verifyLockRef.current) return;
    if (slip2goMode) {
      if (!slipPayload.trim()) { toast.error("กรุณาวาง QR payload ก่อน"); return; }
    } else {
      if (!bankSlip.slipImage) { toast.error("กรุณาอัปโหลดรูปสลิปก่อน"); return; }
    }
    const rl = checkRateLimit("topup", user?.uid);
    if (!rl.allowed) { toast.error(`เติมเงินบ่อยเกินไป กรุณารออีก ${formatRetryTime(rl.retryAfterMs)}`); return; }

    verifyLockRef.current = true;
    setVerifying(true); setVerifyResult(null); setVerifyError(null);

    try {
      const { getIdToken } = await import("@/lib/firebaseIdToken");
      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke('verify-slip', {
        body: {
          provider: activeSlipProvider,
          base64: slip2goMode ? undefined : bankSlip.slipImage,
          payload: slip2goMode ? slipPayload.trim() : undefined,
          checkDuplicate: true,
          matchAccount: true,
          // SECURITY: thunderApiKey is server-side only (Deno.env.THUNDER_API_KEY).
          idToken,
        },
      });
      if (error) throw new Error(error.message);
      if (!data.success) { const errMsg = data.error?.message || data.error || "ตรวจสอบสลิปไม่สำเร็จ"; setVerifyError(errMsg); toast.error(errMsg); return; }

      const raw = data.data.rawSlip;
      const slipData: SlipData = {
        transRef: raw.transRef, date: raw.date, amount: raw.amount?.amount || 0, fee: raw.fee || 0,
        sender: { name: raw.sender?.account?.name?.th || raw.sender?.account?.name?.en || "-", bank: raw.sender?.bank?.short || raw.sender?.bank?.name || "-", account: raw.sender?.account?.bank?.account || raw.sender?.account?.proxy?.account || "-" },
        receiver: { name: raw.receiver?.account?.name?.th || raw.receiver?.account?.name?.en || "-", bank: raw.receiver?.bank?.short || raw.receiver?.bank?.name || "-", account: raw.receiver?.account?.bank?.account || raw.receiver?.account?.proxy?.account || "-" },
        isDuplicate: data.data.isDuplicate || false,
      };
      setVerifyResult(slipData);
      const bankSlipAttachment = imageAttachment("bank-slip", bankSlip.slipImage);

      // Helper: send duplicate webhook
      const sendDuplicateWebhook = async (source: string) => {
        try {
          await sendWebhook(settings, "topUp", [duplicateSlipEmbed({
            userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef,
            channel: "สลิปธนาคาร", source, senderInfo: `${slipData.sender.bank} - ${slipData.sender.name}`,
            senderName: slipData.sender.name, senderBank: slipData.sender.bank,
            receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank,
            date: slipData.date, brandName: settings.brandName,
            slipAttachmentName: bankSlipAttachment?.name,
          })], topUpWebhookOptions("duplicate", slipData.transRef, bankSlipAttachment));
        } catch (err) { logError("bank.duplicateWebhook", err); }
      };

      // LOCAL TRANSREF DUPLICATE CHECK (Firestore)
      try {
        const dupQuery = query(collection(db, "topUpHistory"), where("transRef", "==", slipData.transRef), where("status", "==", "success"), limit(1));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          const errMsg = "สลิปนี้เคยถูกใช้เติมเงินในระบบแล้ว (ตรวจพบโดยระบบภายใน)";
          setVerifyError(errMsg); toast.error("สลิปนี้เคยถูกใช้แล้ว!");
          await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp(), method: "bank" });
          await logSlipVerification({ method: "bank", result: "duplicate", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, errorMessage: errMsg, slipImage: bankSlip.slipImage });
          await sendDuplicateWebhook("ระบบภายใน (Firestore)");
          await checkAndAutoBan(user.uid, userDisplay, errMsg);
          wallet.loadHistory(); return;
        }
      } catch (dupErr) { logError("bank.localDedup", dupErr); }

      // DUAL-LAYER RECEIVER ACCOUNT VERIFICATION
      {
        const verificationErrors: string[] = [];
        const thunderMatchedAccount = data.data.matchedAccount;
        if (thunderMatchedAccount === null) verificationErrors.push("Thunder API: ไม่พบบัญชีปลายทางในรายการ Whitelist");

        const allConfiguredAccounts: string[] = [];
        const legacyAccount = (settings.matchReceiverAccount || '').replace(/\D/g, '');
        if (legacyAccount.length >= 4) allConfiguredAccounts.push(legacyAccount);
        (settings.matchReceiverAccounts || []).forEach((acc: any) => { const num = (acc.accountNumber || '').replace(/\D/g, ''); if (num.length >= 4) allConfiguredAccounts.push(num); });

        let localAccountMatch = true;
        let localNameMatch = true;

        if (allConfiguredAccounts.length > 0) {
          const receiverBankAcc = (raw.receiver?.account?.bank?.account || '').replace(/\D/g, '');
          const receiverProxyAcc = (raw.receiver?.account?.proxy?.account || '').replace(/\D/g, '');
          const receiverMerchantId = (raw.receiver?.merchantId || '').replace(/\D/g, '');

          const strictMatch = (slipAcc: string, configAcc: string): boolean => {
            if (!slipAcc || slipAcc.length < 4 || configAcc.length < 4) return false;
            const minLen = Math.min(slipAcc.length, configAcc.length, 6);
            return slipAcc.slice(-minLen) === configAcc.slice(-minLen) || configAcc.includes(slipAcc) || slipAcc.includes(configAcc);
          };

          localAccountMatch = allConfiguredAccounts.some(configured =>
            strictMatch(receiverBankAcc, configured) || strictMatch(receiverProxyAcc, configured) || strictMatch(receiverMerchantId, configured)
          );
          if (!localAccountMatch) verificationErrors.push(`เลขบัญชีปลายทางไม่ตรง (สลิป: ${slipData.receiver.account}, ร้าน: ${allConfiguredAccounts.join(', ')})`);
        }

        const configuredName = (settings.matchReceiverName || '').trim().toLowerCase();
        if (configuredName.length >= 2) {
          const receiverNameTh = (raw.receiver?.account?.name?.th || '').toLowerCase();
          const receiverNameEn = (raw.receiver?.account?.name?.en || '').toLowerCase();
          const nameWords = configuredName.split(/\s+/).filter((w: string) => w.length >= 2);
          localNameMatch = nameWords.some((word: string) => receiverNameTh.includes(word) || receiverNameEn.includes(word));
          if (!localNameMatch) verificationErrors.push(`ชื่อผู้รับไม่ตรง (สลิป: ${slipData.receiver.name}, ร้าน: ${settings.matchReceiverName})`);
        }

        const hasLocalConfig = allConfiguredAccounts.length > 0 || configuredName.length >= 2;
        const localFailed = !localAccountMatch || !localNameMatch;
        const thunderFailed = thunderMatchedAccount === null;
        const shouldReject = (hasLocalConfig && localFailed) || thunderFailed;

        if (shouldReject && verificationErrors.length > 0) {
          const errMsg = `บัญชีปลายทางไม่ตรง — ${verificationErrors.join(' | ')} — โอนไปยัง ${slipData.receiver.bank} ${slipData.receiver.name} (${slipData.receiver.account})`;
          setVerifyError(errMsg); toast.error("❌ สลิปนี้ไม่ได้โอนเข้าบัญชีร้าน!");
          await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "failed", error: errMsg, slipData, createdAt: serverTimestamp(), method: "bank" });
          await logSlipVerification({ method: "bank", result: "failed", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, errorMessage: errMsg, slipImage: bankSlip.slipImage });
          try {
            await sendWebhook(settings, "topUp", [wrongAccountBankEmbed({
              userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef,
              senderBank: slipData.sender.bank, senderName: slipData.sender.name,
              receiverBank: slipData.receiver.bank, receiverName: slipData.receiver.name, receiverAccount: slipData.receiver.account,
              channel: "สลิปธนาคาร", date: slipData.date,
              reasons: verificationErrors,
              thunderMatch: thunderMatchedAccount ? `✅ ${thunderMatchedAccount.nameTh || thunderMatchedAccount.nameEn}` : "❌ ไม่พบใน Whitelist",
              localAccounts: allConfiguredAccounts.length > 0 ? allConfiguredAccounts.join(', ') : undefined,
              brandName: settings.brandName,
              slipAttachmentName: bankSlipAttachment?.name,
            })], topUpWebhookOptions("wrong-account", slipData.transRef, bankSlipAttachment));
          } catch (err) { logError("bank.wrongAccountWebhook", err); }
          await checkAndAutoBan(user.uid, userDisplay, errMsg);
          wallet.loadHistory(); return;
        }
      }

      // Check duplicate from Thunder API
      if (slipData.isDuplicate) {
        setVerifyError("สลิปนี้เคยถูกใช้แล้ว (Thunder API)"); toast.error("สลิปนี้เคยถูกใช้แล้ว");
        await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp() });
        await sendDuplicateWebhook("Thunder API");
        await logSlipVerification({ method: "bank", result: "duplicate", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, slipImage: bankSlip.slipImage });
        wallet.loadHistory(); return;
      }

      // Add balance via atomic ledger
      const bankAttemptId = generateAttemptId("bank");
      try {
        await applyLedger({
          userId: user.uid, userEmail: user.email, userName: userDisplay,
          amount: slipData.amount, type: "topup_bank",
          description: `เติมเงินผ่านสลิปธนาคาร (Ref: ${slipData.transRef})`,
          refId: slipData.transRef, method: "bank",
          requireUniqueRefId: true,
          meta: { attemptId: bankAttemptId, transRef: slipData.transRef, sender: slipData.sender, receiver: slipData.receiver },
        });
      } catch (e: any) {
        if (e?.code === "DUPLICATE_REF" || e?.message === "DUPLICATE_REF") {
          const errMsg = "สลิปนี้เคยถูกใช้เติมเงินแล้ว (atomic guard)";
          setVerifyError(errMsg); toast.error("สลิปนี้เคยถูกใช้แล้ว!");
          await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp(), method: "bank" });
          await sendDuplicateWebhook("Atomic guard");
          wallet.loadHistory(); return;
        }
        throw e;
      }

      await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "success", slipData, attemptId: bankAttemptId, createdAt: serverTimestamp(), method: "bank" });
      await logActivity(user, profile, "topup", `เติมเงิน ฿${slipData.amount.toLocaleString()} (Ref: ${slipData.transRef})`);

      try {
        await sendWebhook(settings, "topUp", [topUpSuccessEmbed({
          userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef,
          senderBank: slipData.sender.bank, senderName: slipData.sender.name,
          receiverBank: slipData.receiver.bank, receiverName: slipData.receiver.name,
          date: slipData.date, channel: "สลิปธนาคาร", brandName: settings.brandName,
          slipAttachmentName: bankSlipAttachment?.name,
        })], topUpWebhookOptions("success", slipData.transRef, bankSlipAttachment));
      } catch (err) { logError("bank.successWebhook", err); }

      wallet.setBalance(prev => prev + slipData.amount);
      toast.success(`เติมเงินสำเร็จ ฿${slipData.amount.toLocaleString()}`);
      addNotification("credit", "เติมเงินสำเร็จ", `เติมเงินผ่านสลิปธนาคาร ฿${slipData.amount.toLocaleString()}`, "/wallet");
      await logSlipVerification({ method: "bank", result: "success", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, slipImage: bankSlip.slipImage });
      invalidateCache();
      wallet.loadHistory();

    } catch (err) {
      const msg = getErrorMessage(err);
      setVerifyError(msg); toast.error(msg);
      await safeAddTopUpHistory({ userId: user.uid, userEmail: user.email, userName: userDisplay, amount: 0, transRef: "-", status: "failed", error: msg, createdAt: serverTimestamp() });
      await logSlipVerification({ method: "bank", result: "failed", amount: 0, transRef: "-", errorMessage: msg, slipImage: bankSlip.slipImage });
      wallet.loadHistory();
    } finally {
      verifyLockRef.current = false;
      setVerifying(false);
    }
  };

  // ───────────────── TRUEWALLET VERIFY ─────────────────
  const verifyTrueWallet = async () => {
    if (verifyLockRef.current) return;
    if (!truewalletSlip.slipImage) { toast.error("กรุณาอัปโหลดรูปสลิป TrueWallet ก่อน"); return; }

    // SECURITY (Phase 5): must have configured shop TrueWallet phone.
    // Without it, ANY TrueWallet slip would be accepted — this was the exploit path.
    const configuredShopPhone = (settings.truewalletPhone || '').replace(/\D/g, '');
    if (configuredShopPhone.length < 9) {
      toast.error("Admin ยังไม่ได้ตั้งค่าเบอร์ TrueWallet ปลายทาง — ระบบเติมสลิป TrueWallet ถูกปิดจนกว่าจะตั้งค่า");
      setVerifyError("ยังไม่ได้ตั้งค่าเบอร์ TrueWallet ของร้าน — กรุณาแจ้ง Admin");
      return;
    }

    const rl = checkRateLimit("topup", user?.uid);
    if (!rl.allowed) { toast.error(`เติมเงินบ่อยเกินไป กรุณารออีก ${formatRetryTime(rl.retryAfterMs)}`); return; }

    verifyLockRef.current = true;
    setVerifying(true); setVerifyResult(null); setVerifyError(null);

    try {
      const { getIdToken } = await import("@/lib/firebaseIdToken");
      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke('verify-slip', {
        body: {
          provider: 'thunder',
          type: 'truewallet',
          base64: truewalletSlip.slipImage,
          checkDuplicate: true,
          matchAccount: true, // Thunder-side receiver match
          idToken,
        },
      });
      if (error) throw new Error(error.message);
      if (!data.success) { const errMsg = data.error?.message || data.error || "ตรวจสอบลิงก์ TrueWallet ไม่สำเร็จ"; setVerifyError(errMsg); toast.error(errMsg); return; }

      const raw = data.data.rawSlip;
      const slipData: SlipData = {
        transRef: raw.transactionId || "-", date: raw.date || new Date().toISOString(),
        amount: typeof raw.amount === 'number' ? raw.amount : (raw.amount?.amount || 0), fee: 0,
        sender: { name: raw.sender?.name || "-", bank: "TrueWallet", account: "-" },
        receiver: { name: raw.receiver?.name || profile?.displayName || profile?.email || user?.email || "-", bank: "TrueWallet", account: raw.receiver?.phone || "-" },
        isDuplicate: data.data.isDuplicate || false,
      };
      setVerifyResult(slipData);
      const truewalletSlipAttachment = imageAttachment("truewallet-slip", truewalletSlip.slipImage);

      // LOCAL TRANSREF DUPLICATE CHECK
      try {
        const dupQuery = query(collection(db, "topUpHistory"), where("transRef", "==", slipData.transRef), where("status", "==", "success"), limit(1));
        const dupSnap = await getDocs(dupQuery);
        if (!dupSnap.empty) {
          const errMsg = "สลิปนี้เคยถูกใช้เติมเงินในระบบแล้ว (ตรวจพบโดยระบบภายใน)";
          setVerifyError(errMsg); toast.error("สลิปนี้เคยถูกใช้แล้ว!");
          await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp(), method: "truewallet" });
          await logSlipVerification({ method: "truewallet", result: "duplicate", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, errorMessage: errMsg, slipImage: truewalletSlip.slipImage });
          try { await sendWebhook(settings, "topUp", [duplicateSlipEmbed({ userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef, channel: "TrueWallet", source: "ระบบภายใน (Firestore)", senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, date: slipData.date, brandName: settings.brandName, slipAttachmentName: truewalletSlipAttachment?.name })], topUpWebhookOptions("duplicate", slipData.transRef, truewalletSlipAttachment)); } catch (e) { logError("tw.dupWebhook", e); }
          await checkAndAutoBan(user!.uid, userDisplay, errMsg);
          wallet.loadHistory(); return;
        }
      } catch (dupErr) { logError("tw.localDedup", dupErr); }

      // MANDATORY receiver-phone verification.
      // Thunder v2 คืน receiver.phone แบบ MASKED เช่น "09*-***-5604" — เทียบตรงๆ ไม่ได้
      // ลำดับความเชื่อถือ:
      //  1) data.data.matchedAccount.bankNumber (เลขเต็มไม่มาสก์ จาก Thunder ที่ match กับบัญชีที่ลงทะเบียนไว้)
      //  2) fallback: เทียบ last-4 digits ของเบอร์มาสก์ + prefix "09" (ยอมรับได้เพราะรวมกับ transactionId dedup แล้ว)
      {
        const matchedBankNumber = (data.data?.matchedAccount?.bankNumber || '').replace(/\D/g, '');
        const maskedPhoneRaw = (raw.receiver?.phone || slipData.receiver.account || '');
        const maskedDigits = maskedPhoneRaw.replace(/\D/g, '');
        const shopLast9 = configuredShopPhone.slice(-9);
        const shopLast4 = configuredShopPhone.slice(-4);

        let phoneMatch = false;
        let matchMethod = '';
        if (matchedBankNumber.length >= 9 && matchedBankNumber.slice(-9) === shopLast9) {
          phoneMatch = true; matchMethod = 'matchedAccount';
        } else if (maskedDigits.length >= 4 && maskedDigits.slice(-4) === shopLast4) {
          // ตรวจสอบว่าเบอร์เริ่มด้วยเลข 2 ตัวแรกตรงกันด้วย (ถ้าดึงได้)
          const maskedPrefix = (maskedPhoneRaw.match(/^\D*(\d{1,3})/)?.[1] || '').replace(/\D/g, '');
          const shopPrefix = configuredShopPhone.slice(0, maskedPrefix.length);
          phoneMatch = maskedPrefix.length === 0 || maskedPrefix === shopPrefix;
          if (phoneMatch) matchMethod = 'masked-last4';
        }

        if (!phoneMatch) {
          const errMsg = `เบอร์ TrueWallet ปลายทางไม่ตรง (สลิป: ${maskedPhoneRaw || '-'}, ร้าน: ${configuredShopPhone})`;
          setVerifyError(errMsg); toast.error("❌ สลิปนี้ไม่ได้โอนเข้า TrueWallet ร้าน!");
          await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "failed", error: errMsg, slipData, createdAt: serverTimestamp(), method: "truewallet" });
          await logSlipVerification({ method: "truewallet", result: "failed", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: "TrueWallet", errorMessage: errMsg, slipImage: truewalletSlip.slipImage });
          try {
            await sendWebhook(settings, "topUp", [wrongAccountTrueWalletEmbed({
              userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef,
              senderName: slipData.sender.name, receiverName: slipData.receiver.name, receiverPhone: maskedPhoneRaw, shopPhone: configuredShopPhone, date: slipData.date, brandName: settings.brandName,
              slipAttachmentName: truewalletSlipAttachment?.name,
            })], topUpWebhookOptions("wrong-account", slipData.transRef, truewalletSlipAttachment));
          } catch (err) { logError("tw.wrongAccountWebhook", err); }
          await checkAndAutoBan(user!.uid, userDisplay, errMsg);
          wallet.loadHistory(); return;
        }
        // eslint-disable-next-line no-console
        console.info(`[TW] receiver verified via ${matchMethod}`);
      }

      // Thunder API duplicate
      if (slipData.isDuplicate) {
        setVerifyError("ลิงก์นี้เคยถูกใช้แล้ว (Thunder API)"); toast.error("ลิงก์นี้เคยถูกใช้แล้ว");
        await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp(), method: "truewallet" });
        await logSlipVerification({ method: "truewallet", result: "duplicate", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, slipImage: truewalletSlip.slipImage });
        try { await sendWebhook(settings, "topUp", [duplicateSlipEmbed({ userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef, channel: "TrueWallet", source: "Thunder API", senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, date: slipData.date, brandName: settings.brandName, slipAttachmentName: truewalletSlipAttachment?.name })], topUpWebhookOptions("duplicate", slipData.transRef, truewalletSlipAttachment)); } catch (e) { logError("tw.thunderDupWebhook", e); }
        wallet.loadHistory(); return;
      }

      // Add balance with fee — atomic ledger
      let creditAmount = slipData.amount;
      if (topUpSettings.truewalletFeeEnabled && topUpSettings.truewalletFeePercent > 0) {
        creditAmount = Math.round(slipData.amount * (1 - topUpSettings.truewalletFeePercent / 100));
      }
      const twAttemptId = generateAttemptId("tw");
      try {
        await applyLedger({
          userId: user!.uid, userEmail: user!.email, userName: userDisplay,
          amount: creditAmount, type: "topup_truewallet",
          description: `เติมเงิน TrueWallet (Ref: ${slipData.transRef})`,
          refId: slipData.transRef, method: "truewallet",
          requireUniqueRefId: true,
          meta: { attemptId: twAttemptId, gross: slipData.amount, feePercent: topUpSettings.truewalletFeePercent || 0 },
        });
      } catch (e: any) {
        if (e?.code === "DUPLICATE_REF" || e?.message === "DUPLICATE_REF") {
          const errMsg = "ลิงก์นี้เคยถูกใช้แล้ว (atomic guard)";
          setVerifyError(errMsg); toast.error("ลิงก์นี้เคยถูกใช้แล้ว!");
          await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: slipData.amount, transRef: slipData.transRef, status: "duplicate", slipData, createdAt: serverTimestamp(), method: "truewallet" });
          try { await sendWebhook(settings, "topUp", [duplicateSlipEmbed({ userDisplay, ...webhookMeta, amount: slipData.amount, transRef: slipData.transRef, channel: "TrueWallet", source: "Atomic guard", senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, date: slipData.date, brandName: settings.brandName, slipAttachmentName: truewalletSlipAttachment?.name })], topUpWebhookOptions("duplicate", slipData.transRef, truewalletSlipAttachment)); } catch {}
          wallet.loadHistory(); return;
        }
        throw e;
      }

      await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: slipData.amount, creditAmount, transRef: slipData.transRef, status: "success", slipData, attemptId: twAttemptId, createdAt: serverTimestamp(), method: "truewallet" });
      await logActivity(user!, profile, "topup", `เติมเงิน TrueWallet ฿${slipData.amount.toLocaleString()} (Ref: ${slipData.transRef})`);

      try {
        await sendWebhook(settings, "topUp", [topUpTrueWalletSuccessEmbed({
          userDisplay, ...webhookMeta, amount: slipData.amount, creditAmount,
          feeEnabled: !!topUpSettings.truewalletFeeEnabled, feePercent: topUpSettings.truewalletFeePercent,
          transRef: slipData.transRef, senderName: slipData.sender.name, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank,
          date: slipData.date, channel: "TrueWallet", brandName: settings.brandName,
          slipAttachmentName: truewalletSlipAttachment?.name,
        })], topUpWebhookOptions("success", slipData.transRef, truewalletSlipAttachment));
      } catch (err) { logError("tw.successWebhook", err); }

      wallet.setBalance(prev => prev + creditAmount);
      const feeNote = topUpSettings.truewalletFeeEnabled ? ` (หลังหัก ${topUpSettings.truewalletFeePercent}% = ฿${creditAmount.toLocaleString()})` : "";
      toast.success(`เติมเงิน TrueWallet สำเร็จ ฿${slipData.amount.toLocaleString()}${feeNote}`);
      addNotification("credit", "เติมเงิน TrueWallet สำเร็จ", `฿${slipData.amount.toLocaleString()}${feeNote}`, "/wallet");
      await logSlipVerification({ method: "truewallet", result: "success", amount: slipData.amount, transRef: slipData.transRef, senderName: slipData.sender.name, senderBank: slipData.sender.bank, receiverName: slipData.receiver.name, receiverBank: slipData.receiver.bank, slipImage: truewalletSlip.slipImage });
      invalidateCache();
      wallet.loadHistory();

    } catch (err) {
      const msg = getErrorMessage(err);
      setVerifyError(msg); toast.error(msg);
      await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: 0, transRef: "-", status: "failed", error: msg, createdAt: serverTimestamp(), method: "truewallet" });
      await logSlipVerification({ method: "truewallet", result: "failed", amount: 0, transRef: "-", errorMessage: msg, slipImage: truewalletSlip.slipImage });
      wallet.loadHistory();
    } finally {
      verifyLockRef.current = false;
      setVerifying(false);
    }
  };

  // ───────────────── VOUCHER VERIFY ─────────────────
  const verifyVoucher = async () => {
    if (verifyLockRef.current) return;
    if (!voucherUrl.trim()) { toast.error("กรุณาวางลิงก์ซองอั่งเปา"); return; }
    if (!voucherUrl.includes("gift.truemoney.com") && !voucherUrl.match(/[0-9A-Za-z]{35}/)) { toast.error("ลิงก์ซองไม่ถูกต้อง กรุณาวางลิงก์ gift.truemoney.com"); return; }
    const truewalletPhone = settings.truewalletPhone;
    if (!truewalletPhone) { toast.error("Admin ยังไม่ได้ตั้งค่าเบอร์ TrueWallet สำหรับรับเงิน"); return; }
    const rl = checkRateLimit("topup", user?.uid);
    if (!rl.allowed) { toast.error(`เติมเงินบ่อยเกินไป กรุณารออีก ${formatRetryTime(rl.retryAfterMs)}`); return; }

    verifyLockRef.current = true;
    setVerifying(true); setVerifyResult(null); setVerifyError(null);

    // Parse voucher code up-front so it's available even if request fails
    const voucherParts = voucherUrl.split("v=");
    const rawCode = (voucherParts[1] || voucherParts[0]).match(/[0-9A-Za-z]+/);
    const voucherCode = rawCode?.[0] || voucherUrl.trim().slice(0, 35);

    // Defensive history-write helper: never let a logging failure swallow the attempt
    const safeAddHistory = async (payload: any) => {
      try {
        await safeAddTopUpHistory({ ...payload, createdAt: serverTimestamp() });
      } catch (e) {
        logError("voucher.addHistory", e);
        // Retry once after short delay
        try {
          await new Promise(r => setTimeout(r, 800));
          await safeAddTopUpHistory({ ...payload, createdAt: serverTimestamp(), retryWrite: true });
        } catch (e2) { logError("voucher.addHistory.retry", e2); }
      }
    };

    try {
      // ── New tw-angpao flow: edge function does the redeem AND atomically
      //    credits wallets/{uid} + writes processedSlips guard + walletLedger.
      //    Client no longer calls applyLedger here (would double-credit).
      const { data, error } = await supabase.functions.invoke('redeem-angpao', {
        body: { voucherCode, mobile: truewalletPhone, uid: user!.uid },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) {
        const errMsg = data?.message || "ไม่สามารถรับซองอั่งเปาได้";
        setVerifyError(errMsg); toast.error(errMsg);
        await safeAddHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: 0, transRef: voucherCode, status: "failed", method: "voucher", error: errMsg, errorMessage: errMsg, voucherUrl: voucherUrl.trim() });
        await logSlipVerification({ method: "truewallet", result: "failed", amount: 0, transRef: voucherCode, errorMessage: `[ซองอั่งเปา] ${errMsg}` });
        wallet.loadHistory(); return;
      }

      const amount = Number(data.amount) || 0;
      const ownerName = data.ownerName || "-";
      const transRef = voucherCode;
      const slipData: SlipData = {
        transRef, date: new Date().toISOString(), amount, fee: 0,
        sender: { name: ownerName, bank: "TrueWallet", account: "-" },
        receiver: { name: profile?.displayName || profile?.email || user?.email || "-", bank: "TrueWallet", account: "-" },
        isDuplicate: false,
      };
      setVerifyResult(slipData);

      const voucherAttemptId = generateAttemptId("voucher");
      const voucherCredit = amount; // server credits gross amount; fee setting kept for legacy UI only
      void topUpSettings; void applyLedger; // (no client-side ledger here)
      await safeAddHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount, transRef, status: "success", slipData, method: "voucher", voucherUrl: voucherUrl.trim(), creditAmount: voucherCredit, attemptId: voucherAttemptId, serverCredited: true });

      await logActivity(user!, profile, "topup", `เติมเงินซองอั่งเปา ฿${amount.toLocaleString()} จาก ${ownerName} (Code: ${transRef.substring(0, 8)}...)`);
      await logSlipVerification({ method: "truewallet", result: "success", amount, transRef, senderName: ownerName, senderBank: "TrueWallet (ซอง)", receiverName: profile?.displayName || user?.email || "-", receiverBank: "TrueWallet" });
      wallet.loadBalance(); invalidateCache(); wallet.loadHistory();
      toast.success(`เติมเงิน ฿${amount.toLocaleString()} สำเร็จ!`);
      addNotification("credit", "เติมเงินซองอั่งเปาสำเร็จ", `฿${amount.toLocaleString()}`, "/wallet");
    } catch (err) {
      const errMsg = getErrorMessage(err);
      setVerifyError(errMsg); toast.error(errMsg);
      // Always log the attempt — this fixes the bug where envelope top-ups vanish on errors
      await safeAddHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: 0, transRef: voucherCode, status: "failed", method: "voucher", error: errMsg, errorMessage: errMsg, voucherUrl: voucherUrl.trim() });
      await logSlipVerification({ method: "truewallet", result: "failed", amount: 0, transRef: voucherCode, errorMessage: `[ซองอั่งเปา] ${errMsg}` });
      wallet.loadHistory();
    } finally {
      verifyLockRef.current = false;
      setVerifying(false);
    }
  };

  const copyRef = (ref: string) => { navigator.clipboard.writeText(ref); setCopiedRef(true); setTimeout(() => setCopiedRef(false), 2000); };
  const formatDate = (ts: any) => { if (!ts) return "-"; const d = ts.toDate ? ts.toDate() : new Date(ts); return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }); };

  return (
    <div className={`relative z-10 ${maxWidthClass()} mx-auto px-4 sm:px-6 py-6`} onPaste={bankSlip.handlePaste}>
      <PageBreadcrumb items={[{ label: "เมนู", path: "/hub" }, { label: "เติมเงิน" }]} title="เติมเงิน" subtitle="อัปโหลดสลิปโอนเงินเพื่อเติมเงินเข้ากระเป๋า" icon={Wallet} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Top-Up Notice Message */}
        {topUpSettings.noticeMessage && (() => {
          const colorMap: Record<string, any> = {
            amber: { border: "border-amber-500/20", bg: "bg-amber-500/5", iconBg: "bg-amber-500/15", iconBorder: "border-amber-500/20", text: "text-amber-500" },
            green: { border: "border-emerald-500/20", bg: "bg-emerald-500/5", iconBg: "bg-emerald-500/15", iconBorder: "border-emerald-500/20", text: "text-emerald-500" },
            red: { border: "border-red-500/20", bg: "bg-red-500/5", iconBg: "bg-red-500/15", iconBorder: "border-red-500/20", text: "text-red-500" },
            blue: { border: "border-blue-500/20", bg: "bg-blue-500/5", iconBg: "bg-blue-500/15", iconBorder: "border-blue-500/20", text: "text-blue-500" },
          };
          const c = colorMap[topUpSettings.noticeColor || "amber"];
          const iconMap: Record<string, any> = { warning: AlertTriangle, info: Info, success: CircleCheck, megaphone: Megaphone, bell: Bell };
          const NoticeIcon = iconMap[topUpSettings.noticeIcon || "warning"];
          return (
            <div className={`glass-card !p-4 !rounded-2xl ${c.border} ${c.bg}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${c.iconBg} border ${c.iconBorder} flex items-center justify-center shrink-0 mt-0.5`}>
                  <NoticeIcon size={16} className={c.text} />
                </div>
                <div>
                  <p className={`text-xs font-bold ${c.text} mb-1`}>📢 ข้อความจากร้าน</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{topUpSettings.noticeMessage}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Bank Account Info */}
        {((settings.bankAccounts && settings.bankAccounts.length > 0) || settings.bankAccountInfo) && (
          <div className="glass-card !p-5 !rounded-2xl border-primary/15">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/15 flex items-center justify-center">
                <CreditCard size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">ข้อมูลบัญชีสำหรับโอนเงิน</p>
                <p className="text-[10px] text-muted-foreground">โอนเงินแล้วอัปโหลดสลิปด้านล่าง</p>
              </div>
            </div>
            {settings.bankAccounts && settings.bankAccounts.filter((a: any) => a.enabled).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {settings.bankAccounts.filter((a: any) => a.enabled).map((acc: any) => {
                  const bankColors: Record<string, string> = { SCB: "#4E2A84", KBANK: "#138F2D", KTB: "#1BA5E0", BBL: "#1E3A8A", BAY: "#FFC107", TMBThanachart: "#0066FF", GSB: "#E91E8C", PromptPay: "#003B71", TrueWallet: "#22C55E" };
                  const color = acc.customColor || bankColors[acc.bankName] || "#6B7280";
                  const bankLabels: Record<string, string> = { SCB: "ไทยพาณิชย์", KBANK: "กสิกรไทย", KTB: "กรุงไทย", BBL: "กรุงเทพ", BAY: "กรุงศรี", TMBThanachart: "TTB", GSB: "ออมสิน", PromptPay: "PromptPay", TrueWallet: "TrueWallet" };
                  return (
                    <div key={acc.id} className="rounded-xl border border-border/30 bg-background/60 overflow-hidden">
                      <div className="h-1" style={{ backgroundColor: color }} />
                      <div className="p-3 space-y-1">
                        <p className="text-xs font-bold text-foreground">{bankLabels[acc.bankName] || acc.bankName}</p>
                        {acc.accountName && <p className="text-[11px] text-muted-foreground">{acc.accountName}</p>}
                        <p className="text-sm font-mono font-semibold text-foreground tracking-wide">{acc.accountNumber}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : settings.bankAccountInfo ? (
              <div className="whitespace-pre-wrap text-sm text-foreground bg-muted/20 rounded-xl p-4 border border-border">{settings.bankAccountInfo}</div>
            ) : null}
          </div>
        )}

        {/* Balance Card */}
        <div className="glass-card !p-5 !rounded-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/15 flex items-center justify-center">
                <Wallet size={22} className="text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">ยอดเงินคงเหลือ</p>
                {wallet.loadingBalance ? (
                  <div className="h-7 w-24 bg-muted/20 rounded animate-pulse" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">฿{wallet.balance.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</p>
                )}
              </div>
            </div>
            <button onClick={wallet.toggleHistory} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
              <History size={14} /><span className="text-[11px] font-medium">ประวัติ</span>
            </button>
          </div>
        </div>

        {/* Top-up History */}
        <AnimatePresence>
          {wallet.showHistory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="glass-card !p-4 !rounded-xl space-y-2">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-2"><History size={14} className="text-primary" /> ประวัติเติมเงิน</h3>
                {wallet.topUpHistory.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/60 text-center py-4">ยังไม่มีประวัติ</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {wallet.topUpHistory.map((record) => (
                      <div key={record.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${record.status === "success" ? "bg-primary/5 border-primary/15" : record.status === "duplicate" ? "bg-yellow-500/5 border-yellow-500/15" : "bg-destructive/5 border-destructive/15"}`}>
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${record.status === "success" ? "bg-primary/15" : record.status === "duplicate" ? "bg-yellow-500/15" : "bg-destructive/15"}`}>
                            {record.status === "success" ? <CheckCircle size={14} className="text-primary" /> : record.status === "duplicate" ? <Ban size={14} className="text-yellow-500" /> : <XCircle size={14} className="text-destructive" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-foreground">{record.status === "success" ? "เติมสำเร็จ" : record.status === "duplicate" ? "สลิปซ้ำ" : "ไม่สำเร็จ"}</p>
                            <p className="text-[9px] text-muted-foreground/60">Ref: {record.transRef}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-bold ${record.status === "success" ? "text-primary" : "text-muted-foreground"}`}>{record.status === "success" ? "+" : ""}฿{record.amount.toLocaleString()}</p>
                          <p className="text-[9px] text-muted-foreground/50">{formatDate(record.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Section */}
        <div className="glass-card !p-5 !rounded-2xl space-y-4">
          {/* Mode Tabs */}
          <div className="flex gap-2 p-1 bg-muted/10 rounded-xl border border-border/20 overflow-x-auto">
            {topUpSettings.bankSlipEnabled && (
              <button onClick={() => { setTopUpMode("bank"); resetAll(); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${topUpMode === "bank" ? "bg-primary/15 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"}`}>
                <CreditCard size={14} /> {bankIsQr ? "QR เติมเงิน" : "สลิปธนาคาร"}
              </button>
            )}
            {topUpSettings.truewalletEnabled && (
              <button onClick={() => { setTopUpMode("truewallet"); resetAll(); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${topUpMode === "truewallet" ? "bg-orange-500/15 text-orange-500 border border-orange-500/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"}`}>
                <Smartphone size={14} /> TrueWallet
              </button>
            )}
            {topUpSettings.voucherEnabled && (
              <button onClick={() => { setTopUpMode("voucher"); resetAll(); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${topUpMode === "voucher" ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"}`}>
                <Gift size={14} /> ซองอั่งเปา
              </button>
            )}
            {topUpSettings.giftCodeEnabled && (
              <button onClick={() => { setTopUpMode("giftcode"); resetAll(); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${topUpMode === "giftcode" ? "bg-purple-500/15 text-purple-500 border border-purple-500/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"}`}>
                <Gift size={14} /> Gift Code
              </button>
            )}
            {topUpSettings.qrEnabled && !bankIsQr && (
              <button onClick={() => { setTopUpMode("qr"); resetAll(); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${topUpMode === "qr" ? "bg-blue-500/15 text-blue-500 border border-blue-500/20 shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/10"}`}>
                <CreditCard size={14} /> QR Code
              </button>
            )}
          </div>

          {/* TrueWallet Fee Notice */}
          {topUpSettings.truewalletFeeEnabled && (topUpMode === "truewallet" || topUpMode === "voucher") && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
              <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
              <p className="text-[10px] text-yellow-500">การเติมผ่าน TrueWallet จะถูกหักค่าธรรมเนียม {topUpSettings.truewalletFeePercent}%</p>
            </div>
          )}

          {/* Mode hint (no provider exposure) */}
          {topUpMode === "bank" && (slip2goMode || bankIsQr) && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/15">
              <CircleCheck size={13} className="text-primary shrink-0" />
              <p className="text-[10px] text-muted-foreground">
                {bankIsQr && <span className="text-blue-500">กรอกจำนวนเงิน → สร้าง QR → สแกนจ่าย</span>}
                {slip2goMode && <span className="text-yellow-500">กรุณาวาง QR payload จากสลิป</span>}
              </p>
            </div>
          )}

          {topUpMode === "bank" ? (
            bankIsQr ? (
              <TopUpQR
                userId={user.uid}
                minAmount={topUpSettings.minTopUp || 0}
                maxAmount={topUpSettings.maxTopUp || 0}
                provider="plernpay"
                promptpayTarget={topUpSettings.qrPromptPayTarget || ''}
                onPaid={async ({ amount, reference }) => {
                  try {
                    const walletRef = doc(db, "wallets", user.uid);
                    const walletSnap = await getDoc(walletRef);
                    if (walletSnap.exists()) {
                      await updateDoc(walletRef, { balance: increment(amount), lastTopUp: serverTimestamp() });
                    } else {
                      await setDoc(walletRef, { balance: amount, userId: user.uid, lastTopUp: serverTimestamp() });
                    }
                    await safeAddTopUpHistory({
                      userId: user.uid, userEmail: user.email, userName: userDisplay,
                      amount, transRef: `QR_${reference}`, status: "success", method: "qr", createdAt: serverTimestamp(),
                    });
                    await logActivity(user, profile, "topup", `เติมเงิน QR (PlernPay) ฿${amount.toLocaleString()} (Ref: ${reference})`);
                    wallet.setBalance(prev => prev + amount);
                    toast.success(`เติมเงินสำเร็จ ฿${amount.toLocaleString()}`);
                    addNotification("credit", "เติมเงิน QR สำเร็จ", `฿${amount.toLocaleString()}`, "/wallet");
                    try {
                      await sendWebhook(settings, "topUpQR", [topUpQrSuccessEmbed({
                        userDisplay, amount, reference, provider: "plernpay", brandName: settings.brandName,
                      })], { dedupeKey: `qr:${reference}` });
                    } catch (e) { logError("qr.legacy.webhook", e); }
                    invalidateCache();
                    wallet.loadHistory();
                  } catch (e) {
                    logError("qr.creditWallet", e);
                    toast.error(getErrorMessage(e));
                  }
                }}
              />
            ) : (
              <TopUpBankSlip
                slipImage={bankSlip.slipImage}
                verifying={verifying}
                verifyResult={verifyResult}
                verifyError={verifyError}
                onFileSelect={bankSlip.handleFileSelect}
                onVerify={verifySlip}
                onReset={resetAll}
                payloadMode={slip2goMode}
                payload={slipPayload}
                onPayloadChange={(v) => { setSlipPayload(v); setVerifyResult(null); setVerifyError(null); }}
              />
            )
          ) : topUpMode === "truewallet" ? (
            <TopUpTrueWallet slipImage={truewalletSlip.slipImage} verifying={verifying} verifyResult={verifyResult} verifyError={verifyError} onFileSelect={truewalletSlip.handleFileSelect} onPaste={truewalletSlip.handlePaste} onVerify={verifyTrueWallet} onReset={resetAll} />
          ) : topUpMode === "voucher" ? (
            <TopUpVoucher voucherUrl={voucherUrl} verifying={verifying} verifyResult={verifyResult} verifyError={verifyError} truewalletPhone={settings.truewalletPhone || ""} onUrlChange={(url) => { setVoucherUrl(url); setVerifyResult(null); setVerifyError(null); }} onVerify={verifyVoucher} />
          ) : topUpMode === "giftcode" ? (
            <TopUpGiftCode
              giftCodeInput={giftCodeInput} redeeming={redeemingGiftCode} onCodeChange={setGiftCodeInput}
              onRedeem={async () => {
                if (giftCodeLockRef.current) return;
                if (!giftCodeInput.trim()) return;
                giftCodeLockRef.current = true;
                setRedeemingGiftCode(true);
                try {
                  const settingsRef = doc(db, "settings", "site");
                  const result = await runTransaction(db, async (transaction) => {
                    const settingsSnap = await transaction.get(settingsRef);
                    if (!settingsSnap.exists()) throw new Error("ไม่พบการตั้งค่า");
                    const currentSettings = settingsSnap.data();
                    const allCodes = currentSettings.giftCodes || [];
                    const gc = allCodes.find((c: any) => c.code === giftCodeInput.trim() && c.enabled);
                    if (!gc) throw new Error("Gift Code ไม่ถูกต้องหรือถูกปิดใช้งาน");
                    if (gc.usedCount >= gc.maxUses) throw new Error("Gift Code นี้ถูกใช้ครบจำนวนแล้ว");
                    if (gc.expiresAt && new Date(gc.expiresAt) < new Date()) throw new Error("Gift Code หมดอายุแล้ว");
                    const updatedCodes = allCodes.map((c: any) => c.id === gc.id ? { ...c, usedCount: c.usedCount + 1 } : c);
                    transaction.update(settingsRef, { giftCodes: updatedCodes });
                    return gc;
                  });

                  const dupQ = query(collection(db, "topUpHistory"), where("userId", "==", user!.uid), where("transRef", "==", `GIFT_${result.code}`), where("status", "==", "success"), limit(1));
                  const dupSnap = await getDocs(dupQ);
                  if (!dupSnap.empty) {
                    const settingsRef2 = doc(db, "settings", "site");
                    await runTransaction(db, async (tx) => {
                      const snap = await tx.get(settingsRef2);
                      const codes = snap.data()?.giftCodes || [];
                      const rolledBack = codes.map((c: any) => c.id === result.id ? { ...c, usedCount: Math.max(0, c.usedCount - 1) } : c);
                      tx.update(settingsRef2, { giftCodes: rolledBack });
                    });
                    toast.error("คุณเคยใช้ Gift Code นี้แล้ว"); setRedeemingGiftCode(false); return;
                  }

                  const giftAttemptId = generateAttemptId("gift");
                  await applyLedger({
                    userId: user!.uid, userEmail: user!.email, userName: userDisplay,
                    amount: result.amount, type: "topup_giftcode",
                    description: `เติมเงินผ่าน Gift Code (${result.code})`,
                    refId: `GIFT_${result.code}`, method: "giftcode",
                    meta: { attemptId: giftAttemptId, giftCodeId: result.id, code: result.code },
                  });

                  await safeAddTopUpHistory({ userId: user!.uid, userEmail: user!.email, userName: userDisplay, amount: result.amount, transRef: `GIFT_${result.code}`, status: "success", attemptId: giftAttemptId, createdAt: serverTimestamp(), method: "giftcode" });
                  await logActivity(user!, profile, "topup", `เติมเงิน Gift Code ฿${result.amount.toLocaleString()} (Code: ${result.code})`);
                  wallet.setBalance(prev => prev + result.amount);
                  toast.success(`เติมเงิน ฿${result.amount.toLocaleString()} สำเร็จ!`);
                  addNotification("credit", "เติมเงิน Gift Code สำเร็จ", `฿${result.amount.toLocaleString()}`, "/wallet");
                  try {
                    await sendWebhook(settings, "giftCode", [giftCodeRedeemEmbed({
                      userDisplay, code: result.code, amount: result.amount, attemptId: giftAttemptId, brandName: settings.brandName,
                    })], { dedupeKey: `gift:${giftAttemptId}` });
                  } catch (e) { logError("giftCode.webhook", e); }
                  setGiftCodeInput(""); wallet.loadHistory();
                } catch (err) {
                  logError("giftCode.redeem", err);
                  toast.error(getErrorMessage(err));
                } finally {
                  giftCodeLockRef.current = false;
                  setRedeemingGiftCode(false);
                }
              }}
            />
          ) : topUpMode === "qr" ? (
            <TopUpQR
              userId={user.uid}
              minAmount={topUpSettings.minTopUp || 0}
              maxAmount={topUpSettings.maxTopUp || 0}
              provider={'plernpay' as any}
              promptpayTarget={topUpSettings.qrPromptPayTarget || ''}
              onPaid={async ({ amount, reference }) => {
                try {
                  const qrAttemptId = generateAttemptId("qr");
                  await applyLedger({
                    userId: user.uid, userEmail: user.email, userName: userDisplay,
                    amount, type: "topup_qr",
                    description: `เติมเงิน QR (Ref: ${reference})`,
                    refId: reference, method: "qr",
                    meta: { attemptId: qrAttemptId, reference },
                  });
                  await safeAddTopUpHistory({
                    userId: user.uid, userEmail: user.email, userName: userDisplay,
                    amount, transRef: `QR_${reference}`, status: "success", method: "qr", attemptId: qrAttemptId, createdAt: serverTimestamp(),
                  });
                  await logActivity(user, profile, "topup", `เติมเงิน QR ฿${amount.toLocaleString()} (Ref: ${reference})`);
                  wallet.setBalance(prev => prev + amount);
                  toast.success(`เติมเงินสำเร็จ ฿${amount.toLocaleString()}`);
                  addNotification("credit", "เติมเงิน QR สำเร็จ", `฿${amount.toLocaleString()}`, "/wallet");
                  try {
                    await sendWebhook(settings, "topUpQR", [topUpQrSuccessEmbed({
                      userDisplay, amount, reference, provider: topUpSettings.qrProvider || "plernpay", brandName: settings.brandName,
                    })], { dedupeKey: `qr:${reference}` });
                  } catch (e) { logError("qr.webhook", e); }
                  invalidateCache();
                  wallet.loadHistory();
                } catch (e) {
                  logError("qr.creditWallet", e);
                  toast.error(getErrorMessage(e));
                }
              }}
            />
          ) : null}
        </div>

        {/* Verify Result */}
        <AnimatePresence>
          {verifyResult && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className={`glass-card !p-5 !rounded-2xl border-2 ${verifyResult.isDuplicate ? "!border-yellow-500/30" : "!border-primary/30"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${verifyResult.isDuplicate ? "bg-yellow-500/15" : "bg-primary/15"}`}>
                    {verifyResult.isDuplicate ? <AlertTriangle size={20} className="text-yellow-500" /> : <CheckCircle size={20} className="text-primary" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{verifyResult.isDuplicate ? "สลิปซ้ำ!" : "ตรวจสอบสำเร็จ!"}</h3>
                    <p className="text-[10px] text-muted-foreground/60">{verifyResult.isDuplicate ? "สลิปนี้เคยถูกใช้แล้ว" : "เติมเงินเข้ากระเป๋าเรียบร้อย"}</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: "จำนวนเงิน", value: `฿${verifyResult.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`, highlight: true },
                    { label: "Ref", value: verifyResult.transRef, copyable: true },
                    { label: "วันที่", value: new Date(verifyResult.date).toLocaleDateString("th-TH", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                    { label: "ผู้โอน", value: `${verifyResult.sender.name} (${verifyResult.sender.bank})` },
                    { label: "ผู้รับ", value: `${verifyResult.receiver.name} (${verifyResult.receiver.bank})` },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/5 border border-border/10">
                      <span className="text-[10px] text-muted-foreground/70">{row.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-medium ${row.highlight ? "text-primary text-sm font-bold" : "text-foreground"}`}>{row.value}</span>
                        {row.copyable && (
                          <button onClick={() => copyRef(verifyResult.transRef)} className="p-1 hover:bg-primary/10 rounded transition-colors">
                            {copiedRef ? <Check size={10} className="text-primary" /> : <Copy size={10} className="text-muted-foreground/50" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={resetAll} className="w-full mt-4 btn-glass py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
                  <Upload size={14} /> เติมเงินอีกครั้ง
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {verifyError && !verifyResult && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div className="glass-card !p-4 !rounded-xl !border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center shrink-0"><XCircle size={18} className="text-destructive" /></div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">ตรวจสอบไม่สำเร็จ</h4>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{verifyError}</p>
                  </div>
                </div>
                <button onClick={resetAll} className="w-full mt-3 btn-glass py-2 rounded-lg text-[11px] font-medium">ลองใหม่</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default TopUpPage;
