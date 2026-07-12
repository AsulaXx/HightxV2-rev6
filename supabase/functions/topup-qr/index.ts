// topup-qr: create / status / webhook for QR-based PromptPay top-ups
// Providers: plernpay, rdcw, promptpay (pure fallback - generates QR locally)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const cleanEnv = (value: string | undefined | null) => {
  const v = (value || '').trim();
  return !v || v === 'PLACEHOLDER_VALUE_TO_BE_REPLACED' ? '' : v;
};

const SUPABASE_URL = cleanEnv(Deno.env.get('SUPABASE_URL'));
const SUPABASE_SERVICE_ROLE = cleanEnv(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
const FIREBASE_PROJECT_ID = cleanEnv(Deno.env.get('VITE_FIREBASE_PROJECT_ID'));
const FIREBASE_SA = cleanEnv(Deno.env.get('FIREBASE_SERVICE_ACCOUNT'));

// ─────────── Postgres (Lovable Cloud) helpers via REST ───────────
async function pgFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) throw new Error('SUPABASE service role not configured');
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
}
async function pgSelect<T = any>(path: string): Promise<T[]> {
  const r = await pgFetch(path);
  if (!r.ok) throw new Error(`pg select ${r.status}: ${await r.text()}`);
  return await r.json();
}
async function pgUpsert(table: string, body: Record<string, any>, onConflict: string) {
  const r = await pgFetch(`/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`pg upsert ${r.status}: ${await r.text()}`);
}

// ─────────── Config from Postgres (no Firebase SA needed) ───────────
async function loadConfigFromPg(): Promise<ProviderCreds> {
  try {
    const rows = await pgSelect<{ config: ProviderCreds }>(`/topup_provider_config?id=eq.topup&select=config`);
    return rows[0]?.config || {};
  } catch (e) { console.warn('[topup-qr] pg config load failed:', e); return {}; }
}
async function saveConfigToPg(config: ProviderCreds, uid: string) {
  await pgUpsert('topup_provider_config', { id: 'topup', config, updated_by_uid: uid, updated_at: new Date().toISOString() }, 'id');
}
async function isOwner(uid: string): Promise<boolean> {
  try {
    const rows = await pgSelect<any>(`/topup_admins?firebase_uid=eq.${encodeURIComponent(uid)}&select=firebase_uid`);
    return rows.length > 0;
  } catch { return false; }
}
async function ownerCount(): Promise<number> {
  try {
    const r = await pgFetch(`/topup_admins?select=firebase_uid`, { headers: { Prefer: 'count=exact' } });
    const range = r.headers.get('content-range') || '0/0';
    return parseInt(range.split('/')[1] || '0', 10) || 0;
  } catch { return 0; }
}
async function addOwner(uid: string) {
  await pgUpsert('topup_admins', { firebase_uid: uid, note: 'self-claimed' }, 'firebase_uid');
}

const ok = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const err = (message: string, code = 'ERROR') => ok({ success: false, error: { code, message } });

// ─────────── Pure PromptPay TLV QR generator (fallback) ───────────
function ppTLV(id: string, value: string) {
  const len = value.length.toString().padStart(2, '0');
  return id + len + value;
}
function ppCRC16(payload: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function generatePromptPayQR(target: string, amount: number): string {
  const id = target.replace(/\D/g, '');
  let proxyType: string, proxyValue: string;
  if (id.length === 13) { proxyType = '02'; proxyValue = id; } // citizen ID
  else if (id.length === 10) { proxyType = '01'; proxyValue = '0066' + id.slice(1); } // phone
  else if (id.length >= 15) { proxyType = '03'; proxyValue = id; } // e-wallet
  else { proxyType = '01'; proxyValue = id; }
  const merchantInfo = ppTLV('00', 'A000000677010111') + ppTLV(proxyType, proxyValue);
  const amt = amount.toFixed(2);
  const payload =
    ppTLV('00', '01') +
    ppTLV('01', '12') + // dynamic QR
    ppTLV('29', merchantInfo) +
    ppTLV('53', '764') +
    ppTLV('54', amt) +
    ppTLV('58', 'TH') +
    '6304';
  return payload + ppCRC16(payload);
}

// ─────────── Firestore REST helpers (service account) ───────────
let cachedToken: { token: string; exp: number } | null = null;
async function gcpAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  if (!FIREBASE_SA) throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
  // Support both raw JSON and base64-encoded JSON for the service account secret
  const raw = FIREBASE_SA.trim();
  let sa: any;
  try {
    sa = JSON.parse(raw.startsWith('{') ? raw : atob(raw));
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT ไม่ใช่ JSON หรือ base64-JSON ที่ถูกต้อง');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  };
  const b64u = (s: string) => btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const unsigned = b64u(JSON.stringify(header)) + '.' + b64u(JSON.stringify(claim));
  const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const sigB64 = btoa(String.fromCharCode(...sig)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  const jwt = unsigned + '.' + sigB64;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Failed to get GCP token: ' + JSON.stringify(j));
  cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in * 1000) };
  return j.access_token;
}

function getServiceAccountProjectId(): string | null {
  if (!FIREBASE_SA) return null;
  try {
    const raw = FIREBASE_SA.trim();
    const sa = JSON.parse(raw.startsWith('{') ? raw : atob(raw));
    return cleanEnv(sa.project_id) || null;
  } catch { return null; }
}

function getFirestoreProjectId(): string {
  const projectId = FIREBASE_PROJECT_ID || getServiceAccountProjectId();
  if (!projectId) throw new Error('server missing valid Firebase project id');
  return projectId;
}

const FS_BASE = () => `https://firestore.googleapis.com/v1/projects/${getFirestoreProjectId()}/databases/(default)/documents`;

function toFsValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v.toString() } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, vv]) => [k, toFsValue(vv)])) } };
  return { stringValue: String(v) };
}
function fromFsValue(f: any): any {
  if (!f) return null;
  if ('nullValue' in f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('integerValue' in f) return parseInt(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('timestampValue' in f) return f.timestampValue;
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, v]) => [k, fromFsValue(v)]));
  return null;
}

