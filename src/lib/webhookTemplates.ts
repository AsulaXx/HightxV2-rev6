/**
 * Centralized Discord Webhook Embed Templates
 * All embed structures in one place for easy maintenance
 */

import type { WebhookEmbed } from "./webhookSender";

// ─── Color Constants ───
export const WEBHOOK_COLORS = {
  success: 0x22c55e,
  error: 0xef4444,
  warning: 0xf59e0b,
  info: 0x3b82f6,
  orange: 0xf97316,
  ban: 0xff0000,
  purple: 0xa855f7,
} as const;

// ─── Helper: timestamp + footer ───
const meta = (brandName: string) => ({
  timestamp: new Date().toISOString(),
  footer: { text: brandName },
});

const cleanText = (value?: unknown): string => {
  const text = String(value ?? "").trim();
  return text || "-";
};

const inlineCode = (value?: unknown): string => `\`${cleanText(value).replace(/`/g, "ˋ").slice(0, 900)}\``;

const moneyText = (amount: number): string => `**฿${(Number(amount) || 0).toLocaleString()}**`;

const extractEmail = (userDisplay?: string): string => {
  const match = cleanText(userDisplay).match(/\(([^)]+@[^)]+)\)/);
  return match?.[1] || "-";
};

const extractUserName = (userDisplay?: string): string => cleanText(userDisplay).replace(/\s*\([^)]*\)\s*$/, "") || "-";

const formatTransferTime = (value?: string): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const topUpAuthor = (brandName: string, label: string) => ({
  author: { name: `${cleanText(brandName)} • ${label}` },
});

type ModernTopUpBase = {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  transRef: string;
  channel?: string;
  deviceInfo?: string;
  senderBank?: string;
  senderName?: string;
  receiverBank?: string;
  receiverName?: string;
  date?: string;
  transferAt?: string;
};

const modernTopUpFields = (p: ModernTopUpBase): NonNullable<WebhookEmbed["fields"]> => [
  { name: "👤 USERNAME", value: inlineCode(p.userName || extractUserName(p.userDisplay)), inline: true },
  { name: "📧 USER EMAIL", value: inlineCode(p.userEmail || extractEmail(p.userDisplay)), inline: true },
  { name: "💵 จำนวนเงิน", value: moneyText(p.amount), inline: true },
  { name: "🧾 REF", value: inlineCode(p.transRef), inline: true },
  { name: "🌐 ช่องทาง", value: inlineCode(p.channel), inline: true },
  { name: "📱 อุปกรณ์", value: inlineCode(p.deviceInfo), inline: true },
  {
    name: "💸 ชื่อคนโอน",
    value: `${inlineCode(p.senderName)}${p.senderBank ? `\n${inlineCode(p.senderBank)}` : ""}`,
    inline: true,
  },
  {
    name: "🏪 ชื่อคนรับเงิน",
    value: `${inlineCode(p.receiverName)}${p.receiverBank ? `\n${inlineCode(p.receiverBank)}` : ""}`,
    inline: true,
  },
  { name: "🕒 เวลาที่โอน", value: inlineCode(formatTransferTime(p.transferAt || p.date)), inline: true },
];

const productImage = (imageUrl?: string) =>
  imageUrl?.trim() ? { thumbnail: { url: imageUrl.trim() } } : {};

// ─── PII Masking Helpers ───
/** Mask email: keep first 2 chars + domain → "ab***@example.com" */
export const maskEmail = (email: string): string => {
  if (!email || typeof email !== "string") return email;
  const at = email.indexOf("@");
  if (at < 1) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0]}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
};

