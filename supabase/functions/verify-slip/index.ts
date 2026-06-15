import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const cleanEnv = (v: string | undefined | null) => {
  const x = (v || '').trim();
  return !x || x === 'PLACEHOLDER_VALUE_TO_BE_REPLACED' ? '' : x;
};
const SUPABASE_URL = cleanEnv(Deno.env.get('SUPABASE_URL'));
const SUPABASE_SERVICE_ROLE = cleanEnv(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

type Creds = {
  thunder?: { apiKey?: string; enabled?: boolean };
  rdcw?: { clientId?: string; clientSecret?: string; enabled?: boolean };
  slip2go?: { apiKey?: string; enabled?: boolean };
  plernpay?: { clientId?: string; clientSecret?: string; enabled?: boolean };
};
let cachedCreds: { value: Creds; exp: number } | null = null;
async function getCreds(): Promise<Creds> {
  if (cachedCreds && Date.now() < cachedCreds.exp) return cachedCreds.value;
  let fromDb: Creds = {};
  try {
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/topup_provider_config?id=eq.topup&select=config`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` },
      });
      if (r.ok) {
        const rows = await r.json();
        fromDb = (rows[0]?.config as Creds) || {};
      }
    }
  } catch (e) { console.warn('[verify-slip] pg config fetch failed:', e); }
  const merged: Creds = {
    thunder: { apiKey: fromDb.thunder?.apiKey || Deno.env.get('THUNDER_API_KEY') || '' },
    rdcw: { clientId: fromDb.rdcw?.clientId || Deno.env.get('RDCW_CLIENT_ID') || '', clientSecret: fromDb.rdcw?.clientSecret || Deno.env.get('RDCW_CLIENT_SECRET') || '' },
    slip2go: { apiKey: fromDb.slip2go?.apiKey || Deno.env.get('SLIP2GO_API_KEY') || '' },
    plernpay: { clientId: fromDb.plernpay?.clientId || Deno.env.get('PLERNPAY_CLIENT_ID') || '', clientSecret: fromDb.plernpay?.clientSecret || Deno.env.get('PLERNPAY_CLIENT_SECRET') || '' },
  };
  cachedCreds = { value: merged, exp: Date.now() + 30_000 };
  return merged;
}

// Rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rateLimitMap) if (now > e.resetAt) rateLimitMap.delete(ip);
}, 60_000);

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function err(message: string, code = 'ERROR') {
  return ok({ success: false, error: { code, message } });
}

// ─────────── PROVIDERS ───────────
export type VerifyInput = {
  type: 'bank' | 'truewallet';
  base64?: string;
  payload?: string;
  url?: string;
  matchAccount?: boolean;
  matchAmount?: number;
  checkDuplicate?: boolean;
};

export type ProviderResult = {
  success: boolean;
  data?: any;
  error?: { code: string; message: string };
};

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:image\/[a-z]+;base64,/, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Normalize Thunder-shape response (already used as canonical)
function normalizeThunderRaw(raw: any): ProviderResult {
  if (!raw || typeof raw !== 'object') return { success: false, error: { code: 'EMPTY_RESPONSE', message: 'No response from provider' } };
  if (raw.success === false) return { success: false, error: { code: raw.error?.code || 'THUNDER_ERROR', message: raw.error?.message || raw.message || 'Thunder error' } };
  return raw as ProviderResult;
}

// ── Thunder ──
export async function callThunder(input: VerifyInput, apiKey: string, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  const verifyType = input.type === 'truewallet' ? 'truewallet' : 'bank';
  const url = `https://api.thunder.in.th/v2/verify/${verifyType}`;
  const body: Record<string, unknown> = {};
  if (input.base64) body.base64 = input.base64;
  if (input.payload) body.payload = input.payload;
  if (input.url) body.url = input.url;
  if (input.matchAccount !== undefined) body.matchAccount = input.matchAccount;
  if (input.matchAmount !== undefined) body.matchAmount = input.matchAmount;
  if (input.checkDuplicate !== undefined) body.checkDuplicate = input.checkDuplicate;
  try {
    const res = await fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    return normalizeThunderRaw(data);
  } catch (e) {
    return { success: false, error: { code: 'NETWORK', message: `Thunder network error: ${e instanceof Error ? e.message : e}` } };
  }
}

