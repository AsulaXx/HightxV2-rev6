import { useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

/**
 * Sends a daily Discord summary embed and updates the lastDailySummaryDate flag.
 * Exported standalone so it can be triggered manually from AdminWebhooks "Send now" button.
 */
export const sendDailySummary = async (
  settings: any,
  updateSettings: any,
  force = false,
) => {
  if (!force && !settings.dailySummaryEnabled) return;
  const today = new Date().toISOString().split("T")[0];
  if (!force && settings.lastDailySummaryDate === today) return;
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const keysSnap = await getDocs(collection(db, "keys"));
    const allKeys = keysSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const todayClaims = allKeys.filter((k: any) => {
      if (!k.claimed || !k.claimedAt) return false;
      const claimedDate = k.claimedAt?.toDate?.() || new Date(k.claimedAt);
      return claimedDate >= todayStart;
    });
    const productCounts: Record<string, number> = {};
    todayClaims.forEach((k: any) => {
      const pName =
        settings.products?.find((p: any) => p.id === k.productId)?.name ||
        k.productId ||
        "ไม่ระบุ";
      productCounts[pName] = (productCounts[pName] || 0) + 1;
    });
    const topProduct = Object.entries(productCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const totalAvailable = allKeys.filter((k: any) => !k.claimed).length;
    const fields: any[] = [
      { name: "📊 กดคีย์วันนี้", value: `**${todayClaims.length}** ครั้ง`, inline: true },
      { name: "📦 คีย์คงเหลือ", value: `**${totalAvailable}** คีย์`, inline: true },
    ];
    if (topProduct)
      fields.push({
        name: "🏆 สินค้ายอดนิยม",
        value: `**${topProduct[0]}** (${topProduct[1]} ครั้ง)`,
        inline: true,
      });
    if (Object.keys(productCounts).length > 0) {
      const breakdown = Object.entries(productCounts)
        .map(([name, count]) => `• ${name}: ${count} ครั้ง`)
        .join("\n");
      fields.push({ name: "📋 รายละเอียดตามสินค้า", value: breakdown, inline: false });
    }
    const { sendWebhook } = await import("@/lib/webhookSender");
    await sendWebhook(settings, "dailySummary", [
      {
        title: `📊 สรุปรายวัน - ${new Date().toLocaleDateString("th-TH", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        color: 0x00cc66,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: settings.brandName },
      },
    ]);
    await updateSettings({ lastDailySummaryDate: today });
    toast.success("ส่งสรุปรายวันสำเร็จ!");
  } catch (err) {
    console.error("Daily summary webhook failed:", err);
    toast.error("ส่งสรุปรายวันไม่สำเร็จ");
  }
};

/** Polls every minute and triggers the daily summary at the configured HH:MM. */
export const useDailySummaryScheduler = (settings: any, updateSettings: any) => {
  useEffect(() => {
    if (!settings.dailySummaryEnabled || !settings.dailySummaryTime) return;
    const checkAndSend = () => {
      const now = new Date();
      const [targetH, targetM] = (settings.dailySummaryTime || "23:00")
        .split(":")
        .map(Number);
      const today = now.toISOString().split("T")[0];
      if (
        now.getHours() === targetH &&
        now.getMinutes() === targetM &&
        settings.lastDailySummaryDate !== today
      ) {
        sendDailySummary(settings, updateSettings);
      }
    };
    const interval = setInterval(checkAndSend, 60_000);
    checkAndSend();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    settings.dailySummaryEnabled,
    settings.dailySummaryTime,
    settings.lastDailySummaryDate,
  ]);
};