/** Mask IP: keep first 2 octets → "203.150.xxx.xxx" (IPv4) or first 4 segments (IPv6) */
export const maskIp = (ip: string): string => {
  if (!ip || typeof ip !== "string") return ip;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 4).join(":") + "::xxxx";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.xxx.xxx`;
};

/** Read masking flag from settings — default false (admins see full info). */
export const isPiiMaskingEnabled = (settings: any): boolean =>
  settings?.webhookMaskPii === true;


// ─── Top-Up Templates ───

export const topUpSuccessEmbed = (p: {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  transRef: string;
  senderBank: string;
  senderName: string;
  receiverBank: string;
  receiverName: string;
  date: string;
  channel?: string;
  deviceInfo?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => ({
  title: "✅ TOP-UP CONFIRMED",
  description: "> รายการเติมเงินสำเร็จและเครดิตถูกบันทึกเข้าระบบแล้ว",
  color: WEBHOOK_COLORS.success,
  fields: modernTopUpFields({ ...p, channel: p.channel || "สลิปธนาคาร" }),
  ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
  ...topUpAuthor(p.brandName, "Payment Monitor"),
  ...meta(p.brandName),
});

export const topUpTrueWalletSuccessEmbed = (p: {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  creditAmount: number;
  feeEnabled: boolean;
  feePercent: number;
  transRef: string;
  senderName: string;
  receiverName?: string;
  receiverBank?: string;
  date?: string;
  channel?: string;
  deviceInfo?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => ({
  title: "✅ TRUEWALLET TOP-UP CONFIRMED",
  description: "> รายการเติมเงิน TrueWallet สำเร็จและเครดิตถูกบันทึกเข้าระบบแล้ว",
  color: WEBHOOK_COLORS.orange,
  fields: [
    ...modernTopUpFields({
      ...p,
      channel: p.channel || "TrueWallet",
      senderBank: "TrueWallet",
      receiverBank: p.receiverBank || "TrueWallet",
      receiverName: p.receiverName || "-",
    }),
    { name: "💳 เครดิตเข้า", value: p.feeEnabled ? `${moneyText(p.creditAmount)}\n\`fee ${p.feePercent}%\`` : moneyText(p.creditAmount), inline: false },
  ],
  ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
  ...topUpAuthor(p.brandName, "Payment Monitor"),
  ...meta(p.brandName),
});