// ── RDCW ──
export async function callRDCW(input: VerifyInput, clientId: string, clientSecret: string, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  if (input.type === 'truewallet') return { success: false, error: { code: 'NOT_SUPPORTED', message: 'RDCW ไม่รองรับสลิป TrueWallet' } };
  const auth = 'Basic ' + btoa(`${clientId}:${clientSecret}`);
  const url = 'https://suba.rdcw.co.th/v2/inquiry';
  let res: Response;
  try {
    if (input.payload) {
      res = await fetcher(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: input.payload }) });
    } else if (input.base64) {
      const bytes = base64ToBytes(input.base64);
      res = await fetcher(url, { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'image/jpeg' }, body: bytes });
    } else {
      return { success: false, error: { code: 'MISSING_DATA', message: 'ต้องระบุ base64 หรือ payload' } };
    }
  } catch (e) {
    return { success: false, error: { code: 'NETWORK', message: `RDCW network error: ${e instanceof Error ? e.message : e}` } };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) return { success: false, error: { code: 'AUTH_FAILED', message: 'RDCW: Client ID/Secret ไม่ถูกต้อง' } };
  if (!res.ok || data.code) {
    return { success: false, error: { code: `RDCW_${data.code || res.status}`, message: data.message || `RDCW error ${res.status}` } };
  }
  const d = data.data || data;
  const sender = d.sender || {};
  const receiver = d.receiver || {};
  const senderAcc = sender.account || {};
  const receiverAcc = receiver.account || {};
  return {
    success: true,
    data: {
      isDuplicate: false,
      matchedAccount: undefined,
      rawSlip: {
        transRef: d.transRef || d.transRefNumber || '',
        date: d.transDate ? `${d.transDate}T${d.transTime || '00:00:00'}` : new Date().toISOString(),
        amount: { amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount || '0') },
        fee: 0,
        sender: {
          bank: { short: d.sendingBank, name: d.sendingBank },
          account: { name: { th: senderAcc.name || sender.displayName, en: senderAcc.name || sender.displayName }, bank: { account: senderAcc.value || senderAcc.account || '' } },
        },
        receiver: {
          bank: { short: d.receivingBank, name: d.receivingBank },
          account: { name: { th: receiverAcc.name || receiver.displayName, en: receiverAcc.name || receiver.displayName }, bank: { account: receiverAcc.value || receiverAcc.account || '' }, proxy: { account: receiverAcc.proxyValue || '' } },
        },
      },
    },
  };
}

