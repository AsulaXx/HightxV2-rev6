// Ruzien Bypass UID — proxy to external license API.
// Keeps public_key + secret on the server. IP rate-limited (in-memory).
// Always returns HTTP 200 (project pattern); status in JSON body.
//
// SECURITY (fixed): Firebase ID token is now REQUIRED. Balance is checked and
// deducted server-side (service account) before calling the upstream API so
// anonymous callers can no longer obtain keys for free.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, gcpToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ENV_PUBLIC_KEY = Deno.env.get("RUZIEN_BYPASS_PUBLIC_KEY") || "";
const ENV_SECRET = Deno.env.get("RUZIEN_BYPASS_SECRET") || "";
const ENDPOINT = "https://awjouzwzdkrevvnlenvn.supabase.co/functions/v1/bypass-emulator-external";
// Derive project_id from the service account when possible (authoritative).
function deriveProjectId(): string {
  try {
    const sa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
    if (!sa) return "";
    const parsed = JSON.parse(sa.trim().startsWith("{") ? sa.trim() : atob(sa.trim()));
    return String(parsed.project_id || "");
  } catch { return ""; }
}
const PROJECT_ID = deriveProjectId() || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── In-memory IP rate limit: 10 / min ──
const rl = new Map<string, { c: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = rl.get(ip);
  if (!rec || now - rec.ts > 60_000) { rl.set(ip, { c: 1, ts: now }); return false; }
  rec.c++;
  return rec.c > 10;
}

const ok = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