async function fsCreate(coll: string, id: string, data: Record<string, any>) {
  const token = await gcpAccessToken();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)]));
  const r = await fetch(`${FS_BASE()}/${coll}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore create failed: ${await r.text()}`);
  return await r.json();
}
async function fsGet(coll: string, id: string): Promise<Record<string, any> | null> {
  const token = await gcpAccessToken();
  const r = await fetch(`${FS_BASE()}/${coll}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Firestore get failed: ${await r.text()}`);
  const j = await r.json();
  return Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromFsValue(v)]));
}
async function fsUpdate(coll: string, id: string, data: Record<string, any>) {
  const token = await gcpAccessToken();
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toFsValue(v)]));
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const r = await fetch(`${FS_BASE()}/${coll}/${encodeURIComponent(id)}?${mask}`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error(`Firestore update failed: ${await r.text()}`);
  return await r.json();
}

// ─────────── Provider Config (from Postgres with env fallback) ───────────
type ProviderCreds = {
  thunder?: { apiKey?: string; enabled?: boolean };
  rdcw?: { clientId?: string; clientSecret?: string; enabled?: boolean };
  slip2go?: { apiKey?: string; enabled?: boolean };
  plernpay?: { clientId?: string; clientSecret?: string; enabled?: boolean };
  truewallet?: { apiUrl?: string; enabled?: boolean };
};
let cachedConfig: { value: ProviderCreds; exp: number } | null = null;
async function getProviderConfig(): Promise<ProviderCreds> {
  if (cachedConfig && Date.now() < cachedConfig.exp) return cachedConfig.value;
  const fromDb = await loadConfigFromPg();
  const merged: ProviderCreds = {
    thunder: { apiKey: fromDb.thunder?.apiKey || Deno.env.get('THUNDER_API_KEY') || '', enabled: fromDb.thunder?.enabled ?? true },
    rdcw: { clientId: fromDb.rdcw?.clientId || Deno.env.get('RDCW_CLIENT_ID') || '', clientSecret: fromDb.rdcw?.clientSecret || Deno.env.get('RDCW_CLIENT_SECRET') || '', enabled: fromDb.rdcw?.enabled ?? true },
    slip2go: { apiKey: fromDb.slip2go?.apiKey || Deno.env.get('SLIP2GO_API_KEY') || '', enabled: fromDb.slip2go?.enabled ?? true },
    plernpay: { clientId: fromDb.plernpay?.clientId || Deno.env.get('PLERNPAY_CLIENT_ID') || '', clientSecret: fromDb.plernpay?.clientSecret || Deno.env.get('PLERNPAY_CLIENT_SECRET') || '', enabled: fromDb.plernpay?.enabled ?? true },
    truewallet: { apiUrl: fromDb.truewallet?.apiUrl || 'https://apiparkxd.pro/api/topup', enabled: fromDb.truewallet?.enabled ?? true },
  };
  cachedConfig = { value: merged, exp: Date.now() + 30_000 };
  return merged;
}