export const duplicateSlipEmbed = (p: {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  transRef: string;
  channel: string;
  source: string;
  senderInfo?: string;
  senderName?: string;
  senderBank?: string;
  receiverName?: string;
  receiverBank?: string;
  date?: string;
  deviceInfo?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => ({
  title: "⚠️ DUPLICATE TOP-UP DETECTED",
  description: "> ตรวจพบรายการที่เคยถูกใช้งานแล้ว ระบบไม่เพิ่มเครดิตซ้ำ",
  color: WEBHOOK_COLORS.error,
  fields: [
    ...modernTopUpFields({
      ...p,
      senderName: p.senderName || p.senderInfo || "-",
      senderBank: p.senderBank,
      receiverName: p.receiverName,
      receiverBank: p.receiverBank,
    }),
    { name: "🔍 ตรวจพบโดย", value: inlineCode(p.source), inline: false },
  ],
  ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
  ...topUpAuthor(p.brandName, "Duplicate Guard"),
  ...meta(p.brandName),
});

export const wrongAccountBankEmbed = (p: {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  transRef: string;
  senderBank: string;
  senderName: string;
  receiverBank: string;
  receiverName: string;
  receiverAccount: string;
  channel?: string;
  date?: string;
  deviceInfo?: string;
  reasons: string[];
  thunderMatch: string;
  localAccounts?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => ({
  title: "🚨 WRONG RECEIVER ACCOUNT",
  description: "> ระบบปฏิเสธรายการนี้เพราะบัญชีปลายทางไม่ตรงกับบัญชีร้าน",
  color: WEBHOOK_COLORS.ban,
  fields: [
    ...modernTopUpFields({ ...p, channel: p.channel || "สลิปธนาคาร" }),
    { name: "🏦 เลขบัญชีปลายทาง", value: inlineCode(p.receiverAccount), inline: true },
    { name: "⚠️ สาเหตุ", value: `\`\`\`text\n${p.reasons.join('\n').slice(0, 700)}\n\`\`\``, inline: false },
    { name: "🔒 Thunder Match", value: inlineCode(p.thunderMatch), inline: true },
    ...(p.localAccounts ? [{ name: "🔒 บัญชีร้าน (Local)", value: inlineCode(p.localAccounts), inline: true }] : []),
  ],
  ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
  ...topUpAuthor(p.brandName, "Receiver Guard"),
  ...meta(p.brandName),
});

export const wrongAccountTrueWalletEmbed = (p: {
  userDisplay: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  transRef: string;
  senderName: string;
  receiverName?: string;
  receiverPhone: string;
  shopPhone: string;
  date?: string;
  deviceInfo?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => ({
  title: "🚨 WRONG TRUEWALLET RECEIVER",
  description: "> ระบบปฏิเสธรายการนี้เพราะเบอร์ TrueWallet ปลายทางไม่ตรงกับเบอร์ร้าน",
  color: WEBHOOK_COLORS.ban,
  fields: [
    ...modernTopUpFields({
      ...p,
      channel: "TrueWallet",
      senderBank: "TrueWallet",
      receiverBank: "TrueWallet",
      receiverName: p.receiverName || p.receiverPhone,
    }),
    { name: "📱 โอนไปเบอร์", value: inlineCode(p.receiverPhone), inline: true },
    { name: "🏪 เบอร์ร้าน", value: inlineCode(p.shopPhone), inline: true },
  ],
  ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
  ...topUpAuthor(p.brandName, "Receiver Guard"),
  ...meta(p.brandName),
});

export const autoBanEmbed = (p: {
  userName: string;
  totalCount: number;
  wrongCount: number;
  dupCount: number;
  lastReason: string;
  brandName: string;
}): WebhookEmbed => ({
  title: "🔨 แบนอัตโนมัติ!",
  color: WEBHOOK_COLORS.ban,
  description: `ผู้ใช้ **${p.userName}** ถูกแบนอัตโนมัติ`,
  fields: [
    { name: "👤 ผู้ใช้", value: p.userName, inline: true },
    { name: "🔢 รวมทั้งหมด", value: `${p.totalCount} ครั้ง`, inline: true },
    { name: "❌ บัญชีผิด", value: `${p.wrongCount} ครั้ง`, inline: true },
    { name: "🔁 สลิปซ้ำ", value: `${p.dupCount} ครั้ง`, inline: true },
    { name: "⚠️ ครั้งล่าสุด", value: p.lastReason.slice(0, 200), inline: false },
  ],
  ...meta(p.brandName),
});

// ─── Slip Verify Log Templates ───

export const slipVerifyEmbed = (p: {
  result: "success" | "duplicate" | "failed";
  userDisplay: string;
  amount: number;
  transRef: string;
  method: "bank" | "truewallet";
  senderBank?: string;
  senderName?: string;
  receiverBank?: string;
  receiverName?: string;
  errorMessage?: string;
  brandName: string;
  slipAttachmentName?: string;
}): WebhookEmbed => {
  const emojiMap = { success: "✅", duplicate: "⚠️", failed: "❌" };
  const labelMap = { success: "สำเร็จ", duplicate: "สลิปซ้ำ", failed: "ล้มเหลว" };
  const colorMap = { success: WEBHOOK_COLORS.success, duplicate: WEBHOOK_COLORS.error, failed: WEBHOOK_COLORS.warning };

  return {
    title: `${emojiMap[p.result]} ตรวจสลิป - ${labelMap[p.result]}`,
    color: colorMap[p.result],
    fields: [
      { name: "👤 ผู้ใช้", value: p.userDisplay, inline: true },
      { name: "💵 จำนวน", value: `฿${p.amount.toLocaleString()}`, inline: true },
      { name: "📝 Ref", value: `\`${p.transRef}\``, inline: true },
      { name: "📱 ช่องทาง", value: "web", inline: true },
      { name: "🏦 ประเภท", value: p.method === "bank" ? "สลิปธนาคาร" : "TrueWallet", inline: true },
      ...(p.senderBank ? [{ name: "🏦 จาก", value: `${p.senderBank} - ${p.senderName}`, inline: true }] : []),
      ...(p.receiverName ? [{ name: "🏦 ถึง", value: `${p.receiverBank || ''} - ${p.receiverName}`, inline: true }] : []),
      ...(p.errorMessage ? [{ name: "❗ หมายเหตุ", value: p.errorMessage.slice(0, 200), inline: false }] : []),
    ],
    ...(p.slipAttachmentName ? { image: { url: `attachment://${p.slipAttachmentName}` } } : {}),
    ...meta(p.brandName),
  };
};

// ─── Auth Templates ───

export const loginEmbed = (p: {
  userName: string;
  email: string;
  role: string;
  method: string;
  deviceInfo: string;
  ip: string;
  brandName: string;
}): WebhookEmbed => ({
  title: "🔐 เข้าสู่ระบบ",
  color: WEBHOOK_COLORS.info,
  fields: [
    { name: "👤 ผู้ใช้", value: p.userName, inline: true },
    { name: "📧 อีเมล", value: p.email, inline: true },
    { name: "🎖️ Role", value: p.role, inline: true },
    { name: "🔑 วิธีล็อกอิน", value: p.method, inline: true },
    { name: "📱 อุปกรณ์", value: p.deviceInfo, inline: true },
    { name: "🌐 IP", value: p.ip, inline: true },
  ],
  ...meta(p.brandName),
});

export type SignupEmbedFieldKey = "method" | "device" | "ip" | "timezone" | "language" | "screen" | "referrer";

export const signupEmbed = (p: {
  userName: string;
  email: string;
  method: string;            // Email / Google / Email Link
  deviceInfo: string;
  ip: string;
  timezone?: string;
  language?: string;
  screenSize?: string;
  referrer?: string;
  brandName: string;
  /** Per-field ON/OFF map. Missing key = ON. userName & email are always shown. */
  fieldsEnabled?: Partial<Record<SignupEmbedFieldKey, boolean>>;
}): WebhookEmbed => {
  const on = (k: SignupEmbedFieldKey) => p.fieldsEnabled?.[k] !== false;
  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "👤 ชื่อ", value: p.userName, inline: true },
    { name: "📧 อีเมล", value: p.email, inline: true },
  ];
  if (on("method")) fields.push({ name: "🔑 วิธีสมัคร", value: p.method, inline: true });
  if (on("device")) fields.push({ name: "📱 อุปกรณ์", value: p.deviceInfo, inline: true });
  if (on("ip")) fields.push({ name: "🌐 IP", value: p.ip, inline: true });
  if (on("timezone")) fields.push({ name: "🕐 Timezone", value: p.timezone || "-", inline: true });
  if (on("language")) fields.push({ name: "🗣️ ภาษา", value: p.language || "-", inline: true });
  if (on("screen")) fields.push({ name: "🖥️ หน้าจอ", value: p.screenSize || "-", inline: true });
  if (on("referrer")) fields.push({ name: "↪️ Referrer", value: p.referrer || "ตรง (Direct)", inline: true });
  return {
    title: "🎉 สมาชิกใหม่!",
    description: `ยินดีต้อนรับ **${p.userName}** เข้าสู่ระบบ`,
    color: WEBHOOK_COLORS.success,
    fields,
    ...meta(p.brandName),
  };
};

// ─── Wheel Spin Template ───

export const wheelSpinEmbed = (p: {
  userDisplay: string;
  wheelName: string;
  prizeLabel: string;
  rewardType: "credit" | "product" | "custom";
  creditAmount?: number;
  productName?: string;
  productKey?: string;
  productImageUrl?: string;
  cost: number;
  attemptId: string;
  brandName: string;
}): WebhookEmbed => {
  const rewardText =
    p.rewardType === "credit"
      ? `💎 เครดิต ฿${(p.creditAmount || 0).toLocaleString()}`
      : p.rewardType === "product"
      ? `📦 ${p.productName || p.prizeLabel}${p.productKey ? `\n🔑 \`${p.productKey}\`` : ""}`
      : `🎁 ${p.prizeLabel}`;

  return {
    title: "🎡 หมุนวงล้อ",
    color: WEBHOOK_COLORS.purple,
    fields: [
      { name: "👤 ผู้ใช้", value: p.userDisplay, inline: true },
      { name: "🎯 วงล้อ", value: p.wheelName, inline: true },
      { name: "💸 ค่าหมุน", value: p.cost > 0 ? `฿${p.cost.toLocaleString()}` : "ฟรี", inline: true },
      { name: "🏆 รางวัล", value: rewardText, inline: false },
      { name: "🆔 Attempt", value: `\`${p.attemptId}\``, inline: false },
    ],
    ...productImage(p.productImageUrl),
    ...meta(p.brandName),
  };
};