/** Read a Firestore document as plain JSON using the service account token. */
async function fsGet(path: string, saToken: string): Promise<any> {
  const r = await fetch(`${FS_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  if (!r.ok) return null;
  return r.json();
}

/** Patch specific fields on a Firestore document using the service account. */
async function fsPatch(path: string, fields: Record<string, any>, saToken: string): Promise<boolean> {
  const fieldMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join("&");
  const r = await fetch(`${FS_BASE}/${path}?${fieldMask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${saToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return r.ok;
}

/** Extract a numeric value from a Firestore field (handles integerValue / doubleValue). */
function fsNum(field: any): number {
  if (!field) return 0;
  return Number(field.doubleValue ?? field.integerValue ?? 0);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!PROJECT_ID) return ok({ success: false, error: "Server misconfigured" });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) return ok({ success: false, error: "ใช้งานบ่อยเกินไป กรุณารอสักครู่" });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return ok({ success: false, error: "Invalid body" });

    // ── FIXED: Require a valid Firebase ID token ──
    // Accept idToken from body OR Authorization header (Bearer <firebase id token>)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const headerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : "";
    const rawIdToken = String(body.idToken || "").trim() || headerToken;
    if (!rawIdToken) return ok({ success: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน (ไม่พบ idToken)" });
    let callerUid = "";
    try {
      const verified = await verifyIdToken(rawIdToken);
      callerUid = verified.uid;
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      console.error("verifyIdToken failed:", msg);
      return ok({ success: false, error: `เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ (${msg})` });
    }

    // ── Customer self-service actions (no API secret needed) ──
    const action = String(body.action || "create_license").trim();
    if (action === "get_license" || action === "change_uid") {
      const license_key = String(body.license_key || "").trim();
      if (!license_key) return ok({ success: false, error: "กรุณากรอก License Key" });

      const payload: Record<string, unknown> = { action, license_key };
      if (action === "change_uid") {
        const new_uid = String(body.new_uid || "").trim();
        const old_uid = String(body.old_uid || "").trim();
        if (!/^\d{4,20}$/.test(new_uid)) return ok({ success: false, error: "UID ใหม่ไม่ถูกต้อง (ตัวเลข 4-20 หลัก)" });
        payload.new_uid = new_uid;
        if (old_uid) {
          if (!/^\d{4,20}$/.test(old_uid)) return ok({ success: false, error: "UID เดิมไม่ถูกต้อง" });
          payload.old_uid = old_uid;
        }
      }
      try {
        const up = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await up.json().catch(() => ({}));
        if (!up.ok || j?.success === false) {
          return ok({ success: false, error: j?.message || j?.error || `Upstream HTTP ${up.status}` });
        }
        return ok({ success: true, data: j });
      } catch (e) {
        return ok({ success: false, error: String((e as Error)?.message || e) });
      }
    }

    const game_uid = String(body.game_uid || "").trim();
    const days = Number(body.days);
    if (!/^\d{4,20}$/.test(game_uid)) return ok({ success: false, error: "UID ไม่ถูกต้อง (ต้องเป็นตัวเลข 4-20 หลัก)" });
    if (!Number.isFinite(days) || days < 1 || days > 3650) return ok({ success: false, error: "จำนวนวันไม่ถูกต้อง" });

    // ── FIXED: Server-side price lookup + balance check + deduction ──
    const saToken = await gcpToken();

    // Resolve credentials: Firestore secureConfig/ruzienBypass overrides env.
    const cfgDoc = await fsGet("secureConfig/ruzienBypass", saToken);
    const cfgPublic = String(cfgDoc?.fields?.public_key?.stringValue || "").trim();
    const cfgSecret = String(cfgDoc?.fields?.secret?.stringValue || "").trim();
    const PUBLIC_KEY = cfgPublic || ENV_PUBLIC_KEY;
    const SECRET = cfgSecret || ENV_SECRET;
    if (!PUBLIC_KEY || !SECRET) return ok({ success: false, error: "API not configured" });

    // Look up price from settings/site.ruzienBypass.durations
    const settings = await fsGet("settings/site", saToken);
    const durations: any[] =
      settings?.fields?.ruzienBypass?.mapValue?.fields?.durations?.arrayValue?.values || [];
    let price = 0;
    for (const dur of durations) {
      const f = dur?.mapValue?.fields || {};
      const durDays = fsNum(f.days);
      const durEnabled = f.enabled?.booleanValue !== false;
      if (durDays === days && durEnabled) {
        price = fsNum(f.price);
        break;
      }
    }
    if (price <= 0) return ok({ success: false, error: "ไม่พบราคาสำหรับจำนวนวันที่เลือก" });

    // Read caller's wallet balance
    const wallet = await fsGet(`wallets/${callerUid}`, saToken);
    const currentBalance = wallet ? fsNum(wallet.fields?.balance) : 0;
    if (currentBalance < price) {
      return ok({ success: false, error: `ยอดเงินไม่เพียงพอ (ต้องการ ฿${price} มีอยู่ ฿${currentBalance})` });
    }

    // Deduct balance server-side before calling upstream
    const newBalance = currentBalance - price;
    const deducted = await fsPatch(
      `wallets/${callerUid}`,
      {
        balance: { doubleValue: newBalance },
        updatedAt: { stringValue: new Date().toISOString() },
      },
      saToken,
    );
    if (!deducted) return ok({ success: false, error: "ไม่สามารถหักเงินได้ กรุณาลองใหม่" });

    // Call upstream license API
    const upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_license",
        public_key: PUBLIC_KEY,
        secret: SECRET,
        game_uid,
        days,
      }),
    });
    const json = await upstream.json().catch(() => ({}));

    if (!upstream.ok || !json?.success) {
      // Upstream failed — refund the deducted amount
      await fsPatch(
        `wallets/${callerUid}`,
        {
          balance: { doubleValue: currentBalance },
          updatedAt: { stringValue: new Date().toISOString() },
        },
        saToken,
      );
      return ok({ success: false, error: json?.message || json?.error || `Upstream HTTP ${upstream.status}` });
    }

    return ok({
      success: true,
      key: json.key,
      license_id: json.license_id,
      expires_at: json.expires_at,
      key_preview: json.key_preview,
    });
  } catch (e) {
    return ok({ success: false, error: String((e as Error)?.message || e) });
  }
});
