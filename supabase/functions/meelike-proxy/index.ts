import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MEELIKE_API_URL = "https://api.meelike-th.com/api/v2";

// IP rate limiter — 30 req/min per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW = 60_000;
const RATE_MAX = 30;
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const e = rateLimitMap.get(ip);
  if (!e || now > e.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  e.count++;
  return e.count <= RATE_MAX;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit by IP (cf-connecting-ip → x-forwarded-for → x-real-ip)
  const ip = req.headers.get("cf-connecting-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(
      JSON.stringify({ success: false, error: "Rate limit exceeded — โปรดลองอีกครั้งในอีก 1 นาที" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { action, apiKeyOverride, idToken, ...params } = body;

    // Require signed-in Firebase user
    try {
      await verifyIdToken(String(idToken || ""));
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: `unauthorized: ${(e as AuthError)?.message || e}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action first before using any keys
    const allowedActions = ["services", "add", "status", "balance", "refill", "refill_status", "cancel"];
    if (!action || typeof action !== "string" || !allowedActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid action: ${action}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate apiKeyOverride format if provided (must be non-empty string, max 256 chars)
    if (apiKeyOverride !== undefined && (typeof apiKeyOverride !== "string" || apiKeyOverride.length > 256)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid API key format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Priority: apiKeyOverride (from Admin Settings) > MEELIKE_API_KEY (Supabase Secret)
    const MEELIKE_API_KEY = (apiKeyOverride && apiKeyOverride.trim()) || Deno.env.get("MEELIKE_API_KEY");
    if (!MEELIKE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "MEELIKE_API_KEY is not configured — ตั้งค่าได้ที่หน้า Admin → Booster → API Key หรือ Supabase Secrets" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize params — only allow known safe keys
    const safeParams: Record<string, string> = {};
    const allowedParams = ["service", "link", "quantity", "order", "runs", "interval"];
    for (const key of allowedParams) {
      if (params[key] !== undefined) {
        safeParams[key] = String(params[key]).substring(0, 1000);
      }
    }

    // Build request to MeeLike API
    const meelikePayload: Record<string, string> = {
      key: MEELIKE_API_KEY,
      action,
      ...safeParams,
    };

    const response = await fetch(MEELIKE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meelikePayload),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("MeeLike proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