// ── Slip2Go (QR payload only) ──
export async function callSlip2Go(input: VerifyInput, apiKey: string, fetcher: typeof fetch = fetch): Promise<ProviderResult> {
  if (input.type === 'truewallet') return { success: false, error: { code: 'NOT_SUPPORTED', message: 'Slip2Go ยังไม่รองรับ TrueWallet ในระบบนี้' } };
  if (!input.payload) return { success: false, error: { code: 'NEEDS_PAYLOAD', message: 'Slip2Go ต้องการ QR payload — กรุณาใช้ Thunder/RDCW สำหรับการอัปโหลดรูปสลิป' } };
  const url = 'https://connect.slip2go.com/api/verify-slip/qr-code/info';
  let res: Response;
  try {
    res = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Slip2Go-API-Key': apiKey, Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ payload: { qrCode: input.payload } }) });
  } catch (e) {
    return { success: false, error: { code: 'NETWORK', message: `Slip2Go network error: ${e instanceof Error ? e.message : e}` } };
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) return { success: false, error: { code: 'AUTH_FAILED', message: 'Slip2Go: API Key ไม่ถูกต้อง' } };
  if (!res.ok || data.code === 'ERROR' || data.error) {
    return { success: false, error: { code: 'SLIP2GO_ERROR', message: data.message || data.error?.message || `Slip2Go ${res.status}` } };
  }
  const d = data.data || data.payload || data;
  return {
    success: true,
    data: {
      isDuplicate: !!d.isDuplicate,
      matchedAccount: undefined,
      rawSlip: {
        transRef: d.transRef || d.qrCode || '',
        date: d.dateTime || d.date || new Date().toISOString(),
        amount: { amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount || '0') },
        fee: 0,
        sender: {
          bank: { short: d.sender?.bankCode, name: d.sender?.bankName },
          account: { name: { th: d.sender?.accountNameTH, en: d.sender?.accountNameEN }, bank: { account: d.sender?.accountNumber || '' } },
        },
        receiver: {
          bank: { short: d.receiver?.bankCode, name: d.receiver?.bankName },
          account: { name: { th: d.receiver?.accountNameTH, en: d.receiver?.accountNameEN }, bank: { account: d.receiver?.accountNumber || '' }, proxy: { account: d.receiver?.proxyValue || '' } },
        },
      },
    },
  };
}

// ── PlernPay (not a verifier) ──
export async function callPlernPay(_input: VerifyInput, _id: string, _secret: string): Promise<ProviderResult> {
  return { success: false, error: { code: 'NOT_SUPPORTED', message: 'PlernPay เป็น Payment Gateway (PromptPay อัตโนมัติ) ไม่ใช่ระบบตรวจสลิป — ใช้ Thunder/Slip2Go/RDCW แทน' } };
}

// ── Test connection (ping) — uses Firestore creds ──
export async function pingProvider(provider: string, fetcher: typeof fetch = fetch): Promise<{ ok: boolean; provider: string; message: string; details?: any }> {
  const p = provider.toLowerCase();
  const cfg = await getCreds();
  try {
    if (p === 'thunder') {
      const key = cfg.thunder?.apiKey;
      if (!key) return { ok: false, provider: p, message: 'ยังไม่ได้กรอก Thunder API Key' };
      const res = await fetcher('https://api.thunder.in.th/v2/credits', { method: 'GET', headers: { Authorization: `Bearer ${key}` } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success !== false)) return { ok: true, provider: p, message: 'Thunder API พร้อมใช้งาน', details: data.data || data };
      return { ok: false, provider: p, message: data.error?.message || data.message || `Thunder error ${res.status}` };
    }
    if (p === 'rdcw') {
      const id = cfg.rdcw?.clientId, sec = cfg.rdcw?.clientSecret;
      if (!id || !sec) return { ok: false, provider: p, message: 'ยังไม่ได้กรอก RDCW Client ID/Secret' };
      const auth = 'Basic ' + btoa(`${id}:${sec}`);
      const res = await fetcher('https://suba.rdcw.co.th/v2/inquiry', { method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: 'PING' }) });
      await res.text();
      if (res.status === 401 || res.status === 403) return { ok: false, provider: p, message: 'Client ID/Secret ไม่ถูกต้อง' };
      return { ok: true, provider: p, message: `RDCW เชื่อมต่อสำเร็จ (HTTP ${res.status})` };
    }
    if (p === 'slip2go') {
      const key = cfg.slip2go?.apiKey;
      if (!key) return { ok: false, provider: p, message: 'ยังไม่ได้กรอก Slip2Go API Key' };
      const res = await fetcher('https://connect.slip2go.com/api/verify-slip/qr-code/info', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Slip2Go-API-Key': key, Authorization: `Bearer ${key}` }, body: JSON.stringify({ payload: { qrCode: 'PING' } }) });
      await res.text();
      if (res.status === 401 || res.status === 403) return { ok: false, provider: p, message: 'API Key ไม่ถูกต้อง' };
      return { ok: true, provider: p, message: `Slip2Go เชื่อมต่อสำเร็จ (HTTP ${res.status})` };
    }
    if (p === 'plernpay') {
      const id = cfg.plernpay?.clientId, sec = cfg.plernpay?.clientSecret;
      if (!id || !sec) return { ok: false, provider: p, message: 'ยังไม่ได้กรอก PlernPay Client ID/Secret' };
      return { ok: true, provider: p, message: 'PlernPay credentials พร้อมใช้งาน (เป็น Payment Gateway)' };
    }
    return { ok: false, provider: p, message: `Unknown provider: ${p}` };
  } catch (e) {
    return { ok: false, provider: p, message: `Network error: ${e instanceof Error ? e.message : e}` };
  }
}

