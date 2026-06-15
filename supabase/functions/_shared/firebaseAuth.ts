// Shared Firebase ID token verification helper for edge functions.
// Verifies RS256 signature against Google's secure token JWKS (cached 1h).
//
// Usage:
//   import { verifyFirebaseRequest, getCallerRole, requireRole } from "../_shared/firebaseAuth.ts";
//   const auth = await verifyFirebaseRequest(req); // throws on failure
//   const role = await getCallerRole(auth.uid);    // optional Firestore lookup
//   requireRole(role, ["owner", "admin"]);         // throws if not allowed

const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
// Derive project_id from the service account when available — this is the
// authoritative source. Fall back to env var so misconfigured secrets don't
// break verification when SA is absent.
function deriveProjectIdFromSA(): string {
  try {
    if (!FIREBASE_SA) return "";
    const raw = FIREBASE_SA.trim();
    const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
    return String(sa.project_id || "");
  } catch {
    return "";
  }
}
const FIREBASE_PROJECT_ID =
  deriveProjectIdFromSA() || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

let jwksCache: { keys: any[]; exp: number } | null = null;
async function getJwks(): Promise<any[]> {
  if (jwksCache && Date.now() < jwksCache.exp) return jwksCache.keys;
  const r = await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  );
  const j = await r.json();
  jwksCache = { keys: j.keys || [], exp: Date.now() + 60 * 60_000 };
  return jwksCache.keys;
}

function b64uDecodeStr(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}
function b64uDecodeBytes(s: string): Uint8Array {
  const str = b64uDecodeStr(s);
  const arr = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
  return arr;
}

export async function verifyIdToken(
  token: string,
): Promise<{ uid: string; email?: string }> {
  if (!token) throw new AuthError("missing id token");
  if (!FIREBASE_PROJECT_ID) throw new AuthError("server misconfigured", 500);
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("malformed id token");
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(b64uDecodeStr(headerB64));
  const payload = JSON.parse(b64uDecodeStr(payloadB64));

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now - 30) {
    throw new AuthError("token expired");
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 60) {
    throw new AuthError("token iat in future");
  }
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new AuthError("wrong audience");
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new AuthError("wrong issuer");
  }
  if (!payload.sub) throw new AuthError("missing sub");
  if (header.alg !== "RS256") throw new AuthError("unexpected alg");

  const keys = await getJwks();
  const jwk = keys.find((k: any) => k.kid === header.kid);
  if (!jwk) throw new AuthError("unknown kid");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64uDecodeBytes(sigB64);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sig,
    data,
  );
  if (!ok) throw new AuthError("invalid signature");
  return { uid: String(payload.sub), email: payload.email };
}

/** Verifies the request's Authorization: Bearer <id_token> header. */
export async function verifyFirebaseRequest(
  req: Request,
): Promise<{ uid: string; email?: string }> {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return await verifyIdToken(token);
}

// ─── GCP service-account access token (cached) ───
let cachedGcp: { token: string; exp: number } | null = null;
export async function gcpToken(): Promise<string> {
  if (cachedGcp && Date.now() < cachedGcp.exp - 60_000) return cachedGcp.token;
  if (!FIREBASE_SA) throw new AuthError("service account not configured", 500);
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) =>
    btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const unsigned = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64u(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }));
  const pem = sa.private_key.replace(
    /-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,
    "",
  );
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new AuthError("GCP token failed", 500);
  cachedGcp = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/** Fetches the role string from /users/{uid}. Returns "" if missing. */
export async function getCallerRole(uid: string): Promise<string> {
  const token = await gcpToken();
  const r = await fetch(`${FS_BASE}/users/${uid}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r.status === 404) return "";
  if (!r.ok) throw new AuthError("failed to read caller role", 500);
  const j = await r.json();
  return j?.fields?.role?.stringValue || "";
}

export function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new AuthError(
      `insufficient permissions (need: ${allowed.join("|")}, got: ${role || "none"})`,
      403,
    );
  }
}

/** Wraps a handler so AuthErrors return a clean JSON response. */
export function authErrorResponse(err: unknown) {
  const e = err as AuthError;
  const status = e?.status || 401;
  const message = e?.message || "unauthorized";
  return new Response(
    JSON.stringify({ success: false, error: message }),
    {
      // Project pattern: always HTTP 200; status in body to avoid SDK crashes.
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
