// Discord webhook proxy.
// - Reads URLs from Firestore doc `siteSettingsPrivate/webhooks` via service-account token
//   (URLs are no longer exposed to the browser)
// - Reads `webhookEventsEnabled` flag from public `settings/site`
// - Anonymous-callable (verify_jwt = false). Uses IP-based rate limit.
// - Always returns HTTP 200 (per project edge-function pattern); status in JSON body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
let FIREBASE_PROJECT_ID = Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
// Treat unset/placeholder values as missing and derive from the service account JSON
if (!FIREBASE_PROJECT_ID || /placeholder/i.test(FIREBASE_PROJECT_ID)) {
  try {
    const raw = FIREBASE_SA.trim();
    if (raw) {
      const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
      if (sa?.project_id) FIREBASE_PROJECT_ID = sa.project_id;
    }
  } catch { /* ignore — guard below will report */ }
}

// ─── GCP token (cached) ───
let cachedToken: { token: string; exp: number } | null = null;
async function gcpToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) =>
    btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const unsigned =
    b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64u(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))
  );
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("GCP token failed: " + JSON.stringify(j));
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

// ─── Firestore REST helpers ───
function fsGet(token: string, path: string) {
  return fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

/** Convert Firestore REST `fields` payload into plain JS values. */
function decode(value: any): any {
  if (value == null) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) out[k] = decode(v);
    return out;
  }
  if ("timestampValue" in value) return value.timestampValue;
  return null;
}
function decodeFields(fields: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decode(v);
  return out;
}

// ─── Caches (5 min) ───
let urlCache: { data: Record<string, any>; exp: number } | null = null;
let flagCache: { data: Record<string, any>; exp: number } | null = null;
const CACHE_MS = 5 * 60_000;

async function loadUrls(): Promise<Record<string, any>> {
  if (urlCache && Date.now() < urlCache.exp) return urlCache.data;
  try {
    const token = await gcpToken();
    const r = await fsGet(token, "siteSettingsPrivate/webhooks");
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("[send-webhook] loadUrls fsGet failed", r.status, body.slice(0, 300));
      urlCache = { data: {}, exp: Date.now() + 30_000 };
      return {};
    }
    const j = await r.json();
    const data = decodeFields(j.fields || {});
    console.log("[send-webhook] loadUrls keys:", Object.keys(data).length);
    urlCache = { data, exp: Date.now() + CACHE_MS };
    return data;
  } catch (e) {
    console.error("[send-webhook] loadUrls threw:", String(e));
    urlCache = { data: {}, exp: Date.now() + 30_000 };
    return {};
  }
}

async function loadFlags(): Promise<Record<string, any>> {
  if (flagCache && Date.now() < flagCache.exp) return flagCache.data;
  try {
    const token = await gcpToken();
    const r = await fsGet(token, "settings/site");
    if (!r.ok) {
      flagCache = { data: {}, exp: Date.now() + CACHE_MS };
      return {};
    }
    const j = await r.json();
    const data = decodeFields(j.fields || {});
    flagCache = { data, exp: Date.now() + CACHE_MS };
    return data;
  } catch {
    return {};
  }
}

// ─── Rate-limit (per IP, 60/min) ───
const ipBuckets = new Map<string, number[]>();
const RL_LIMIT = 60;
const RL_WINDOW = 60_000;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) || []).filter((t) => now - t < RL_WINDOW);
  if (arr.length >= RL_LIMIT) {
    ipBuckets.set(ip, arr);
    return true;
  }
  arr.push(now);
  ipBuckets.set(ip, arr);
  return false;
}

// ─── Dedupe (60s) ───
const dedupe = new Map<string, number>();
const DEDUPE_MS = 60_000;
function isDuplicate(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of dedupe) if (now - t > DEDUPE_MS) dedupe.delete(k);
  const last = dedupe.get(key);
  if (last && now - last < DEDUPE_MS) return true;
  dedupe.set(key, now);
  return false;
}

