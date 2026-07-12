// Scheduled daily summary — designed to be called by pg_cron (or manually by admin).
// Reads today's claims from Firestore and forwards a summary embed to the
// send-webhook proxy (which resolves the private Discord URL).
//
// Runs anonymously; the pg_cron caller passes the anon key. We also gate by a
// simple time window so ad-hoc calls near the configured hour still work, but
// spam calls at random times are no-ops (unless ?force=1).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

let FIREBASE_PROJECT_ID = Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
if (!FIREBASE_PROJECT_ID || /placeholder/i.test(FIREBASE_PROJECT_ID)) {
  try {
    const raw = FIREBASE_SA.trim();
    if (raw) {
      const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
      if (sa?.project_id) FIREBASE_PROJECT_ID = sa.project_id;
    }
  } catch { /* ignore */ }
}

let cachedToken: { token: string; exp: number } | null = null;
async function gcpToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) => btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const unsigned =
    b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
    b64u(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now, exp: now + 3600,
    }));
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const sigB64 = btoa(String.fromCharCode(...sig)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("GCP token failed");
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

function decode(v: any): any {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decode);
  if ("mapValue" in v) {
    const out: Record<string, any> = {};
    for (const [k, x] of Object.entries(v.mapValue.fields || {})) out[k] = decode(x);
    return out;
  }
  return null;
}
function decodeFields(fields: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decode(v);
  return out;
}

async function fsGet(token: string, path: string) {
  return fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } });
}

// Bangkok TZ helpers
function bangkokTodayISO(): string {
  // Format YYYY-MM-DD in Asia/Bangkok
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(now); // en-CA yields YYYY-MM-DD
}
function bangkokNowHM(): { h: number; m: number } {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const [h, m] = s.split(":").map(Number);
  return { h, m };
}
function bangkokStartOfTodayMs(): number {
  const iso = bangkokTodayISO(); // YYYY-MM-DD in Bangkok
  // Bangkok = UTC+7 (no DST)
  return Date.parse(`${iso}T00:00:00+07:00`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) {
    return new Response(JSON.stringify({ ok: false, reason: "service account not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const token = await gcpToken();
    // Load settings
    const sRes = await fsGet(token, "settings/site");
    const settings = sRes.ok ? decodeFields((await sRes.json()).fields || {}) : {};

    if (!force) {
      if (settings.dailySummaryEnabled === false) {
        return new Response(JSON.stringify({ ok: true, reason: "disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const today = bangkokTodayISO();
      if (settings.lastDailySummaryDate === today) {
        return new Response(JSON.stringify({ ok: true, reason: "already sent today" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Time-window match (±2 min around configured HH:MM in Bangkok)
      const target = String(settings.dailySummaryTime || "23:00");
      const [th, tm] = target.split(":").map(Number);
      const { h, m } = bangkokNowHM();
      const nowMin = h * 60 + m;
      const targetMin = (isFinite(th) ? th : 23) * 60 + (isFinite(tm) ? tm : 0);
      if (Math.abs(nowMin - targetMin) > 2) {
        return new Response(JSON.stringify({ ok: true, reason: "outside window", nowMin, targetMin }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Query claimed keys today via runQuery (Firestore StructuredQuery)
    const startMs = bangkokStartOfTodayMs();
    const startIso = new Date(startMs).toISOString();
    const runQueryUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`;
    const q = {
      structuredQuery: {
        from: [{ collectionId: "keys" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "claimed" }, op: "EQUAL", value: { booleanValue: true } } },
              { fieldFilter: { field: { fieldPath: "claimedAt" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: startIso } } },
            ],
          },
        },
      },
    };
    const qRes = await fetch(runQueryUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(q),
    });
    const rows = qRes.ok ? await qRes.json() : [];
    const todayClaims = (Array.isArray(rows) ? rows : [])
      .map((r: any) => r.document ? decodeFields(r.document.fields) : null)
      .filter(Boolean);

    // Count remaining unclaimed keys (single unindexed scan-lite: use aggregation via runAggregationQuery)
    const aggRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runAggregationQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: {
            from: [{ collectionId: "keys" }],
            where: { fieldFilter: { field: { fieldPath: "claimed" }, op: "EQUAL", value: { booleanValue: false } } },
          },
          aggregations: [{ alias: "total", count: {} }],
        },
      }),
    });
    let totalAvailable = 0;
    if (aggRes.ok) {
      const j = await aggRes.json();
      const v = j?.[0]?.result?.aggregateFields?.total;
      totalAvailable = v ? Number(decode(v)) : 0;
    }

    const products: any[] = Array.isArray(settings.products) ? settings.products : [];
    const productName = (id: string) => products.find((p: any) => p.id === id)?.name || id || "ไม่ระบุ";
    const counts: Record<string, number> = {};
    for (const k of todayClaims) {
      const n = productName(String(k.productId || ""));
      counts[n] = (counts[n] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

    const fields: any[] = [
      { name: "📊 กดคีย์วันนี้", value: `**${todayClaims.length}** ครั้ง`, inline: true },
      { name: "📦 คีย์คงเหลือ", value: `**${totalAvailable}** คีย์`, inline: true },
    ];
    if (top) fields.push({ name: "🏆 สินค้ายอดนิยม", value: `**${top[0]}** (${top[1]} ครั้ง)`, inline: true });
    if (Object.keys(counts).length) {
      fields.push({
        name: "📋 รายละเอียดตามสินค้า",
        value: Object.entries(counts).map(([n, c]) => `• ${n}: ${c} ครั้ง`).join("\n").slice(0, 1000),
        inline: false,
      });
    }

    const dateLabel = new Intl.DateTimeFormat("th-TH", {
      timeZone: "Asia/Bangkok", weekday: "long", year: "numeric", month: "long", day: "numeric",
    }).format(new Date());

    const embed = {
      title: `📊 สรุปรายวัน - ${dateLabel}`,
      color: 0x00cc66,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: settings.brandName || "System" },
    };

    // Forward to send-webhook proxy so URL resolution + dedupe live in one place
    const forwardUrl = `${SUPABASE_URL}/functions/v1/send-webhook`;
    const fwd = await fetch(forwardUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type: "dailySummary", embeds: [embed], dedupeKey: `daily:${bangkokTodayISO()}` }),
    });
    const fwdJson = await fwd.json().catch(() => ({}));

    // Update lastDailySummaryDate to prevent duplicate sends today
    const today = bangkokTodayISO();
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/settings/site?updateMask.fieldPaths=lastDailySummaryDate`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { lastDailySummaryDate: { stringValue: today } } }),
      },
    );

    return new Response(JSON.stringify({ ok: true, status: "sent", claimsToday: todayClaims.length, totalAvailable, forward: fwdJson }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
