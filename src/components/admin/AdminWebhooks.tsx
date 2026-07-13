import { useState, useEffect, useRef } from "react";
import { Send, Plus, Trash2, Clock, Save, FileDown, RotateCcw, CheckCircle, XCircle, ScrollText, ChevronDown, Globe, Users, ShoppingCart, Wallet, BarChart3, CircleDot, Power, PowerOff, Lock } from "lucide-react";
import { toast } from "sonner";
import { getWebhookLog, clearWebhookLog, type WebhookLogEntry } from "@/lib/webhookLogger";
import { downloadCSV } from "@/lib/csvExport";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  topUpSuccessEmbed,
  topUpTrueWalletSuccessEmbed,
  duplicateSlipEmbed,
  wrongAccountBankEmbed,
  slipVerifyEmbed,
  loginEmbed,
  signupEmbed,
  wheelSpinEmbed,
  topUpQrSuccessEmbed,
  giftCodeRedeemEmbed,
  keyStockActivityEmbed,
  keyImportEmbed,
  keyDeleteEmbed,
  freeClaimEmbed,
} from "@/lib/webhookTemplates";

// All webhook URL field bases — resolved at runtime to <key> and <key>Urls
const URL_BASE_KEYS = [
  "discordWebhookUrl",
  "webhookKeyClaim", "webhookLowStock", "webhookDailySummary", "webhookLinkPage",
  "webhookTopUp", "webhookPurchase", "webhookSlipVerify",
  "webhookSignup", "webhookLogin", "webhookWheelSpin", "webhookWheelKey",
  "webhookTopUpQR", "webhookGiftCode", "webhookKeyImport", "webhookKeyDelete",
  "webhookFreeClaim",
] as const;

/** Extract { discordWebhookUrl, webhookXxx, webhookXxxUrls } from an object. */
const extractUrlFields = (src: any): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const base of URL_BASE_KEYS) {
    const v = src?.[base];
    if (typeof v === "string" && v) out[base] = v;
    if (base !== "discordWebhookUrl") {
      const arr = src?.[base + "Urls"];
      if (Array.isArray(arr) && arr.length) out[base + "Urls"] = arr;
    }
  }
  return out;
};

/** Build an object with every URL field set to "" / [] for stripping the public doc. */
const blankUrlFields = (): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const base of URL_BASE_KEYS) {
    out[base] = "";
    if (base !== "discordWebhookUrl") out[base + "Urls"] = [];
  }
  return out;
};