// ─────────── Provider Adapters ───────────
type CreateInput = { provider: string; amount: number; userId: string; promptpayTarget?: string };
type CreateOutput = { reference: string; qrPayload: string; expiresAt: string; providerRef?: string };

async function createPlernPay(input: CreateInput): Promise<CreateOutput> {
  const cfg = await getProviderConfig();
  const id = cfg.plernpay?.clientId;
  const sec = cfg.plernpay?.clientSecret;
  if (!id || !sec) throw new Error('PlernPay credentials ไม่ได้ตั้งค่า — ไปที่ Admin → Top-Up → API Providers');
  const memo = `user:${input.userId}`.slice(0, 255);
  const res = await fetch('https://api.plernpay.com/v1/topup/create', {
    method: 'POST',
    headers: {
      'X-Client-ID': id,
      'X-Client-Secret': sec,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: input.amount, memo }),
  });
  const data = await res.json().catch(() => ({}));
  const qrCode = data.qr_code || data.qrCode || data.payload || data.qrPayload;
  const ref = data.ref || data.reference;
  if (!res.ok || !qrCode || !ref) {
    const errMsg = data.error || data.message || `HTTP ${res.status}`;
    throw new Error(`PlernPay error: ${errMsg}${data.code ? ` (code ${data.code})` : ''}`);
  }
  return {
    reference: ref,
    qrPayload: qrCode,
    expiresAt: data.expires_at || data.expireAt || data.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    providerRef: ref,
  };
}

