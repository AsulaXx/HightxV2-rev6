/**
 * Centralized Discord Webhook Sender
 * - Multiple webhook URLs per type
 * - Per-event ON/OFF via settings.webhookEventsEnabled
 * - In-memory dedupe (URL + content hash) within window to avoid spam/duplicates
 * - Retries with exponential backoff (up to 3 attempts) on 429/5xx/network
 */

import { addWebhookLog } from "@/lib/webhookLogger";

export interface WebhookEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
  thumbnail?: { url: string };
  author?: { name: string; icon_url?: string; url?: string };
  image?: { url: string };
  url?: string;
}

export interface WebhookAttachment {
  name: string;
  contentType?: string;
  dataUrl?: string;
  base64?: string;
}

export type WebhookType =
  | "fallback"
  | "keyClaim"
  | "lowStock"
  | "dailySummary"
  | "linkPage"
  | "topUp"
  | "purchase"
  | "slipVerify"
  
  | "signup"
  | "login"
  | "wheelSpin"
  | "wheelKey"
  | "topUpQR"
  | "giftCode"
  | "keyImport"
  | "keyDelete"
  | "freeClaim";

export interface SendOptions {
  /** Custom dedupe key. Same key+URL within DEDUPE_WINDOW_MS will be skipped. */
  dedupeKey?: string;
  /** Override max retry attempts (default 3) */
  maxRetries?: number;
  /** Optional files forwarded to Discord as webhook attachments. */
  attachments?: WebhookAttachment[];
}

const keyMap: Record<WebhookType, string> = {
  fallback: "discordWebhookUrl",
  keyClaim: "webhookKeyClaim",
  lowStock: "webhookLowStock",
  dailySummary: "webhookDailySummary",
  linkPage: "webhookLinkPage",
  topUp: "webhookTopUp",
  purchase: "webhookPurchase",
  slipVerify: "webhookSlipVerify",
  
  signup: "webhookSignup",
  login: "webhookLogin",
  wheelSpin: "webhookWheelSpin",
  wheelKey: "webhookWheelKey",
  topUpQR: "webhookTopUpQR",
  giftCode: "webhookGiftCode",
  keyImport: "webhookKeyImport",
  keyDelete: "webhookKeyDelete",
  freeClaim: "webhookFreeClaim",
};

/**
 * Get all webhook URLs for a given type from settings.
 * @deprecated URLs are no longer stored in client-readable settings; this kept
 * only for legacy callers that inspected presence. Always returns [].
 */
export const getWebhookUrls = (_settings: any, _type: WebhookType): string[] => [];

/** Check whether this event type is enabled (default: true) */
export const isEventEnabled = (settings: any, type: WebhookType): boolean => {
  if (type === "fallback") return true;
  const map = settings?.webhookEventsEnabled;
  if (!map || typeof map !== "object") return true;
  // explicit false disables; undefined/true allowed
  return map[type] !== false;
};

// ─── In-memory dedupe (client-side, prevents double-sends from same tab) ───
const DEDUPE_WINDOW_MS = 15_000;
const dedupeMap = new Map<string, number>();
const fingerprint = (key: string) => key;
const sweep = () => {
  const now = Date.now();
  for (const [k, t] of dedupeMap) if (now - t > DEDUPE_WINDOW_MS) dedupeMap.delete(k);
};

const hashEmbeds = (embeds: WebhookEmbed[]): string => {
  // Simple stable hash from titles + first field values
  const parts = embeds.map(e => {
    const fields = (e.fields || []).slice(0, 3).map(f => `${f.name}=${f.value}`).join("|");
    return `${e.title}::${e.description || ""}::${fields}`;
  });
  return parts.join("##").slice(0, 240);
};

// ─── Edge function endpoint ───
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/send-webhook` : "";

/**
 * Send webhook via the `send-webhook` edge function.
 * URLs are stored privately in Firestore and resolved server-side.
 */
export const sendWebhook = async (
  settings: any,
  type: WebhookType,
  embeds: WebhookEmbed[],
  optsOrRetries: SendOptions | number = {}
): Promise<void> => {
  if (!isEventEnabled(settings, type)) {
    addWebhookLog({ type, url: "-", status: "skipped", embedTitle: embeds[0]?.title || type, reason: "event disabled" });
    return;
  }

  if (!ENDPOINT) {
    console.warn(`[webhook] Skipped "${type}" — endpoint not configured`);
    return;
  }

  const opts: SendOptions = typeof optsOrRetries === "number"
    ? { maxRetries: optsOrRetries }
    : (optsOrRetries || {});

  const embedTitle = embeds[0]?.title || type;
  const dedupeKey = opts.dedupeKey || hashEmbeds(embeds);

  // Local dedupe guard
  sweep();
  const fp = fingerprint(`${type}|${dedupeKey}`);
  const last = dedupeMap.get(fp);
  if (last && Date.now() - last < DEDUPE_WINDOW_MS) {
    addWebhookLog({ type, url: "edge", status: "skipped", embedTitle, reason: "duplicate within window" });
    return;
  }
  dedupeMap.set(fp, Date.now());

  try {
    const { getIdToken } = await import("@/lib/firebaseIdToken");
    const idToken = await getIdToken();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SUPABASE_KEY ? { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
      },
      body: JSON.stringify({ type, embeds, dedupeKey, attachments: opts.attachments || [], idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.status === "delivered") {
      addWebhookLog({ type, url: "edge", status: "success", httpStatus: 200, embedTitle, attempts: 1 });
    } else if (data?.status === "skipped") {
      addWebhookLog({ type, url: "edge", status: "skipped", embedTitle, reason: data.reason || "skipped" });
    } else {
      addWebhookLog({ type, url: "edge", status: "failed", httpStatus: res.status, embedTitle, error: data?.error, attempts: 1 });
    }
  } catch (err) {
    addWebhookLog({ type, url: "edge", status: "failed", error: String(err), embedTitle, attempts: 1 });
    console.error(`Webhook proxy failed [${type}]:`, err);
  }
};

/**
 * Get client info for tracking (IP will be fetched, device from navigator)
 */
export const getClientInfo = async (): Promise<{
  ip: string;
  userAgent: string;
  platform: string;
  language: string;
  screenSize: string;
  timezone: string;
}> => {
  let ip = "Unknown";
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    ip = data.ip || "Unknown";
  } catch {
    try {
      const res = await fetch("https://checkip.amazonaws.com/", { signal: AbortSignal.timeout(3000) });
      ip = (await res.text()).trim() || "Unknown";
    } catch { ip = "Unknown"; }
  }

  return {
    ip,
    userAgent: navigator.userAgent || "Unknown",
    platform: navigator.platform || "Unknown",
    language: navigator.language || "Unknown",
    screenSize: `${window.screen.width}x${window.screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Unknown",
  };
};

/**
 * Parse user agent into readable device info
 */
export const parseUserAgent = (ua: string): string => {
  if (!ua) return "Unknown";
  let device = "";
  if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/iPad/i.test(ua)) device = "iPad";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Mac/i.test(ua)) device = "macOS";
  else if (/Linux/i.test(ua)) device = "Linux";
  else device = "Other";

  let browser = "";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edge/i.test(ua)) browser = "Edge";
  else browser = "Other";

  return `${device} / ${browser}`;
};