/* ── Low-stock webhook config sub-panel ── */
const LowStockAlertConfig = ({ form, setForm }: { form: any; setForm: (f: any) => void }) => {
  const products: Array<{ id: string; name: string }> = Array.isArray(form.products) ? form.products : [];
  const selected: string[] = Array.isArray(form.lowStockWebhookProductIds) ? form.lowStockWebhookProductIds : [];
  const allSelected = selected.length === 0; // empty = all products
  const onlyZero = !!form.lowStockWebhookOnlyZero;
  const threshold = typeof form.lowStockWebhookThreshold === "number"
    ? form.lowStockWebhookThreshold
    : (form.lowStockThreshold ?? 5);

  const toggleProduct = (id: string) => {
    if (allSelected) {
      // Currently "all" — clicking one starts an explicit list containing everything EXCEPT that id
      const others = products.filter((p) => p.id !== id).map((p) => p.id);
      setForm({ ...form, lowStockWebhookProductIds: others });
      return;
    }
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    // If everything is now selected, collapse back to empty (= all)
    setForm({ ...form, lowStockWebhookProductIds: next.length === products.length ? [] : next });
  };

  const selectAll = () => setForm({ ...form, lowStockWebhookProductIds: [] });

  const isChecked = (id: string) => allSelected || selected.includes(id);

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">⚙️ ตั้งค่าการแจ้งเตือน</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            className={`toggle-slider ${onlyZero ? "toggle-active" : ""}`}
            onClick={() => setForm({ ...form, lowStockWebhookOnlyZero: !onlyZero })}
          />
          <span className="text-[10px] text-foreground">แจ้งเฉพาะตอนคีย์หมด (0)</span>
        </label>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
          เตือนเมื่อคีย์เหลือ ≤ (จำนวน)
        </label>
        <input
          type="number"
          min={0}
          max={999}
          value={threshold}
          disabled={onlyZero}
          onChange={(e) =>
            setForm({
              ...form,
              lowStockWebhookThreshold: Math.max(0, parseInt(e.target.value) || 0),
            })
          }
          className="input-glass w-full px-3 py-2 text-xs disabled:opacity-50"
          placeholder="5"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {onlyZero ? "โหมด 'เฉพาะตอนหมด' เปิดอยู่ — ค่านี้ถูกละเว้น" : `จะแจ้งเมื่อคีย์เหลือ ≤ ${threshold}`}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground">
            แจ้งเฉพาะสินค้า ({allSelected ? `ทั้งหมด (${products.length})` : `${selected.length}/${products.length}`})
          </label>
          <button
            type="button"
            onClick={selectAll}
            className="text-[10px] text-primary hover:underline"
          >
            เลือกทั้งหมด
          </button>
        </div>
        {products.length === 0 ? (
          <p className="text-[10px] text-muted-foreground italic">ยังไม่มีสินค้าในระบบ</p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-md border border-border/30 bg-background/30 divide-y divide-border/10">
            {products.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked(p.id)}
                  onChange={() => toggleProduct(p.id)}
                  className="accent-amber-500"
                />
                <span className="text-[11px] text-foreground truncate">{p.name}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {allSelected ? "กำลังแจ้งเตือนทุกสินค้า" : `กำลังแจ้งเตือน ${selected.length} สินค้าที่เลือก`}
        </p>
      </div>
    </div>
  );
};



interface MultiWebhookFieldProps {
  label: string;
  primaryValue: string;
  onPrimaryChange: (v: string) => void;
  extraUrls: string[];
  onExtraUrlsChange: (urls: string[]) => void;
  hint?: string;
  brandName: string;
  testType: string;
  emoji?: string;
  /** Per-event ON/OFF state */
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * Test webhook = ยิง embed หน้าตาเหมือนของจริงเป๊ะ แต่ใช้ข้อมูล placeholder
 * เพื่อให้แอดมินเห็นตัวอย่างจริงและตัดสินใจว่าจะปรับ layout ตรงไหนได้
 *
 * Event ที่ในการใช้งานจริงจะมีรูปแนบ (สลิป / หลักฐาน / รูปสินค้า) จะเติมโน้ต
 * ที่ท้าย description ให้ชัดเจน เพราะ webhook ทดสอบไม่ได้ส่งไฟล์แนบมาด้วย
 */
const IMAGE_NOTES: Record<string, string> = {
  topUp: "📎 ใช้งานจริง: จะแนบรูป **สลิปธนาคาร / TrueWallet** มาด้วย",
  slipVerify: "📎 ใช้งานจริง: จะแนบรูป **สลิป** มาด้วย",
  freeClaim: "📎 ใช้งานจริง: จะแนบรูป **หลักฐานจากผู้กดฟรี** มาด้วย",
  keyClaim: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้า** ถ้าตั้งค่าไว้",
  purchase: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้าชิ้นแรก** ถ้าตั้งค่าไว้",
  keyImport: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้า** ถ้าตั้งค่าไว้",
  keyDelete: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้า** ถ้าตั้งค่าไว้",
  wheelSpin: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้า/รางวัล** ถ้ารางวัลเป็นสินค้า",
  wheelKey: "📎 ใช้งานจริง: จะแนบ **thumbnail รูปสินค้า** ถ้าตั้งค่าไว้",
};

const withImageNote = (embed: any, type: string) => {
  const note = IMAGE_NOTES[type];
  if (!note) return embed;
  // ล้าง `image` / `thumbnail` ออกก่อนส่งเทส (ของจริงเป็น attachment:// URL ที่ Discord จะ 404)
  const { image: _img, thumbnail: _thumb, ...rest } = embed;
  return {
    ...rest,
    description: [embed.description, note].filter(Boolean).join("\n\n"),
  };
};

const testWebhook = async (url: string, type: string, brandName: string) => {
  if (!url) { toast.error("กรุณากรอก Webhook URL ก่อน"); return; }
  const brand = brandName || "HightXClient";
  const now = new Date().toISOString();
  const sampleUser = "TestUser (test@example.com)";
  const sampleImg = "https://cdn.discordapp.com/embed/avatars/0.png";

  const build = (): any => {
    switch (type) {
      case "fallback":
        return { title: "🧪 ทดสอบ Webhook หลัก (Fallback)", color: 0x6366f1, description: "> Webhook หลักทำงานปกติ — ใช้เมื่อไม่ได้ตั้ง Webhook เฉพาะหมวด", footer: { text: brand } };

      case "keyClaim":
        return keyStockActivityEmbed({
          action: "purchase",
          actorDisplay: sampleUser,
          actorRole: "user",
          productName: "Test Product",
          productImageUrl: sampleImg,
          durationLabel: "30 วัน",
          count: 2,
          keys: ["TEST-KEY-AAAA-1111", "TEST-KEY-BBBB-2222"],
          refId: "cart-TEST123",
          brandName: brand,
        });

      case "purchase":
        return {
          title: "🛒 ซื้อสินค้า",
          color: 0xf59e0b,
          fields: [
            { name: "👤 ผู้ใช้", value: sampleUser, inline: true },
            { name: "🎭 ยศ", value: "user", inline: true },
            { name: "💰 ราคารวม", value: "฿150", inline: true },
            { name: "📦 รายการ", value: "• Test Product (30 วัน) x1 — ฿100\n• Test Product B (7 วัน) x1 — ฿50", inline: false },
          ],
          thumbnail: { url: sampleImg },
          timestamp: now,
          footer: { text: brand },
        };

      case "lowStock":
        return {
          title: "⚠️ แจ้งเตือน: คีย์ใกล้หมด!",
          description: "พบ 2 รายการ (หมดสต็อก 1) (ใกล้หมด 1)",
          color: 0xff4444,
          fields: [
            { name: "📦 Test Product", value: "┗ 30 วัน: ❌ หมดแล้ว!\n┗ 7 วัน: ⚠️ เหลือ 2 คีย์", inline: false },
          ],
          timestamp: now,
          footer: { text: `${brand} • Low Stock Alert` },
        };

      case "dailySummary":
        return {
          title: `📊 สรุปรายวัน - ${new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
          color: 0x00cc66,
          fields: [
            { name: "📊 กดคีย์วันนี้", value: "**12** ครั้ง", inline: true },
            { name: "💰 รายได้วันนี้", value: "**฿1,250**", inline: true },
            { name: "📦 คีย์คงเหลือ", value: "**48** คีย์", inline: true },
            { name: "📈 รายได้ 7 วัน", value: "**฿8,900**", inline: true },
            { name: "🔑 กดคีย์ 7 วัน", value: "**76** ครั้ง", inline: true },
            { name: "👥 ผู้ใช้ทั้งหมด", value: "**134** คน", inline: true },
            { name: "📋 สินค้าทั้งหมด", value: "• Test Product: 8 ครั้ง (เหลือ 22)\n• Test Product B: 4 ครั้ง (เหลือ 26)", inline: false },
            { name: "📉 แนวโน้ม (vs 7 วันก่อน)", value: "📈 เพิ่มขึ้น **12%**", inline: false },
          ],
          timestamp: now,
          footer: { text: `${brand} • Daily Summary` },
        };

      case "linkPage":
        return {
          title: "🔗 สร้างหน้าลิงก์",
          color: 0x00cc66,
          fields: [
            { name: "📄 ชื่อหน้า", value: "Test Page", inline: true },
            { name: "👤 โดย", value: sampleUser, inline: true },
            { name: "🔗 ลิงก์", value: `${window.location.origin}/l/test-page`, inline: false },
            { name: "📊 จำนวนลิงก์", value: "5 รายการ", inline: true },
          ],
          timestamp: now,
          footer: { text: brand },
        };

      case "topUp":
        return topUpSuccessEmbed({
          userDisplay: sampleUser,
          amount: 100,
          transRef: "TEST-REF-1234",
          senderBank: "SCB",
          senderName: "ทดสอบ ระบบ",
          receiverBank: "KBANK",
          receiverName: "ร้านทดสอบ",
          date: now,
          channel: "สลิปธนาคาร",
          deviceInfo: "Windows / Chrome",
          brandName: brand,
        });

      case "slipVerify":
        return slipVerifyEmbed({
          result: "success",
          userDisplay: sampleUser,
          amount: 100,
          transRef: "TEST-REF-1234",
          method: "bank",
          senderBank: "SCB",
          senderName: "ทดสอบ ระบบ",
          receiverBank: "KBANK",
          receiverName: "ร้านทดสอบ",
          brandName: brand,
        });

      case "signup":
        return signupEmbed({
          userName: "TestUser",
          email: "test@example.com",
          method: "Email",
          deviceInfo: "Windows / Chrome",
          ip: "127.0.0.1",
          timezone: "Asia/Bangkok",
          language: "th-TH",
          screenSize: "1920x1080",
          referrer: "ตรง (Direct)",
          brandName: brand,
        });

      case "login":
        return loginEmbed({
          userName: "TestUser",
          email: "test@example.com",
          role: "user",
          method: "Email",
          deviceInfo: "Windows / Chrome",
          ip: "127.0.0.1",
          brandName: brand,
        });

      case "keyImport":
        return keyImportEmbed({
          actorDisplay: "Admin (admin@example.com)",
          actorRole: "admin",
          productName: "Test Product",
          productImageUrl: sampleImg,
          durationLabel: "30 วัน",
          count: 10,
          duplicateCount: 2,
          source: "paste",
          sampleKeys: ["TEST-KEY-0001", "TEST-KEY-0002", "TEST-KEY-0003"],
          brandName: brand,
        });

      case "keyDelete":
        return keyDeleteEmbed({
          mode: "single",
          actorDisplay: "Admin (admin@example.com)",
          actorRole: "admin",
          count: 1,
          productName: "Test Product",
          productImageUrl: sampleImg,
          durationLabel: "30 วัน",
          reason: "ทดสอบระบบ",
          sampleKeys: ["TEST-KEY-DELETED-01"],
          brandName: brand,
        });

      case "freeClaim":
        return freeClaimEmbed({
          actorDisplay: "HightXCrew (crew@example.com)",
          actorEmail: "crew@example.com",
          actorRole: "hightxcrew",
          totalCount: 3,
          groups: [{
            productName: "Test Product",
            durationLabel: "30 วัน",
            keys: ["TEST-FREE-01", "TEST-FREE-02", "TEST-FREE-03"],
            productImageUrl: sampleImg,
          }],
          message: "ทดสอบส่งกดฟรี",
          hasProofImage: true,
          brandName: brand,
        });

      case "topUpQR":
        return topUpQrSuccessEmbed({
          userDisplay: sampleUser,
          amount: 100,
          reference: "QR-TEST-1234",
          provider: "plernpay",
          brandName: brand,
        });

      case "giftCode":
        return giftCodeRedeemEmbed({
          userDisplay: sampleUser,
          code: "TESTCODE",
          amount: 50,
          attemptId: "attempt-TEST123",
          brandName: brand,
        });

      case "wheelSpin":
        return wheelSpinEmbed({
          userDisplay: sampleUser,
          wheelName: "Test Wheel",
          prizeLabel: "Test Product",
          rewardType: "product",
          productName: "Test Product",
          productKey: "TEST-WHEEL-KEY-01",
          productImageUrl: sampleImg,
          cost: 10,
          attemptId: "attempt-WHEEL123",
          brandName: brand,
        });

      case "wheelKey":
        return keyStockActivityEmbed({
          action: "wheel",
          actorDisplay: sampleUser,
          actorRole: "user",
          productName: "Test Product",
          productImageUrl: sampleImg,
          durationLabel: "30 วัน",
          count: 1,
          keys: ["TEST-WHEEL-KEY-01"],
          note: "ได้จากวงล้อ: Test Wheel",
          brandName: brand,
        });

      default:
        return { title: `🧪 ทดสอบ Webhook (${type})`, color: 0x6366f1, description: "ยังไม่มี template ตัวอย่างสำหรับ event นี้", footer: { text: brand } };
    }
  };

  const embed = withImageNote(build(), type);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [{ ...embed, timestamp: embed.timestamp || now }] }),
    });
    if (res.ok) toast.success("ส่งทดสอบสำเร็จ! ตรวจสอบ Discord ของคุณ");
    else toast.error(`ส่งไม่สำเร็จ (${res.status})`);
  } catch { toast.error("ไม่สามารถเชื่อมต่อ Webhook ได้"); }
};

type SignupFieldKey = "method" | "device" | "ip" | "timezone" | "language" | "screen" | "referrer";
const SIGNUP_FIELD_OPTIONS: { key: SignupFieldKey; label: string; emoji: string }[] = [
  { key: "method", label: "วิธีสมัคร", emoji: "🔑" },
  { key: "device", label: "อุปกรณ์", emoji: "📱" },
  { key: "ip", label: "IP", emoji: "🌐" },
  { key: "timezone", label: "Timezone", emoji: "🕐" },
  { key: "language", label: "ภาษา", emoji: "🗣️" },
  { key: "screen", label: "ขนาดหน้าจอ", emoji: "🖥️" },
  { key: "referrer", label: "Referrer", emoji: "↪️" },
];

const SignupEmbedFieldToggles = ({ value, onChange }: { value: Partial<Record<SignupFieldKey, boolean>>; onChange: (next: Partial<Record<SignupFieldKey, boolean>>) => void }) => {
  const isOn = (k: SignupFieldKey) => value[k] !== false;
  const toggle = (k: SignupFieldKey) => onChange({ ...value, [k]: !isOn(k) });
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5 -mt-1">
      <div className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
        <span>⚙️ ฟิลด์ใน Embed สมัครสมาชิก</span>
        <span className="text-[9px] opacity-70">(ชื่อ + อีเมล แสดงตลอด)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SIGNUP_FIELD_OPTIONS.map((opt) => {
          const on = isOn(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-all ${on ? "border-primary/60 bg-primary/15 text-foreground" : "border-border/40 bg-muted/20 text-muted-foreground line-through"}`}
            >
              {opt.emoji} {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MultiWebhookField = ({ label, primaryValue, onPrimaryChange, extraUrls, onExtraUrlsChange, hint, brandName, testType, emoji, enabled, onToggle }: MultiWebhookFieldProps) => (
  <div className={`space-y-2 transition-opacity ${enabled ? "" : "opacity-60"}`}>
    <div className="flex items-center justify-between gap-2">
      <label className="block text-xs font-semibold text-foreground">{emoji && <span className="mr-1">{emoji}</span>}{label}</label>
      <button
        onClick={() => onToggle(!enabled)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${enabled ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted/30 text-muted-foreground border border-border/30"}`}
        title={enabled ? "คลิกเพื่อปิดการแจ้งเตือน" : "คลิกเพื่อเปิดการแจ้งเตือน"}
      >
        {enabled ? <Power size={10} /> : <PowerOff size={10} />}
        {enabled ? "เปิดอยู่" : "ปิดอยู่"}
      </button>
    </div>
    <div className="flex gap-2">
      <input type="url" value={primaryValue} onChange={(e) => onPrimaryChange(e.target.value)} className="input-glass flex-1 px-3 py-2 text-xs" placeholder="https://discord.com/api/webhooks/..." />
      <button onClick={() => testWebhook(primaryValue, testType, brandName)} className="btn-glass px-2.5 py-2 text-xs shrink-0" title="ทดสอบ"><Send size={13} /></button>
    </div>
    {extraUrls.map((url, i) => (
      <div key={i} className="flex gap-2">
        <input type="url" value={url} onChange={(e) => { const copy = [...extraUrls]; copy[i] = e.target.value; onExtraUrlsChange(copy); }} className="input-glass flex-1 px-3 py-2 text-xs" placeholder={`URL #${i + 2}`} />
        <button onClick={() => testWebhook(url, testType, brandName)} className="btn-glass px-2.5 py-2 text-xs shrink-0" title="ทดสอบ"><Send size={13} /></button>
        <button onClick={() => onExtraUrlsChange(extraUrls.filter((_, j) => j !== i))} className="btn-glass px-2.5 py-2 text-xs shrink-0 text-destructive" title="ลบ"><Trash2 size={13} /></button>
      </div>
    ))}
    <button onClick={() => onExtraUrlsChange([...extraUrls, ""])} className="text-[10px] text-primary hover:underline flex items-center gap-1"><Plus size={10} /> เพิ่ม URL</button>
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

/* ── Collapsible Category Group with bulk on/off ── */
const CategoryGroup = ({
  icon: Icon,
  title,
  count,
  children,
  eventKeys,
  events,
  onBulkToggle,
}: {
  icon: any;
  title: string;
  count: number;
  children: React.ReactNode;
  eventKeys?: string[];
  events?: Record<string, any>;
  onBulkToggle?: (next: boolean) => void;
}) => {
  const [open, setOpen] = useState(true);
  const enabledCount = eventKeys && events
    ? eventKeys.filter((k) => events[k] !== false).length
    : 0;
  const allOn = eventKeys ? enabledCount === eventKeys.length : true;
  return (
    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
      <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 flex-1 text-left">
          <Icon size={16} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-foreground flex-1">{title}</span>
          <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">{count}</span>
        </button>
        {eventKeys && onBulkToggle && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onBulkToggle(!allOn); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${allOn ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted/30 text-muted-foreground border border-border/30"}`}
            title={allOn ? "ปิดทั้งหมวดนี้" : "เปิดทั้งหมวดนี้"}
          >
            {allOn ? <Power size={10} /> : <PowerOff size={10} />}
            {enabledCount}/{eventKeys.length}
          </button>
        )}
        <button onClick={() => setOpen(!open)}>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-border/20 pt-3">{children}</div>}
    </div>
  );
};

interface AdminWebhooksProps {
  form: any;
  setForm: (form: any) => void;
  settings: any;
  updateSettings: (updates: any) => void;
  handleSave: (overrideForm?: any) => void;
  sendDailySummary: (settings: any, updateSettings: any, force?: boolean) => Promise<void>;
}

/* ── Webhook Log Panel ── */
const WebhookLogPanel = () => {
  const [log, setLog] = useState<WebhookLogEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");

  useEffect(() => {
    setLog(getWebhookLog());
    const interval = setInterval(() => setLog(getWebhookLog()), 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filterStatus === "all" ? log : log.filter(e => e.status === filterStatus);
  const successCount = log.filter(e => e.status === "success").length;
  const failedCount = log.filter(e => e.status === "failed").length;

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ScrollText size={15} className="text-primary" /> ประวัติการส่ง
        </h3>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { downloadCSV(log.map(e => ({ เวลา: new Date(e.timestamp).toLocaleString("th-TH"), ประเภท: e.type, สถานะ: e.status === "success" ? "สำเร็จ" : "ล้มเหลว", HTTP: e.httpStatus || "-", ข้อผิดพลาด: e.error || "-", URL: e.url })), "webhook_log"); toast.success("ดาวน์โหลด CSV สำเร็จ"); }} className="btn-glass px-2 py-1 text-[10px] flex items-center gap-1" disabled={!log.length}>
            <FileDown size={11} /> CSV
          </button>
          <button onClick={() => { clearWebhookLog(); setLog([]); toast.success("ล้างประวัติแล้ว"); }} className="btn-glass px-2 py-1 text-[10px] flex items-center gap-1 text-destructive" disabled={!log.length}>
            <RotateCcw size={11} /> ล้าง
          </button>
        </div>
      </div>

      <div className="px-4 py-2 flex gap-1.5 border-b border-border/10">
        {([["all", `ทั้งหมด (${log.length})`, ""], ["success", `สำเร็จ (${successCount})`, "text-emerald-400"], ["failed", `ล้มเหลว (${failedCount})`, "text-destructive"]] as const).map(([key, lbl, clr]) => (
          <button key={key} onClick={() => setFilterStatus(key)} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${filterStatus === key ? "bg-primary/10 text-primary" : `text-muted-foreground ${clr}`}`}>
            {key === "success" && <CheckCircle size={10} className="inline mr-0.5" />}
            {key === "failed" && <XCircle size={10} className="inline mr-0.5" />}
            {lbl}
          </button>
        ))}
      </div>

      <div className="max-h-[320px] overflow-auto bg-[#0a0e14] font-mono text-[11px] leading-relaxed">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-8 font-mono">$ no webhook events yet_</p>
        ) : (
          <pre className="px-4 py-3 whitespace-pre text-slate-300 m-0">
{filtered.map((entry) => {
  const t = new Date(entry.timestamp).toLocaleTimeString("th-TH", { hour12: false });
  const level = entry.status === "success" ? "OK  " : entry.status === "failed" ? "FAIL" : "SKIP";
  const color = entry.status === "success" ? "text-emerald-400" : entry.status === "failed" ? "text-red-400" : "text-amber-400";
  const http = entry.httpStatus ? ` ${entry.httpStatus}` : "";
  const detail = entry.error || entry.embedTitle || entry.reason || "";
  return (
    <div key={entry.id} className="hover:bg-white/5 px-1 -mx-1 rounded">
      <span className="text-slate-500">[{t}]</span>{" "}
      <span className={`font-bold ${color}`}>{level}</span>{" "}
      <span className="text-cyan-400">{entry.type}</span>
      <span className="text-slate-500">{http}</span>
      {detail && <span className="text-slate-400"> — {detail}</span>}
    </div>
  );
})}
          </pre>
        )}
      </div>
    </div>
  );
};

/* ── Main Component ── */
const AdminWebhooks = ({ form, setForm, settings, updateSettings, handleSave, sendDailySummary }: AdminWebhooksProps) => {
  const loadedRef = useRef(false);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);

  // ─── Load private webhook URLs + migrate any legacy URLs from public doc ───
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const ref = doc(db, "siteSettingsPrivate", "webhooks");
        const snap = await getDoc(ref);
        const privateData = snap.exists() ? snap.data() : {};

        // Detect legacy URL fields living on the public settings doc
        const legacy = extractUrlFields(settings);
        const legacyKeys = Object.keys(legacy);

        if (legacyKeys.length > 0) {
          // Merge legacy → private (legacy wins for non-empty values)
          const merged = { ...privateData, ...legacy };
          await setDoc(ref, merged, { merge: true });
          // Clear legacy URL fields from the public settings doc
          await updateSettings(blankUrlFields());
          setForm((prev: any) => ({ ...prev, ...blankUrlFields(), ...merged }));
          setMigrated(true);
          toast.success(`ย้าย Webhook URLs (${legacyKeys.length} ฟิลด์) ไปยังที่จัดเก็บส่วนตัวเรียบร้อย`);
        } else {
          // Just hydrate form with private values
          setForm((prev: any) => ({ ...prev, ...privateData }));
        }
      } catch (e: any) {
        console.error("[AdminWebhooks] load private failed:", e);
        toast.error("โหลด Webhook URLs ไม่สำเร็จ — ตรวจสิทธิ์ Admin");
      } finally {
        setPrivateLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Override save: write URLs to private doc, settings (sans URLs) to public ───
  const saveAll = async () => {
    try {
      // Build full URL set (primary + Urls arrays). Trim and drop empty strings
      // so what we persist matches what the edge function will fan out to.
      const fullUrlSet: Record<string, any> = {};
      let totalExtras = 0;
      for (const base of URL_BASE_KEYS) {
        const primary = typeof form[base] === "string" ? form[base].trim() : "";
        fullUrlSet[base] = primary;
        if (base !== "discordWebhookUrl") {
          const raw = form[base + "Urls"];
          const arr = Array.isArray(raw)
            ? raw.map((u: any) => (typeof u === "string" ? u.trim() : "")).filter((u: string) => u.length > 0)
            : [];
          fullUrlSet[base + "Urls"] = arr;
          totalExtras += arr.length;
        }
      }
      console.log("[AdminWebhooks] Saving to siteSettingsPrivate/webhooks:", fullUrlSet);
      await setDoc(doc(db, "siteSettingsPrivate", "webhooks"), fullUrlSet, { merge: true });

      // Verify the write by reading back and counting arrays
      const verifySnap = await getDoc(doc(db, "siteSettingsPrivate", "webhooks"));
      const verifyData = verifySnap.data() || {};
      const persistedExtras = URL_BASE_KEYS
        .filter(b => b !== "discordWebhookUrl")
        .reduce((s, b) => s + (Array.isArray(verifyData[b + "Urls"]) ? verifyData[b + "Urls"].length : 0), 0);
      console.log(`[AdminWebhooks] Verified persisted extras count: ${persistedExtras} (expected ${totalExtras})`);

      // Strip URL fields out of `form` before delegating to parent save
      const cleaned = { ...form, ...blankUrlFields() };
      setForm(cleaned);
      await handleSave(cleaned);

      // Bust the edge-function URL cache so newly added URLs fan out on next event
      try {
        const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "";
        const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
        if (SUPABASE_URL) {
          await fetch(`${SUPABASE_URL}/functions/v1/send-webhook`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
            },
            body: JSON.stringify({ type: "__bust__", embeds: [], bustCache: true }),
          }).catch(() => {});
        }
      } catch { /* non-blocking */ }

      toast.success(`บันทึก Webhook สำเร็จ · URL หลัก + ${persistedExtras} URL เพิ่มเติม`);
      if (persistedExtras !== totalExtras) {
        toast.error(`⚠️ คาดว่าจะบันทึก ${totalExtras} URL เพิ่มเติม แต่ Firestore เก็บได้ ${persistedExtras}`);
      }
    } catch (e: any) {
      console.error("[AdminWebhooks] save failed:", e);
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || "unknown"));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Discord Webhook</h1>
        <p className="text-xs text-muted-foreground mt-0.5">ตั้งค่าการแจ้งเตือนผ่าน Discord แต่ละประเภท</p>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
          <Lock size={11} />
          <span>
            URLs จัดเก็บแบบส่วนตัว (admin-only) และส่งผ่าน Edge Function — เบราว์เซอร์ผู้ใช้ปกติเข้าถึงไม่ได้
            {migrated && <span className="ml-1 text-amber-400">· เพิ่งย้ายข้อมูลจากที่เก่ามาให้แล้ว</span>}
            {privateLoading && <span className="ml-1 opacity-70">· กำลังโหลด…</span>}
          </span>
        </div>
      </div>

      {/* Privacy / PII masking toggles */}
      <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">ความเป็นส่วนตัว (PII Masking)</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          เมื่อเปิด ระบบจะปิดบังอีเมล/IP บางส่วนก่อนเขียนลง log หรือส่งไป Discord (เช่น <code>jo***@gmail.com</code>, <code>123.45.x.x</code>)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors">
            <div>
              <div className="text-xs font-semibold text-foreground">Mask PII ใน Activity Logs</div>
              <div className="text-[10px] text-muted-foreground">ซ่อน email + IP ใน Firestore <code>activityLogs</code></div>
            </div>
            <div
              className={`toggle-slider shrink-0 ${form.logMaskPii ? "toggle-active" : ""}`}
              onClick={() => setForm({ ...form, logMaskPii: !form.logMaskPii })}
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2 cursor-pointer hover:bg-muted/20 transition-colors">
            <div>
              <div className="text-xs font-semibold text-foreground">Mask PII ใน Discord Webhooks</div>
              <div className="text-[10px] text-muted-foreground">ซ่อน email + IP ใน embed ที่ส่งไป Discord</div>
            </div>
            <div
              className={`toggle-slider shrink-0 ${form.webhookMaskPii ? "toggle-active" : ""}`}
              onClick={() => setForm({ ...form, webhookMaskPii: !form.webhookMaskPii })}
            />
          </label>
        </div>
      </div>

      {/* 2-column: Fallback + Daily Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fallback Webhook */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Webhook หลัก (Fallback)</h3>
          </div>
          <p className="text-[10px] text-muted-foreground">ใช้เป็น fallback เมื่อไม่ได้ตั้ง Webhook เฉพาะหมวด</p>
          <div className="flex gap-2">
            <input type="url" value={form.discordWebhookUrl || ""} onChange={(e) => setForm({ ...form, discordWebhookUrl: e.target.value })} className="input-glass flex-1 px-3 py-2 text-xs" placeholder="https://discord.com/api/webhooks/..." />
            <button onClick={() => testWebhook(form.discordWebhookUrl || "", "fallback", form.brandName)} className="btn-glass px-3 py-2 text-xs shrink-0 flex items-center gap-1"><Send size={13} /> ทดสอบ</button>
          </div>
        </div>

        {/* Daily Summary */}
        <div className="rounded-xl border border-border/30 bg-card/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">สรุปรายวัน</h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`toggle-slider ${form.dailySummaryEnabled ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, dailySummaryEnabled: !form.dailySummaryEnabled })} />
              <span className="text-xs text-foreground">เปิดใช้</span>
            </label>
            <input type="time" value={form.dailySummaryTime || "23:00"} onChange={(e) => setForm({ ...form, dailySummaryTime: e.target.value })} className="input-glass px-2 py-1.5 text-xs" />
          </div>
          {form.lastDailySummaryDate && <p className="text-[10px] text-muted-foreground">ส่งล่าสุด: {form.lastDailySummaryDate}</p>}
          <button onClick={() => sendDailySummary(settings, updateSettings, true)} disabled={!form.webhookDailySummary && !form.discordWebhookUrl} className="btn-glass w-full py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Send size={12} /> ส่งสรุปตอนนี้
          </button>
        </div>
      </div>

      {/* Webhook Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">📢 Webhook ตามหมวด</h2>
          <span className="text-[10px] text-muted-foreground bg-muted/20 px-2 py-0.5 rounded-full">รองรับหลาย URL ต่อหมวด</span>
        </div>

        {(() => {
          const events = form.webhookEventsEnabled || {};
          const setEnabled = (key: string, v: boolean) => setForm({ ...form, webhookEventsEnabled: { ...events, [key]: v } });
          const isOn = (key: string) => events[key] !== false;
          const wf = (testType: string) => ({ enabled: isOn(testType), onToggle: (v: boolean) => setEnabled(testType, v) });
          const bulkSet = (keys: string[], next: boolean) => {
            const updated = { ...events };
            keys.forEach((k) => { updated[k] = next; });
            setForm({ ...form, webhookEventsEnabled: updated });
          };
          const userKeys = ["signup", "login"];
          const shopKeys = ["keyClaim", "freeClaim", "keyImport", "keyDelete", "lowStock", "purchase"];
          const topupKeys = ["topUp", "topUpQR", "giftCode", "slipVerify"];
          const otherKeys = ["wheelSpin", "wheelKey", "dailySummary", "linkPage"];
          return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CategoryGroup icon={Users} title="ผู้ใช้งาน" count={2} eventKeys={userKeys} events={events} onBulkToggle={(v) => bulkSet(userKeys, v)}>
            <MultiWebhookField {...wf("signup")} emoji="🆕" label="สมัครสมาชิก" primaryValue={form.webhookSignup || ""} onPrimaryChange={(v) => setForm({ ...form, webhookSignup: v })} extraUrls={form.webhookSignupUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookSignupUrls: urls })} hint="แจ้งเตือนเมื่อมีผู้ใช้ใหม่ พร้อม IP, อุปกรณ์" brandName={form.brandName} testType="signup" />
            <SignupEmbedFieldToggles
              value={form.signupEmbedFields || {}}
              onChange={(next) => setForm({ ...form, signupEmbedFields: next })}
            />
            <MultiWebhookField {...wf("login")} emoji="🔑" label="เข้าสู่ระบบ" primaryValue={form.webhookLogin || ""} onPrimaryChange={(v) => setForm({ ...form, webhookLogin: v })} extraUrls={form.webhookLoginUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookLoginUrls: urls })} hint="แจ้งเตือนเมื่อผู้ใช้เข้าสู่ระบบ พร้อม IP, ยศ" brandName={form.brandName} testType="login" />
          </CategoryGroup>

          <CategoryGroup icon={ShoppingCart} title="ร้านค้า & คีย์" count={6} eventKeys={shopKeys} events={events} onBulkToggle={(v) => bulkSet(shopKeys, v)}>
            <MultiWebhookField {...wf("keyClaim")} emoji="🎫" label="กดคีย์ (ซื้อ/ตะกร้า)" primaryValue={form.webhookKeyClaim || ""} onPrimaryChange={(v) => setForm({ ...form, webhookKeyClaim: v })} extraUrls={form.webhookKeyClaimUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookKeyClaimUrls: urls })} hint="คีย์ที่ออกจากการซื้อปกติ/Reseller (ไม่รวมกดฟรี)" brandName={form.brandName} testType="keyClaim" />
            <MultiWebhookField {...wf("freeClaim")} emoji="🎁" label="กดฟรี (HightXCrew+)" primaryValue={form.webhookFreeClaim || ""} onPrimaryChange={(v) => setForm({ ...form, webhookFreeClaim: v })} extraUrls={form.webhookFreeClaimUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookFreeClaimUrls: urls })} hint="แอดมิน/ผู้มีสิทธิ กดฟรีพร้อมหลักฐาน" brandName={form.brandName} testType="freeClaim" />
            <MultiWebhookField {...wf("keyImport")} emoji="➕" label="เพิ่มคีย์เข้าสต็อก" primaryValue={form.webhookKeyImport || ""} onPrimaryChange={(v) => setForm({ ...form, webhookKeyImport: v })} extraUrls={form.webhookKeyImportUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookKeyImportUrls: urls })} hint="แจ้งเมื่อแอดมิน import คีย์ใหม่" brandName={form.brandName} testType="keyImport" />
            <MultiWebhookField {...wf("keyDelete")} emoji="🗑️" label="ลบคีย์ / Archive" primaryValue={form.webhookKeyDelete || ""} onPrimaryChange={(v) => setForm({ ...form, webhookKeyDelete: v })} extraUrls={form.webhookKeyDeleteUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookKeyDeleteUrls: urls })} hint="ลบเดี่ยว/จำนวนมาก/Archive 90 วัน" brandName={form.brandName} testType="keyDelete" />
            <div className="space-y-2">
              <MultiWebhookField {...wf("lowStock")} emoji="⚠️" label="คีย์ใกล้หมด" primaryValue={form.webhookLowStock || ""} onPrimaryChange={(v) => setForm({ ...form, webhookLowStock: v })} extraUrls={form.webhookLowStockUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookLowStockUrls: urls })} hint="แจ้งเตือนเฉพาะสินค้าที่เลือก + กำหนดจำนวนที่จะเตือนได้" brandName={form.brandName} testType="lowStock" />
              <LowStockAlertConfig form={form} setForm={setForm} />
            </div>
            <MultiWebhookField {...wf("purchase")} emoji="🛒" label="สรุปการซื้อ" primaryValue={form.webhookPurchase || ""} onPrimaryChange={(v) => setForm({ ...form, webhookPurchase: v })} extraUrls={form.webhookPurchaseUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookPurchaseUrls: urls })} brandName={form.brandName} testType="purchase" />
          </CategoryGroup>

          <CategoryGroup icon={Wallet} title="เติมเงิน & สลิป" count={4} eventKeys={topupKeys} events={events} onBulkToggle={(v) => bulkSet(topupKeys, v)}>
            <MultiWebhookField {...wf("topUp")} emoji="💰" label="เติมเงิน (สลิป/TrueWallet)" primaryValue={form.webhookTopUp || ""} onPrimaryChange={(v) => setForm({ ...form, webhookTopUp: v })} extraUrls={form.webhookTopUpUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookTopUpUrls: urls })} brandName={form.brandName} testType="topUp" />
            <MultiWebhookField {...wf("topUpQR")} emoji="📱" label="เติมเงินผ่าน QR" primaryValue={form.webhookTopUpQR || ""} onPrimaryChange={(v) => setForm({ ...form, webhookTopUpQR: v })} extraUrls={form.webhookTopUpQRUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookTopUpQRUrls: urls })} hint="แจ้งเตือนเมื่อชำระ QR สำเร็จ" brandName={form.brandName} testType="topUpQR" />
            <MultiWebhookField {...wf("giftCode")} emoji="🎁" label="แลก Gift Code" primaryValue={form.webhookGiftCode || ""} onPrimaryChange={(v) => setForm({ ...form, webhookGiftCode: v })} extraUrls={form.webhookGiftCodeUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookGiftCodeUrls: urls })} hint="แจ้งเตือนเมื่อมีการแลก Gift Code" brandName={form.brandName} testType="giftCode" />
            <MultiWebhookField {...wf("slipVerify")} emoji="🔍" label="ตรวจสลิป (Log)" primaryValue={form.webhookSlipVerify || ""} onPrimaryChange={(v) => setForm({ ...form, webhookSlipVerify: v })} extraUrls={form.webhookSlipVerifyUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookSlipVerifyUrls: urls })} hint="บันทึกทุกการตรวจสลิปทั้งสำเร็จ ซ้ำ และล้มเหลว — แนะนำปิดถ้าซ้ำกับ 'เติมเงิน'" brandName={form.brandName} testType="slipVerify" />
          </CategoryGroup>

          <CategoryGroup icon={BarChart3} title="อื่นๆ" count={4} eventKeys={otherKeys} events={events} onBulkToggle={(v) => bulkSet(otherKeys, v)}>
            <MultiWebhookField {...wf("wheelSpin")} emoji="🎡" label="หมุนวงล้อ" primaryValue={form.webhookWheelSpin || ""} onPrimaryChange={(v) => setForm({ ...form, webhookWheelSpin: v })} extraUrls={form.webhookWheelSpinUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookWheelSpinUrls: urls })} hint="แจ้งเตือนทุกครั้งที่ผู้ใช้หมุนวงล้อ" brandName={form.brandName} testType="wheelSpin" />
            <MultiWebhookField {...wf("wheelKey")} emoji="🔑" label="คีย์จากวงล้อ" primaryValue={form.webhookWheelKey || ""} onPrimaryChange={(v) => setForm({ ...form, webhookWheelKey: v })} extraUrls={form.webhookWheelKeyUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookWheelKeyUrls: urls })} hint="คีย์ที่ออกจากการหมุนวงล้อ (แยกจาก keyClaim)" brandName={form.brandName} testType="wheelKey" />
            <MultiWebhookField {...wf("dailySummary")} emoji="📊" label="สรุปรายวัน" primaryValue={form.webhookDailySummary || ""} onPrimaryChange={(v) => setForm({ ...form, webhookDailySummary: v })} extraUrls={form.webhookDailySummaryUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookDailySummaryUrls: urls })} brandName={form.brandName} testType="dailySummary" />
            <MultiWebhookField {...wf("linkPage")} emoji="🔗" label="Link รวม" primaryValue={form.webhookLinkPage || ""} onPrimaryChange={(v) => setForm({ ...form, webhookLinkPage: v })} extraUrls={form.webhookLinkPageUrls || []} onExtraUrlsChange={(urls) => setForm({ ...form, webhookLinkPageUrls: urls })} brandName={form.brandName} testType="linkPage" />
          </CategoryGroup>
        </div>
          );
        })()}
      </div>

      {/* Webhook Log */}
      <WebhookLogPanel />

      {/* Save */}
      <button onClick={saveAll} className="btn-gradient w-full py-3 text-sm flex items-center justify-center gap-2 rounded-xl"><Save size={15} /> บันทึกการตั้งค่า Webhook</button>
    </div>
  );
};

export default AdminWebhooks;