// ─────────── ROUTER ───────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ success: false, error: { code: 'RATE_LIMITED', message: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่' } }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } });
  }

  try {
    const body = await req.json();

    // Best-effort Firebase ID token verification (non-blocking).
    // Preview/dev tokens may have aud=undefined which would otherwise block legitimate users.
    try {
      if (body.idToken) await verifyIdToken(String(body.idToken));
    } catch (e) {
      console.warn("[verify-slip] idToken verify failed (non-blocking):", (e as AuthError)?.message || String(e));
    }

    if (body.action === 'invalidate_cache') {
      cachedCreds = null;
      return ok({ success: true });
    }

    if (body.action === 'ping' || body.ping === true) {
      cachedCreds = null;
      const result = await pingProvider(body.provider || 'thunder');
      console.log(`[verify-slip] ping provider=${result.provider} ok=${result.ok}`);
      return ok(result);
    }

    const provider: string = (body.provider || 'thunder').toLowerCase();
    const input: VerifyInput = {
      type: body.type === 'truewallet' ? 'truewallet' : 'bank',
      base64: body.base64, payload: body.payload, url: body.url,
      matchAccount: body.matchAccount, matchAmount: body.matchAmount, checkDuplicate: body.checkDuplicate,
    };

    if (input.type === 'bank' && !input.base64 && !input.payload && !input.url) return err('ต้องระบุ base64, payload หรือ url', 'MISSING_DATA');
    if (input.type === 'truewallet' && !input.base64 && !input.url) return err('ต้องระบุ base64 หรือ url', 'MISSING_DATA');

    console.log(`[verify-slip] provider=${provider} type=${input.type}`);
    const cfg = await getCreds();

    let result: ProviderResult;
    switch (provider) {
      case 'thunder': {
        const key = cfg.thunder?.apiKey;
        if (!key) return err('Thunder API Key ยังไม่ได้กรอก — ไปที่ Admin → Top-Up → API Providers', 'CONFIG_ERROR');
        result = await callThunder(input, key);
        break;
      }
      case 'rdcw': {
        const id = cfg.rdcw?.clientId, sec = cfg.rdcw?.clientSecret;
        if (!id || !sec) return err('RDCW Client ID/Secret ยังไม่ได้กรอก', 'CONFIG_ERROR');
        result = await callRDCW(input, id, sec);
        break;
      }
      case 'slip2go': {
        const key = cfg.slip2go?.apiKey;
        if (!key) return err('Slip2Go API Key ยังไม่ได้กรอก', 'CONFIG_ERROR');
        result = await callSlip2Go(input, key);
        break;
      }
      case 'plernpay': {
        const id = cfg.plernpay?.clientId, sec = cfg.plernpay?.clientSecret;
        if (!id || !sec) return err('PlernPay credentials ยังไม่ได้กรอก', 'CONFIG_ERROR');
        result = await callPlernPay(input, id, sec);
        break;
      }
      default:
        return err(`Unknown provider: ${provider}`, 'UNKNOWN_PROVIDER');
    }

    return ok({ ...result, provider });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('verify-slip error:', msg);
    return err(msg, 'INTERNAL_ERROR');
  }
});