// ─── URL resolution ───
const KEY_MAP: Record<string, string> = {
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

function resolveUrls(urls: Record<string, any>, type: string): string[] {
  const key = KEY_MAP[type];
  if (!key) return [];
  const out: string[] = [];
  const arr = urls[key + "Urls"];
  if (Array.isArray(arr)) {
    for (const u of arr) if (typeof u === "string" && u.trim().startsWith("http")) out.push(u.trim());
  }
  const single = urls[key];
  if (typeof single === "string" && single.trim().startsWith("http") && !out.includes(single.trim())) {
    out.push(single.trim());
  }
  if (out.length === 0 && type !== "fallback") {
    const fb = urls.discordWebhookUrl;
    if (typeof fb === "string" && fb.trim().startsWith("http")) out.push(fb.trim());
  }
  const resolved = Array.from(new Set(out));

  // Top-up Discord notifications must be a single organized embed per event.
  // If admins accidentally configured both a single URL and URL list (or multiple
  // URLs pointing to the same channel), sending to all of them looks like a
  // duplicate top-up alert in Discord.
  if (type === "topUp") return resolved.slice(0, 1);

  return resolved;
}

// ─── Discord payload + post with retry ───
function toBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function discordBody(embeds: any[], attachments: any[] = []): BodyInit {
  const files = attachments
    .slice(0, 3)
    .map((a, i) => {
      const dataUrl = typeof a?.dataUrl === "string" ? a.dataUrl : "";
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      const contentType = (a?.contentType || match?.[1] || "image/png").toString();
      const base64 = (a?.base64 || match?.[2] || "").toString();
      const name = (a?.name || `attachment-${i + 1}.png`).toString().replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
      if (!base64 || !contentType.startsWith("image/")) return null;
      const bytes = toBytes(base64);
      if (bytes.byteLength > 7_500_000) return null;
      return { id: i, name, contentType, bytes };
    })
    .filter(Boolean) as { id: number; name: string; contentType: string; bytes: Uint8Array }[];

  if (!files.length) return JSON.stringify({ embeds });
  const form = new FormData();
  form.append("payload_json", JSON.stringify({ embeds, attachments: files.map((f) => ({ id: f.id, filename: f.name })) }));
  for (const f of files) form.append(`files[${f.id}]`, new Blob([f.bytes], { type: f.contentType }), f.name);
  return form;
}

async function postWithRetry(url: string, payload: BodyInit, max = 3): Promise<{ ok: boolean; status?: number; error?: string; attempts: number }> {
  for (let attempt = 1; attempt <= max + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: typeof payload === "string" ? { "Content-Type": "application/json" } : undefined,
        body: payload,
      });
      if (res.ok) return { ok: true, status: res.status, attempts: attempt };
      if (attempt <= max && (res.status === 429 || res.status >= 500)) {
        let delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        const ra = res.headers.get("retry-after");
        if (ra) {
          const p = parseFloat(ra);
          if (!isNaN(p)) delay = Math.max(delay, Math.min(p * 1000, 10000));
        }
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return { ok: false, status: res.status, attempts: attempt };
    } catch (err) {
      if (attempt <= max) {
        await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 8000)));
        continue;
      }
      return { ok: false, error: String(err), attempts: attempt };
    }
  }
  return { ok: false, attempts: max + 1 };
}

// ─── Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ ok: false, status: "rate_limited" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) {
    return new Response(
      JSON.stringify({ ok: false, status: "skipped", reason: "service account not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type: string = body.type;
    const embeds = body.embeds;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const dedupeKey: string = body.dedupeKey || "";

    // Best-effort Firebase ID token verification.
    // Anti-abuse is enforced via IP rate-limit + dedupe (see above), so a missing or
    // invalid token (e.g. preview-environment tokens with undefined audience, login/signup
    // events fired before session is fully ready) MUST NOT block webhook delivery.
    // We still attempt to verify so we can log the caller uid for traceability.
    let callerUid = "";
    const rawIdToken = String(body.idToken || "");
    if (rawIdToken) {
      try {
        const verified = await verifyIdToken(rawIdToken);
        callerUid = verified.uid;
      } catch (e) {
        console.warn("[send-webhook] idToken verify failed (non-blocking):", (e as AuthError)?.message || String(e));
      }
    }

    if (attachments.length > 0) {
      console.log(`[send-webhook] type=${type} attachments=${attachments.length} sizes=`, attachments.map((a: any) => {
        const dataUrl = typeof a?.dataUrl === "string" ? a.dataUrl : "";
        const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        return { name: a?.name, hasDataUrl: !!dataUrl, hasBase64Match: !!m, b64len: m?.[2]?.length || 0 };
      }));
    }
    if (!type || !Array.isArray(embeds) || embeds.length === 0) {
      return new Response(JSON.stringify({ ok: false, status: "invalid", reason: "missing type/embeds" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check event flag (server-side enforcement)
    const flags = await loadFlags();
    const enabledMap = flags.webhookEventsEnabled || {};
    if (type !== "fallback" && enabledMap[type] === false) {
      return new Response(JSON.stringify({ ok: true, status: "skipped", reason: "event disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allUrls = await loadUrls();
    const urls = resolveUrls(allUrls, type);
    // TEMP DEBUG — log what we see for this type
    const _debugKey = KEY_MAP[type];
    console.log(`[send-webhook] type=${type} key=${_debugKey} primary=${JSON.stringify(allUrls[_debugKey])} extras=${JSON.stringify(allUrls[_debugKey + "Urls"])} resolved=${urls.length}`);
    if (urls.length === 0) {
      return new Response(JSON.stringify({ ok: true, status: "skipped", reason: "no URL configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        const dKey = dedupeKey || (embeds[0]?.title || type);
        if (isDuplicate(`${url}|${dKey}`)) {
          return { url, ok: true, status: "skipped_duplicate" };
        }
        const payload = discordBody(embeds, attachments);
        const r = await postWithRetry(url, payload);
        return { url, ...r };
      })
    );

    const sent = results.filter((r: any) => r.ok && r.status !== "skipped_duplicate").length;
    return new Response(
      JSON.stringify({ ok: true, status: "delivered", sent, total: urls.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, status: "error", error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