// ─── Top-Up QR Template ───

export const topUpQrSuccessEmbed = (p: {
  userDisplay: string;
  amount: number;
  reference: string;
  provider: string;
  brandName: string;
}): WebhookEmbed => ({
  title: "📱 เติมเงินผ่าน QR สำเร็จ",
  color: WEBHOOK_COLORS.success,
  fields: [
    { name: "👤 ผู้ใช้", value: p.userDisplay, inline: true },
    { name: "💵 จำนวน", value: `฿${p.amount.toLocaleString()}`, inline: true },
    { name: "🏷️ Provider", value: p.provider.toUpperCase(), inline: true },
    { name: "📝 Ref", value: `\`${p.reference}\``, inline: false },
  ],
  ...meta(p.brandName),
});

// ─── Gift Code Template ───

export const giftCodeRedeemEmbed = (p: {
  userDisplay: string;
  code: string;
  amount: number;
  attemptId: string;
  brandName: string;
}): WebhookEmbed => ({
  title: "🎁 แลก Gift Code สำเร็จ",
  color: WEBHOOK_COLORS.purple,
  fields: [
    { name: "👤 ผู้ใช้", value: p.userDisplay, inline: true },
    { name: "💵 จำนวน", value: `฿${p.amount.toLocaleString()}`, inline: true },
    { name: "🎟️ Code", value: `\`${p.code}\``, inline: true },
    { name: "🆔 Attempt", value: `\`${p.attemptId}\``, inline: false },
  ],
  ...meta(p.brandName),
});

