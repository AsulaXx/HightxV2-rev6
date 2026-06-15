import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FIREBASE_PROJECT_ID = Deno.env.get('VITE_FIREBASE_PROJECT_ID') || '';
const FIREBASE_SA = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') || '';

// ── Firestore service-account auth (compact) ──
let cachedToken: { token: string; exp: number } | null = null;
async function gcpToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith('{') ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) => btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const sigB64 = btoa(String.fromCharCode(...sig)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('GCP token failed: ' + JSON.stringify(j));
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

let cachedApiUrl: { value: string; exp: number } | null = null;
async function getApiUrl(): Promise<string> {
  if (cachedApiUrl && Date.now() < cachedApiUrl.exp) return cachedApiUrl.value;
  const fallback = 'https://apiparkxd.pro/api/topup';
  try {
    const token = await gcpToken();
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/secureConfig/topup`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 404) { cachedApiUrl = { value: fallback, exp: Date.now() + 30_000 }; return fallback; }
    const j = await r.json();
    const url = j?.fields?.truewallet?.mapValue?.fields?.apiUrl?.stringValue || fallback;
    cachedApiUrl = { value: url, exp: Date.now() + 30_000 };
    return url;
  } catch (e) {
    console.warn('[redeem-truewallet] config fetch failed:', e);
    return fallback;
  }
}

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const e = rateLimitMap.get(ip);
  if (!e || now > e.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  return ++e.count <= 5;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of rateLimitMap) if (n > v.resetAt) rateLimitMap.delete(k); }, 60_000);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ success: false, error: 'คำขอมากเกินไป กรุณารอสักครู่' }), {
      status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    const body = await req.json();
    const { voucherUrl, phone, idToken } = body;

    // Require signed-in Firebase user — prevents anonymous voucher draining
    try {
      await verifyIdToken(String(idToken || ""));
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: `unauthorized: ${(e as AuthError)?.message || e}` }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!phone) return new Response(JSON.stringify({ success: false, error: 'ไม่พบเบอร์โทร TrueWallet สำหรับรับเงิน' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!voucherUrl) return new Response(JSON.stringify({ success: false, error: 'กรุณาระบุลิงก์ซองอั่งเปา' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const parts = String(voucherUrl).split('v=');
    const m = (parts[1] || parts[0]).match(/[0-9A-Za-z]+/);
    if (!m) return new Response(JSON.stringify({ success: false, error: 'ลิงก์ซองไม่ถูกต้อง' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const voucher = m[0];

    const cleanPhone = String(phone).trim().replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
      return new Response(JSON.stringify({ success: false, error: 'เบอร์โทรไม่ถูกต้อง' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiUrl = await getApiUrl();
    console.log(`[redeem-truewallet] using ${apiUrl} voucher=${voucher.slice(0, 6)}... phone=${cleanPhone.slice(0, 4)}****`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voucher, phone: cleanPhone }),
    });

    const data = await response.json().catch(() => ({} as any));
    console.log('[redeem-truewallet] response:', JSON.stringify(data));

    const statusStr = String(data.status ?? data.code ?? '').toLowerCase();
    const isSuccess = statusStr === 'success' || statusStr === 'ok' || data.success === true;

    if (isSuccess) {
      const amount = Number(String(data.amount ?? data.amount_baht ?? data.data?.amount ?? data.data?.amount_baht ?? '0').replace(/,/g, ''));
      const ownerName = data.owner_name ?? data.ownerName ?? data.data?.owner_name ?? data.data?.full_name ?? '-';
      return new Response(JSON.stringify({
        success: true,
        data: { amount, ownerName, voucherCode: voucher, redeemDate: new Date().toISOString() },
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const errorMessages: Record<string, string> = {
      VOUCHER_OUT_OF_STOCK: 'ซองนี้ถูกใช้หมดแล้ว',
      VOUCHER_NOT_FOUND: 'ไม่พบซองอั่งเปานี้',
      VOUCHER_EXPIRED: 'ซองอั่งเปาหมดอายุแล้ว',
      CANNOT_GET_OWN_VOUCHER: 'ไม่สามารถรับซองของตัวเองได้',
      TARGET_USER_NOT_FOUND: 'ไม่พบบัญชี TrueWallet ของเบอร์นี้',
    };
    const errorCode = data.code || data.error_code || 'UNKNOWN_ERROR';
    const errorMsg = errorMessages[errorCode] || data.message || data.error || `เกิดข้อผิดพลาด: ${errorCode}`;

    return new Response(JSON.stringify({ success: false, error: errorMsg, errorCode }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Redeem voucher error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