async function createRDCW(input: CreateInput): Promise<CreateOutput> {
  const cfg = await getProviderConfig();
  if (!cfg.rdcw?.clientId || !cfg.rdcw?.clientSecret) throw new Error('RDCW credentials ไม่ได้ตั้งค่า');
  if (!input.promptpayTarget) throw new Error('RDCW QR mode ต้องการ PromptPay target');
  const reference = `RD${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { reference, qrPayload: generatePromptPayQR(input.promptpayTarget, input.amount), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
}

async function createPromptPay(input: CreateInput): Promise<CreateOutput> {
  if (!input.promptpayTarget) throw new Error('PromptPay mode ต้องการ promptpayTarget (เลขบัญชี/เบอร์โทร)');
  const reference = `QR${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  return { reference, qrPayload: generatePromptPayQR(input.promptpayTarget, input.amount), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
}

// In-memory cache of PlernPay status per ref to avoid hitting their 30 req/min limit.
// Multiple polls within STATUS_CACHE_TTL_MS return the cached value instead of calling PlernPay.
const STATUS_CACHE_TTL_MS = 5000;
const plernpayStatusCache = new Map<string, { value: 'pending' | 'paid' | 'expired' | 'failed'; exp: number }>();

async function statusPlernPay(providerRef: string | undefined): Promise<'pending' | 'paid' | 'expired' | 'failed'> {
  if (!providerRef) return 'pending';
  const cached = plernpayStatusCache.get(providerRef);
  if (cached && Date.now() < cached.exp) return cached.value;
  const cfg = await getProviderConfig();
  const id = cfg.plernpay?.clientId; const sec = cfg.plernpay?.clientSecret;
  if (!id || !sec) return 'pending';
  try {
    const r = await fetch(`https://api.plernpay.com/v1/topup/${encodeURIComponent(providerRef)}`, {
      headers: { 'X-Client-ID': id, 'X-Client-Secret': sec },
    });
    const j = await r.json().catch(() => ({}));
    const s = (j.status || '').toLowerCase();
    let result: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';
    if (s === 'confirmed' || s === 'paid' || s === 'completed' || s === 'success') result = 'paid';
    else if (s === 'expired') result = 'expired';
    else if (s === 'failed' || s === 'cancelled') result = 'failed';
    // Cache terminal statuses for longer (60s) since they don't change.
    const ttl = result === 'pending' ? STATUS_CACHE_TTL_MS : 60_000;
    plernpayStatusCache.set(providerRef, { value: result, exp: Date.now() + ttl });
    return result;
  } catch { return 'pending'; }
}

async function testProvider(provider: string): Promise<{ ok: boolean; message: string }> {
  const cfg = await getProviderConfig();
  try {
    if (provider === 'thunder') {
      const k = cfg.thunder?.apiKey; if (!k) return { ok: false, message: 'ยังไม่ได้กรอก API Key' };
      const r = await fetch('https://api.thunder.in.th/v2/info', { headers: { Authorization: `Bearer ${k}` } });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success !== false) {
        const used = d.data?.application?.quota?.used ?? '-';
        const max = d.data?.application?.quota?.max ?? '-';
        return { ok: true, message: `เช็กสลิป: ${used} / ${max}` };
      }
      if (r.status === 401 || r.status === 403) return { ok: false, message: 'API Key ไม่ถูกต้อง' };
      return { ok: false, message: d.error?.message || d.message || `HTTP ${r.status}` };
    }
    if (provider === 'rdcw') {
      const id = cfg.rdcw?.clientId; const s = cfg.rdcw?.clientSecret;
      if (!id || !s) return { ok: false, message: 'ยังไม่ได้กรอก Client ID/Secret' };
      const r = await fetch('https://suba.rdcw.co.th/v2/inquiry', { method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${id}:${s}`), 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: 'PING' }) });
      await r.text();
      if (r.status === 401 || r.status === 403) return { ok: false, message: 'Client ID/Secret ไม่ถูกต้อง' };
      return { ok: true, message: `เชื่อมต่อสำเร็จ (HTTP ${r.status})` };
    }
    if (provider === 'slip2go') {
      const k = cfg.slip2go?.apiKey; if (!k) return { ok: false, message: 'ยังไม่ได้กรอก API Key' };
      // Slip2Go ใช้ Authorization: Bearer <API Secret> ตามคู่มือ (https://slip2go.com/guide)
      const r = await fetch('https://connect.slip2go.com/api/verify-slip/qr-code/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({ payload: { qrCode: 'PING' } }),
      });
      const txt = await r.text();
      let data: any = {}; try { data = JSON.parse(txt); } catch { /* ignore */ }
      const code = String(data?.code || '');
      const msg = String(data?.message || '').trim();
      // 401001 = Token Mismatch (key ผิด), 401002+ = อื่นๆ เช่น IP whitelist
      if (r.status === 401 && code === '401001') return { ok: false, message: 'API Key (Secret) ไม่ถูกต้อง' };
      if (r.status === 401 || r.status === 403) return { ok: false, message: `Slip2Go ${r.status}: ${msg || code || 'Unauthorized'}` };
      // 400 = qrCode ผิด format → แปลว่า auth ผ่านแล้ว ถือว่าเชื่อมต่อสำเร็จ
      if (r.status === 400 || r.ok) return { ok: true, message: `เชื่อมต่อสำเร็จ (HTTP ${r.status})` };
      return { ok: false, message: `Slip2Go ${r.status}: ${msg || code || 'error'}` };
    }
    if (provider === 'plernpay') {
      const id = cfg.plernpay?.clientId; const s = cfg.plernpay?.clientSecret;
      if (!id || !s) return { ok: false, message: 'ยังไม่ได้กรอก Client ID/Secret' };
      // ping by GET on a non-existent ref — expect 404 (auth ok) or 401 (auth fail)
      const r = await fetch('https://api.plernpay.com/v1/topup/PING-AUTH-CHECK', {
        headers: { 'X-Client-ID': id, 'X-Client-Secret': s },
      });
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) return { ok: false, message: `Credentials ไม่ถูกต้อง (${d.error || 'invalid'})` };
      if (r.status === 403) return { ok: false, message: `แอปถูกระงับ: ${d.error || 'inactive'}` };
      return { ok: true, message: `Credentials ใช้งานได้ (HTTP ${r.status})` };
    }
    if (provider === 'truewallet') {
      const url = cfg.truewallet?.apiUrl || 'https://apiparkxd.pro/api/topup';
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voucher: 'PING', phone: '0000000000' }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok || d.status) return { ok: true, message: `Endpoint ตอบกลับ: ${d.status || 'OK'}` };
      return { ok: false, message: `HTTP ${r.status}` };
    }
    return { ok: false, message: `Unknown provider: ${provider}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────── Owner verification (Firebase ID token) ───────────
let cachedFirebaseJwks: { keys: JsonWebKey[]; exp: number } | null = null;

function decodeB64Url(input: string): Uint8Array {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

function decodeJwtPart<T = any>(part: string): T {
  return JSON.parse(new TextDecoder().decode(decodeB64Url(part))) as T;
}

async function getFirebaseJwks(): Promise<JsonWebKey[]> {
  if (cachedFirebaseJwks && Date.now() < cachedFirebaseJwks.exp) return cachedFirebaseJwks.keys;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error(`fetch Firebase public keys failed: HTTP ${r.status}`);
  const j = await r.json();
  const maxAge = /max-age=(\d+)/i.exec(r.headers.get('cache-control') || '')?.[1];
  cachedFirebaseJwks = {
    keys: j.keys || [],
    exp: Date.now() + (Number(maxAge || 3600) * 1000),
  };
  return cachedFirebaseJwks.keys;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{ uid: string }> {
  // Accept either the env-configured project ID or the one in the service-account JSON
  const expectedProjects = new Set<string>();
  if (FIREBASE_PROJECT_ID) expectedProjects.add(FIREBASE_PROJECT_ID);
  const saPid = getServiceAccountProjectId();
  if (saPid) expectedProjects.add(saPid);
  if (expectedProjects.size === 0) throw new Error('server missing VITE_FIREBASE_PROJECT_ID');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('invalid JWT format');
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<{ sub?: string; aud?: string; iss?: string; exp?: number; iat?: number }>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unsupported JWT header');
  const keyJwk = (await getFirebaseJwks()).find(k => k.kid === header.kid);
  if (!keyJwk) throw new Error('Firebase public key not found for token');
  const key = await crypto.subtle.importKey('jwk', keyJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeB64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!verified) throw new Error('invalid JWT signature');
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) throw new Error('token expired');
  if (!payload.iat || payload.iat > now + 300) throw new Error('invalid token issue time');
  if (!payload.aud || !expectedProjects.has(payload.aud)) {
    throw new Error(`token audience mismatch (got ${payload.aud}, expected one of ${[...expectedProjects].join(',')})`);
  }
  if (!payload.iss || payload.iss !== `https://securetoken.google.com/${payload.aud}`) throw new Error('token issuer mismatch');
  if (!payload.sub || payload.sub.length > 128) throw new Error('token missing uid');
  return { uid: payload.sub };
}

// Owner-claim system removed — any authenticated user with Admin page access can edit config.
// Client-side role gate at /adminpanel guards this UI. Edge function only checks the token is valid.
async function verifyOwner(idToken: string | undefined): Promise<{ ok: boolean; uid?: string; reason?: string }> {
  if (!idToken) return { ok: false, reason: 'missing idToken' };
  try {
    const { uid } = await verifyFirebaseIdToken(idToken);
    return { ok: true, uid };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────── ROUTER ───────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'POST' ? (await req.clone().json().catch(() => ({}))).action : null) || 'create';

    // ── WEBHOOK (no auth required, providers call this) ──
    if (action === 'webhook') {
      const body = await req.json().catch(() => ({}));
      const reference = body.reference || body.userRef || body.merchantRef;
      if (!reference) return err('reference missing', 'BAD_REQUEST');
      const session = await fsGet('qrTopUpSessions', reference);
      if (!session) return err('session not found', 'NOT_FOUND');
      const status = (body.status || 'paid').toLowerCase();
      await fsUpdate('qrTopUpSessions', reference, {
        status: status === 'paid' || status === 'success' ? 'paid' : status,
        paidAt: new Date(),
        webhookPayload: body,
      });
      console.log(`[topup-qr] webhook ${reference} -> ${status}`);
      return ok({ ok: true });
    }

    // ── CREATE ──
    if (action === 'create') {
      const body = await req.json();
      const { provider = 'promptpay', amount, promptpayTarget } = body;

      // Require signed-in Firebase user; bind session to verified UID (ignore client-supplied userId)
      let userId: string;
      try {
        const verified = await verifyFirebaseIdToken(String(body.idToken || ""));
        userId = verified.uid;
      } catch (e) {
        return err(`unauthorized: ${e instanceof Error ? e.message : String(e)}`, 'UNAUTHORIZED');
      }

      if (!amount || amount <= 0) return err('amount ต้องมากกว่า 0', 'BAD_AMOUNT');

      let result: CreateOutput;
      const p = String(provider).toLowerCase();
      if (p === 'plernpay') result = await createPlernPay({ provider: p, amount, userId, promptpayTarget });
      else if (p === 'rdcw') result = await createRDCW({ provider: p, amount, userId, promptpayTarget });
      else result = await createPromptPay({ provider: 'promptpay', amount, userId, promptpayTarget });

      await fsCreate('qrTopUpSessions', result.reference, {
        userId, amount, provider: p, status: 'pending', qrPayload: result.qrPayload,
        providerRef: result.providerRef || '', createdAt: new Date(), expiresAt: result.expiresAt, credited: false,
      });
      return ok({ success: true, ...result, provider: p });
    }

    // ── STATUS (poll) ──
    if (action === 'status') {
      const body = await req.json();
      const reference = body.reference;
      if (!reference) return err('reference required', 'BAD_REQUEST');
      const session = await fsGet('qrTopUpSessions', reference);
      if (!session) return err('session not found', 'NOT_FOUND');

      // Local expiry check FIRST — avoid calling PlernPay for already-expired QR
      if (session.status === 'pending' && session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
        await fsUpdate('qrTopUpSessions', reference, { status: 'expired' });
        session.status = 'expired';
      }
      // If still pending and provider supports polling, refresh from upstream
      if (session.status === 'pending' && session.provider === 'plernpay' && session.providerRef) {
        const live = await statusPlernPay(session.providerRef);
        if (live !== 'pending') {
          await fsUpdate('qrTopUpSessions', reference, { status: live, paidAt: live === 'paid' ? new Date() : null });
          session.status = live;
        }
      }
      return ok({ success: true, status: session.status, amount: session.amount, credited: session.credited, reference });
    }

    // ── MARK CREDITED (called by client after wallet credited) ──
    if (action === 'mark_credited') {
      const body = await req.json();
      const reference = body.reference;
      if (!reference) return err('reference required', 'BAD_REQUEST');

      // Verify caller and ensure session belongs to them
      let callerUid: string;
      try {
        const verified = await verifyFirebaseIdToken(String(body.idToken || ""));
        callerUid = verified.uid;
      } catch (e) {
        return err(`unauthorized: ${e instanceof Error ? e.message : String(e)}`, 'UNAUTHORIZED');
      }

      const session = await fsGet('qrTopUpSessions', reference);
      if (!session) return err('session not found', 'NOT_FOUND');
      if (session.userId !== callerUid) return err('session does not belong to caller', 'FORBIDDEN');
      if (session.credited) return ok({ success: true, alreadyCredited: true });
      if (session.status !== 'paid') return err('session ยังไม่ paid', 'NOT_PAID');
      await fsUpdate('qrTopUpSessions', reference, { credited: true, creditedAt: new Date() });
      // Also append a topUpHistory entry (best-effort) so it shows in WalletHistory
      try {
        await fsCreate('topUpHistory', `qr_${reference}`, {
          userId: session.userId,
          amount: session.amount,
          method: 'qr',
          provider: session.provider || 'plernpay',
          transRef: reference,
          status: 'success',
          createdAt: new Date(),
        });
      } catch (e) { console.warn('[topup-qr] history write failed:', e); }
      return ok({ success: true });
    }

    if (action === 'test_provider') {
      const body = await req.json().catch(() => ({}));
      cachedConfig = null; // force re-fetch latest creds
      const result = await testProvider(String(body.provider || '').toLowerCase());
      return ok({ success: result.ok, ...result });
    }

    if (action === 'has_owner') {
      try {
        const rows = await pgSelect<any>(`/topup_admins?select=firebase_uid,added_at,note&order=added_at.desc`);
        const latest = rows[0] || null;
        return ok({
          success: true,
          hasOwner: rows.length > 0,
          count: rows.length,
          latestClaimedAt: latest?.added_at || null,
          latestUid: latest?.firebase_uid || null,
          owners: rows.map((r: any) => ({ uid: r.firebase_uid, addedAt: r.added_at, note: r.note })),
        });
      } catch (e) {
        return ok({ success: true, hasOwner: false, count: 0, latestClaimedAt: null });
      }
    }

    if (action === 'claim_owner') {
      const body = await req.json().catch(() => ({}));
      try {
        const { uid } = await verifyFirebaseIdToken(body.idToken);
        const n = await ownerCount();
        if (n > 0 && !(await isOwner(uid))) return err('มีเจ้าของระบบอยู่แล้ว — ติดต่อเจ้าของเพื่อเพิ่มสิทธิ์', 'FORBIDDEN');
        await addOwner(uid);
        return ok({ success: true, uid });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e), 'UNAUTHORIZED');
      }
    }

    if (action === 'load_config') {
      const body = await req.json().catch(() => ({}));
      const v = await verifyOwner(body.idToken);
      if (!v.ok) return err(`unauthorized: ${v.reason}`, 'UNAUTHORIZED');
      const stored = (await loadConfigFromPg()) as any;
      const env = Deno.env.toObject();
      const pick = (a: string, b: string) => (a && String(a).trim() ? a : (b || ''));
      const merged = {
        thunder: {
          apiKey: pick(stored?.thunder?.apiKey, env.THUNDER_API_KEY),
          enabled: stored?.thunder?.enabled ?? true,
        },
        rdcw: {
          clientId: pick(stored?.rdcw?.clientId, env.RDCW_CLIENT_ID),
          clientSecret: pick(stored?.rdcw?.clientSecret, env.RDCW_CLIENT_SECRET),
          enabled: stored?.rdcw?.enabled ?? false,
        },
        slip2go: {
          apiKey: pick(stored?.slip2go?.apiKey, env.SLIP2GO_API_KEY),
          enabled: stored?.slip2go?.enabled ?? false,
        },
        plernpay: {
          clientId: pick(stored?.plernpay?.clientId, env.PLERNPAY_CLIENT_ID),
          clientSecret: pick(stored?.plernpay?.clientSecret, env.PLERNPAY_CLIENT_SECRET),
          enabled: stored?.plernpay?.enabled ?? false,
        },
        truewallet: {
          apiUrl: pick(stored?.truewallet?.apiUrl, env.TRUEWALLET_API_URL || 'https://apiparkxd.pro/api/topup'),
          enabled: stored?.truewallet?.enabled ?? true,
        },
      };
      return ok({ success: true, config: merged });
    }

    if (action === 'save_config') {
      const body = await req.json().catch(() => ({}));
      const v = await verifyOwner(body.idToken);
      if (!v.ok) return err(`unauthorized: ${v.reason}`, 'UNAUTHORIZED');
      if (!body.config || typeof body.config !== 'object') return err('config required', 'BAD_REQUEST');
      await saveConfigToPg(body.config, v.uid!);
      cachedConfig = null;
      return ok({ success: true });
    }

    if (action === 'invalidate_cache') {
      cachedConfig = null;
      return ok({ success: true });
    }

    return err(`Unknown action: ${action}`, 'BAD_ACTION');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('topup-qr error:', msg);
    return err(msg, 'INTERNAL_ERROR');
  }
});