// ─── Key Stock Activity Template ───
// Centralized embed for ANY event that pulls a key out of stock
// (user purchase, wheel reward, admin manual delete, bulk delete, archive)

export type KeyStockAction =
  | "purchase"      // user bought from store/cart
  | "wheel"         // user won via wheel spin
  | "admin_delete"  // admin removed a single key
  | "bulk_delete"   // admin removed many keys at once
  | "archive";      // admin archived old claimed keys

const KEY_ACTION_META: Record<KeyStockAction, { title: string; color: number; emoji: string }> = {
  purchase:     { title: "กดคีย์จากตะกร้า",      color: WEBHOOK_COLORS.success, emoji: "🛒" },
  wheel:        { title: "คีย์รางวัลจากวงล้อ",   color: WEBHOOK_COLORS.purple,  emoji: "🎰" },
  admin_delete: { title: "แอดมินลบคีย์",          color: WEBHOOK_COLORS.warning, emoji: "🗑️" },
  bulk_delete:  { title: "แอดมินลบคีย์จำนวนมาก", color: WEBHOOK_COLORS.error,   emoji: "🧹" },
  archive:      { title: "Archive คีย์เก่า",      color: WEBHOOK_COLORS.info,    emoji: "📦" },
};

export const keyStockActivityEmbed = (p: {
  action: KeyStockAction;
  actorDisplay: string;          // who performed (user or admin)
  actorRole?: string;
  productName?: string;
  productImageUrl?: string;
  durationLabel?: string;
  count?: number;                // # of keys involved (default 1)
  keys?: string[];               // up to first ~10 keys to show
  note?: string;                 // extra context (wheel name, batch id, etc.)
  refId?: string;                // attempt/batch id for traceability
  brandName: string;
}): WebhookEmbed => {
  const m = KEY_ACTION_META[p.action];
  const count = p.count ?? (p.keys?.length || 1);
  const fields: WebhookEmbed["fields"] = [
    { name: "👤 ผู้ทำรายการ", value: p.actorDisplay, inline: true },
    { name: "🎭 บทบาท", value: p.actorRole || "user", inline: true },
    { name: "🔢 จำนวน", value: `${count.toLocaleString()} คีย์`, inline: true },
  ];
  if (p.productName) {
    fields.push({
      name: "📦 สินค้า",
      value: `${p.productName}${p.durationLabel ? ` — ${p.durationLabel}` : ""}`,
      inline: false,
    });
  }
  if (p.keys && p.keys.length) {
    const shown = p.keys.slice(0, 10).map(k => `\`${k}\``).join("\n");
    const extra = p.keys.length > 10 ? `\n…และอีก ${p.keys.length - 10} คีย์` : "";
    fields.push({ name: "🔑 คีย์", value: shown + extra, inline: false });
  }
  if (p.note) fields.push({ name: "📝 หมายเหตุ", value: p.note, inline: false });
  if (p.refId) fields.push({ name: "🆔 Ref", value: `\`${p.refId}\``, inline: false });

  return {
    title: `${m.emoji} ${m.title}`,
    color: m.color,
    fields,
    ...productImage(p.productImageUrl),
    ...meta(p.brandName),
  };
};

