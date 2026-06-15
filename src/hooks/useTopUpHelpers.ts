import { useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendWebhook } from "@/lib/webhookSender";
import { slipVerifyEmbed, autoBanEmbed } from "@/lib/webhookTemplates";
import { logError } from "@/lib/errorLogger";
import { query, where, getDocs, limit, updateDoc, doc } from "firebase/firestore";
import { logActivity } from "@/lib/activityLogger";
import { User } from "firebase/auth";

interface SlipLogParams {
  method: "bank" | "truewallet";
  result: "success" | "duplicate" | "failed";
  amount: number;
  transRef: string;
  senderName?: string;
  senderBank?: string;
  receiverName?: string;
  receiverBank?: string;
  errorMessage?: string;
  slipImage?: string | null;
}

const imageAttachment = (prefix: string, dataUrl?: string | null) => {
  if (!dataUrl?.startsWith("data:image/")) return null;
  const contentType = dataUrl.match(/^data:([^;]+);/)?.[1] || "image/png";
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return { name: `${prefix}-${Date.now()}.${ext}`, contentType, dataUrl };
};

/**
 * Hook for shared top-up helpers: slip verification logging, auto-ban, userDisplay
 */
export const useTopUpHelpers = (
  user: User | null,
  profile: any,
  settings: any
) => {
  const userDisplay = `${profile?.displayName || '-'} (${user?.email || '-'})`;

  const logSlipVerification = useCallback(async (params: SlipLogParams) => {
    try {
      await addDoc(collection(db, "slipVerifyLogs"), {
        userId: user?.uid || "",
        userEmail: user?.email || "",
        userName: userDisplay,
        channel: "web",
        method: params.method,
        result: params.result,
        amount: params.amount,
        transRef: params.transRef,
        senderName: params.senderName || "",
        senderBank: params.senderBank || "",
        receiverName: params.receiverName || "",
        receiverBank: params.receiverBank || "",
        errorMessage: params.errorMessage || "",
        createdAt: serverTimestamp(),
      });

      const attachment = imageAttachment("slip-verify", params.slipImage);
      await sendWebhook(settings, "slipVerify", [
        slipVerifyEmbed({
          result: params.result,
          userDisplay,
          amount: params.amount,
          transRef: params.transRef,
          method: params.method,
          senderBank: params.senderBank,
          senderName: params.senderName,
          receiverBank: params.receiverBank,
          receiverName: params.receiverName,
          errorMessage: params.errorMessage,
          brandName: settings.brandName,
          slipAttachmentName: attachment?.name,
        }),
      ], attachment ? { attachments: [attachment] } : {});
    } catch (err) {
      logError("logSlipVerification", err);
    }
  }, [user, userDisplay, settings]);

  const checkAndAutoBan = useCallback(async (userId: string, userName: string, reason: string) => {
    try {
      if (settings.autoBanEnabled === false) return;
      const maxAttempts = settings.autoBanMaxAttempts || 3;
      const windowHours = settings.autoBanWindowHours ?? 24;
      const includeWrong = settings.autoBanIncludeWrongAccount !== false;
      const includeDup = settings.autoBanIncludeDuplicate !== false;

      const windowStart = new Date();
      windowStart.setHours(windowStart.getHours() - windowHours);

      const q = query(collection(db, "topUpHistory"), where("userId", "==", userId));
      const snap = await getDocs(q);
      const recentFailures = snap.docs.filter(d => {
        const data = d.data();
        const err = (data.error || '').toLowerCase();
        const createdAt = data.createdAt?.toDate?.() || new Date(0);
        if (createdAt <= windowStart) return false;
        const isWrongAccount = includeWrong && (data.status === "failed") && (err.includes('ปลายทางไม่ตรง') || err.includes('ไม่ได้โอนเข้า'));
        const isDuplicate = includeDup && data.status === "duplicate";
        return isWrongAccount || isDuplicate;
      });

      if (recentFailures.length >= maxAttempts) {
        const wrongCount = recentFailures.filter(d => d.data().status === "failed").length;
        const dupCount = recentFailures.filter(d => d.data().status === "duplicate").length;
        const banReason = `ระบบแบนอัตโนมัติ: สลิปบัญชีผิด ${wrongCount} ครั้ง, สลิปซ้ำ ${dupCount} ครั้ง ใน ${windowHours} ชม. (รวม ${recentFailures.length} ครั้ง)`;
        await updateDoc(doc(db, "users", userId), {
          banned: true,
          bannedReason: banReason,
          bannedAt: new Date().toISOString(),
        });

        await logActivity(user!, profile, "auto_ban", `แบนอัตโนมัติ: ${userName} | ${banReason}`);

        try {
          await sendWebhook(settings, "topUp", [
            autoBanEmbed({
              userName,
              totalCount: recentFailures.length,
              wrongCount,
              dupCount,
              lastReason: reason,
              brandName: settings.brandName,
            }),
          ]);
        } catch (err) {
          logError("autoBan.webhook", err);
        }

        const { toast } = await import("sonner");
        toast.error("บัญชีของคุณถูกระงับเนื่องจากพยายามใช้สลิปผิดพลาดหลายครั้ง");
      }
    } catch (err) {
      logError("checkAndAutoBan", err);
    }
  }, [user, profile, settings]);

  return { userDisplay, logSlipVerification, checkAndAutoBan };
};