// ─── Key Import Template (admin/HightXCrew adds keys to stock) ───
export const keyImportEmbed = (p: {
  actorDisplay: string;
  actorRole: string;
  productName: string;
  productImageUrl?: string;
  durationLabel?: string;
  count: number;
  duplicateCount?: number;
  source?: string;        // "manual" | "csv" | "txt" | "paste" | etc.
  sampleKeys?: string[];  // first ~5 keys for traceability
  brandName: string;
}): WebhookEmbed => {
  const fields: WebhookEmbed["fields"] = [
    { name: "👤 ผู้เพิ่ม", value: p.actorDisplay, inline: true },
    { name: "🎭 บทบาท", value: p.actorRole, inline: true },
    { name: "🔢 เพิ่มสำเร็จ", value: `${p.count.toLocaleString()} คีย์`, inline: true },
    {
      name: "📦 สินค้า",
      value: `${p.productName}${p.durationLabel ? ` — ${p.durationLabel}` : ""}`,
      inline: false,
    },
  ];
  if (p.duplicateCount && p.duplicateCount > 0) {
    fields.push({ name: "♻️ ข้ามซ้ำ", value: `${p.duplicateCount.toLocaleString()} คีย์`, inline: true });
  }
  if (p.source) fields.push({ name: "📥 แหล่งที่มา", value: p.source, inline: true });
  if (p.sampleKeys && p.sampleKeys.length) {
    const shown = p.sampleKeys.slice(0, 5).map((k) => `\`${k}\``).join("\n");
    const extra = p.count > p.sampleKeys.length ? `\n…และอีก ${p.count - p.sampleKeys.length} คีย์` : "";
    fields.push({ name: "🔑 ตัวอย่างคีย์", value: shown + extra, inline: false });
  }
  return {
    title: "➕ เพิ่มคีย์เข้าสต็อก",
    color: WEBHOOK_COLORS.success,
    fields,
    ...productImage(p.productImageUrl),
    ...meta(p.brandName),
  };
};

// ─── Key Delete Template (admin removes keys from stock) ───
export const keyDeleteEmbed = (p: {
  mode: "single" | "bulk" | "archive";
  actorDisplay: string;
  actorRole: string;
  count: number;
  productName?: string;
  productImageUrl?: string;
  durationLabel?: string;
  reason?: string;
  sampleKeys?: string[];
  brandName: string;
}): WebhookEmbed => {
  const titleMap = {
    single: "🗑️ แอดมินลบคีย์",
    bulk: "🧹 แอดมินลบคีย์จำนวนมาก",
    archive: "📦 Archive คีย์เก่า",
  };
  const colorMap = {
    single: WEBHOOK_COLORS.warning,
    bulk: WEBHOOK_COLORS.error,
    archive: WEBHOOK_COLORS.info,
  };
  const fields: WebhookEmbed["fields"] = [
    { name: "👤 ผู้ลบ", value: p.actorDisplay, inline: true },
    { name: "🎭 บทบาท", value: p.actorRole, inline: true },
    { name: "🔢 จำนวน", value: `${p.count.toLocaleString()} คีย์`, inline: true },
  ];
  if (p.productName) {
    fields.push({
      name: "📦 สินค้า",
      value: `${p.productName}${p.durationLabel ? ` — ${p.durationLabel}` : ""}`,
      inline: false,
    });
  }
  if (p.sampleKeys && p.sampleKeys.length) {
    const shown = p.sampleKeys.slice(0, 5).map((k) => `\`${k}\``).join("\n");
    const extra = p.count > p.sampleKeys.length ? `\n…และอีก ${p.count - p.sampleKeys.length} คีย์` : "";
    fields.push({ name: "🔑 ตัวอย่างคีย์", value: shown + extra, inline: false });
  }
  if (p.reason) fields.push({ name: "📝 เหตุผล", value: p.reason.slice(0, 300), inline: false });
  return {
    title: titleMap[p.mode],
    color: colorMap[p.mode],
    fields,
    ...productImage(p.productImageUrl),
    ...meta(p.brandName),
  };
};

// ─── Free Claim Template (HightXCrew+ ดึงคีย์ฟรีพร้อมหลักฐาน) ───
export const freeClaimEmbed = (p: {
  actorDisplay: string;
  actorEmail?: string;
  actorRole: string;
  totalCount: number;
  groups: { productName: string; durationLabel: string; keys: string[]; productImageUrl?: string }[];
  message?: string;
  hasProofImage?: boolean;
  proofAttachmentName?: string;
  brandName: string;
}): WebhookEmbed => {
  const fields: WebhookEmbed["fields"] = [
    { name: "👤 ผู้กดฟรี", value: p.actorDisplay, inline: true },
    { name: "📧 อีเมล", value: p.actorEmail || "-", inline: true },
    { name: "🎭 บทบาท", value: p.actorRole, inline: true },
    { name: "🔢 จำนวนรวม", value: `${p.totalCount.toLocaleString()} คีย์`, inline: true },
    { name: "🖼️ แนบหลักฐาน", value: p.hasProofImage ? "✅ ใช่" : "❌ ไม่", inline: true },
  ];
  if (p.message?.trim()) {
    fields.push({ name: "💬 หมายเหตุ", value: p.message.trim().slice(0, 800), inline: false });
  }
  for (const g of p.groups) {
    const chunks: string[][] = [];
    let cur: string[] = [];
    let len = 0;
    for (const k of g.keys) {
      const entry = `\`${k}\``;
      if (len + entry.length + 2 > 900 && cur.length) {
        chunks.push(cur);
        cur = [];
        len = 0;
      }
      cur.push(entry);
      len += entry.length + 2;
    }
    if (cur.length) chunks.push(cur);
    chunks.forEach((c, i) => {
      fields.push({
        name: `📦 ${g.productName} (${g.durationLabel})${chunks.length > 1 ? ` [${i + 1}/${chunks.length}]` : ""}`,
        value: c.join("\n"),
        inline: false,
      });
    });
  }
  return {
    title: `🎁 กดคีย์ฟรี (${p.totalCount} คีย์)`,
    color: WEBHOOK_COLORS.purple,
    fields,
    ...(p.proofAttachmentName
      ? { image: { url: `attachment://${p.proofAttachmentName}` } }
      : productImage(p.groups.find((g) => g.productImageUrl)?.productImageUrl)),
    ...meta(p.brandName),
  };
};
