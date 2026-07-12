// Edge Function: redeem-angpao
// Redeems a TrueMoney "ซองอั่งเปา" (gift voucher) using the public
// gift.truemoney.com endpoint (same flow as github.com/pichxyaponn/tw-angpao),
// then atomically credits the user's wallet in Firestore.
//
// Body: { voucherCode: string, mobile: string, uid: string }
// Returns: { success: boolean, amount?: number, message: string, code?: string }
//
// All secrets are read from environment variables — nothing is hardcoded.
//   FIREBASE_PROJECT_ID         (or VITE_FIREBASE_PROJECT_ID)
//   FIREBASE_SERVICE_ACCOUNT    (raw JSON or base64-encoded JSON)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
// Extract project_id from the service-account JSON if the env var is not set
function extractProjectIdFromSA(sa: string): string {
  if (!sa) return "";
  try {
    const raw = sa.trim();
    const parsed = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
    return parsed.project_id || "";
  } catch {
    return "";
  }
}
const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  extractProjectIdFromSA(FIREBASE_SA);

const TRUEMONEY_BASE =
  "https://gift.truemoney.com/campaign/vouchers";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function parseVoucherCode(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim();
  // Accept full URLs (?v=CODE) or bare codes
  const fromQuery = s.split("v=")[1];
  const candidate = (fromQuery || s).match(/[0-9A-Za-z]{12,40}/);
  return candidate ? candidate[0] : null;
}

function normalizeMobile(raw: string): string | null {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length !== 10 || !digits.startsWith("0")) return null;
  return digits;
}

// ────────────────────────────────────────────────────────────────────────────
// Google service-account auth (for Firestore REST)
// ────────────────────────────────────────────────────────────────────────────
let cachedToken: { token: string; exp: number } | null = null;
async function gcpToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) {
    return cachedToken.token;
  }
  if (!FIREBASE_SA) throw new Error("FIREBASE_SERVICE_ACCOUNT not set");
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) =>
    btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const unsigned =
    b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64u(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    );
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
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("GCP token failed: " + JSON.stringify(j));
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

const fsBase = () =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const fsDocName = (path: string) =>
  `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

// ────────────────────────────────────────────────────────────────────────────
// Atomic credit + duplicate-guard via Firestore transaction
// Uses the EXISTING project schema:
//   wallets/{uid}.balance       — running balance (number)
//   walletLedger/{auto}         — immutable audit log entry
//   processedSlips/{voucher}    — duplicate guard (one doc per voucher)
// ────────────────────────────────────────────────────────────────────────────
async function creditWallet(opts: {
  uid: string;
  amount: number;
  voucherCode: string;
  ownerName: string;
  mobile: string;
}): Promise<{ duplicate: boolean; balanceAfter: number }> {
  const { uid, amount, voucherCode, ownerName, mobile } = opts;
  const token = await gcpToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1. begin transaction
  const beginRes = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:beginTransaction`, {
    method: "POST",
    headers,
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  const beginJson = await beginRes.json();
  if (!beginJson.transaction) {
    throw new Error("beginTransaction failed: " + JSON.stringify(beginJson));
  }
  const txn: string = beginJson.transaction;

  // 2. read wallet + guard doc within the transaction
  const walletPath = `wallets/${uid}`;
  const guardPath = `processedSlips/${voucherCode.replace(/[\/#?]/g, "_")}`;
  const ledgerName = `walletLedger/edge_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

  const batchGet = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:batchGet`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      documents: [fsDocName(walletPath), fsDocName(guardPath)],
      transaction: txn,
    }),
  });
  const batchJson = await batchGet.json();
  if (!Array.isArray(batchJson)) {
    throw new Error("batchGet failed: " + JSON.stringify(batchJson));
  }

  let walletExists = false;
  let currentBalance = 0;
  let guardExists = false;
  for (const item of batchJson) {
    if (item.found?.name?.endsWith(walletPath)) {
      walletExists = true;
      const f = item.found.fields || {};
      const v = f.balance;
      currentBalance = Number(
        v?.integerValue ?? v?.doubleValue ?? 0,
      );
    } else if (item.found?.name?.endsWith(guardPath)) {
      guardExists = true;
    }
  }

  if (guardExists) {
    // Cancel txn (best-effort) and report duplicate
    await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:rollback`, {
      method: "POST",
      headers,
      body: JSON.stringify({ transaction: txn }),
    }).catch(() => {});
    return { duplicate: true, balanceAfter: currentBalance };
  }

  const nextBalance = currentBalance + amount;
  const nowIso = new Date().toISOString();

  // 3. commit: write wallet + guard + ledger atomically
  const writes: unknown[] = [];

  // Wallet upsert
  writes.push({
    update: {
      name: fsDocName(walletPath),
      fields: walletExists
        ? {
            balance: { doubleValue: nextBalance },
            lastTopUp: { timestampValue: nowIso },
            updatedAt: { timestampValue: nowIso },
          }
        : {
            balance: { doubleValue: nextBalance },
            userId: { stringValue: uid },
            lastTopUp: { timestampValue: nowIso },
            createdAt: { timestampValue: nowIso },
            updatedAt: { timestampValue: nowIso },
          },
    },
    updateMask: walletExists
      ? { fieldPaths: ["balance", "lastTopUp", "updatedAt"] }
      : undefined,
  });

  // Duplicate guard (must not exist — enforced by precondition)
  writes.push({
    update: {
      name: fsDocName(guardPath),
      fields: {
        userId: { stringValue: uid },
        amount: { doubleValue: amount },
        type: { stringValue: "topup_voucher" },
        voucherCode: { stringValue: voucherCode },
        createdAt: { timestampValue: nowIso },
        source: { stringValue: "redeem-angpao" },
      },
    },
    currentDocument: { exists: false },
  });

  // Audit ledger entry (keeps dashboards & analytics working)
  writes.push({
    update: {
      name: fsDocName(ledgerName),
      fields: {
        userId: { stringValue: uid },
        type: { stringValue: "topup_voucher" },
        amount: { doubleValue: amount },
        method: { stringValue: "voucher" },
        description: {
          stringValue: `เติมเงินซองอั่งเปาจาก ${ownerName}`,
        },
        refId: { stringValue: voucherCode },
        balanceBefore: { doubleValue: currentBalance },
        balanceAfter: { doubleValue: nextBalance },
        receiverMobile: { stringValue: mobile },
        ownerName: { stringValue: ownerName },
        source: { stringValue: "redeem-angpao" },
        createdAt: { timestampValue: nowIso },
      },
    },
  });

  const commitRes = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:commit`, {
    method: "POST",
    headers,
    body: JSON.stringify({ writes, transaction: txn }),
  });
  const commitJson = await commitRes.json();
  if (!commitRes.ok || commitJson.error) {
    // ALREADY_EXISTS = guard tripped (concurrent claim)
    const msg = JSON.stringify(commitJson);
    if (msg.includes("ALREADY_EXISTS")) {
      return { duplicate: true, balanceAfter: currentBalance };
    }
    throw new Error("commit failed: " + msg);
  }

  // Also write a topup_logs entry (non-transactional, fire-and-forget audit)
  await fetch(`${fsBase()}/topup_logs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fields: {
        userId: { stringValue: uid },
        method: { stringValue: "voucher" },
        amount: { doubleValue: amount },
        voucherCode: { stringValue: voucherCode },
        mobile: { stringValue: mobile },
        ownerName: { stringValue: ownerName },
        status: { stringValue: "success" },
        balanceAfter: { doubleValue: nextBalance },
        createdAt: { timestampValue: nowIso },
      },
    }),
  }).catch(() => {});

  return { duplicate: false, balanceAfter: nextBalance };
}

async function logFailure(payload: Record<string, unknown>) {
  try {
    const token = await gcpToken();
    await fetch(`${fsBase()}/topup_logs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries({
            ...payload,
            createdAt: new Date().toISOString(),
          }).map(([k, v]) => {
            if (typeof v === "number") return [k, { doubleValue: v }];
            if (typeof v === "boolean") return [k, { booleanValue: v }];
            return [k, { stringValue: String(v ?? "") }];
          }),
        ),
      }),
    });
  } catch (_) {
    // Logging is best-effort
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Rate limit (per IP, 5 / min)
// ────────────────────────────────────────────────────────────────────────────
const rl = new Map<string, { count: number; resetAt: number }>();
function allowRate(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.resetAt) {
    rl.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  return ++e.count <= 5;
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP entry point
// ────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRate(ip)) {
    return json(
      { success: false, message: "คำขอมากเกินไป กรุณารอสักครู่" },
      429,
    );
  }

  let body: { voucherCode?: string; mobile?: string; uid?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "Invalid JSON body" }, 400);
  }

  const voucherCode = parseVoucherCode(body.voucherCode || "");
  const mobile = normalizeMobile(body.mobile || "");
  const uid = String(body.uid || "").trim();

  if (!voucherCode) {
    return json(
      { success: false, message: "ลิงก์/รหัสซองอั่งเปาไม่ถูกต้อง" },
      400,
    );
  }
  if (!mobile) {
    return json(
      { success: false, message: "เบอร์โทร TrueWallet ไม่ถูกต้อง (ต้อง 10 หลัก ขึ้นต้นด้วย 0)" },
      400,
    );
  }
  if (!uid) {
    return json({ success: false, message: "missing uid" }, 400);
  }
  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) {
    return json(
      { success: false, message: "Server misconfigured: Firebase credentials missing" },
      500,
    );
  }

  // ── Redeem with TrueMoney (tw-angpao flow) ──
  let twResp: Response;
  let twJson: any;
  try {
    twResp = await fetch(`${TRUEMONEY_BASE}/${voucherCode}/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: JSON.stringify({
        mobile,
        voucher_hash: voucherCode,
      }),
    });
    twJson = await twResp.json().catch(() => ({}));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logFailure({
      method: "voucher",
      userId: uid,
      voucherCode,
      mobile,
      status: "failed",
      error: `network: ${msg}`,
    });
    return json(
      { success: false, message: `เชื่อมต่อ TrueMoney ไม่สำเร็จ: ${msg}` },
      502,
    );
  }

  const status: string = (twJson?.status?.code || "").toString().toUpperCase();
  if (status !== "SUCCESS") {
    const codeMap: Record<string, string> = {
      VOUCHER_OUT_OF_STOCK: "ซองนี้ถูกใช้หมดแล้ว",
      VOUCHER_NOT_FOUND: "ไม่พบซองอั่งเปานี้",
      VOUCHER_EXPIRED: "ซองอั่งเปาหมดอายุแล้ว",
      VOUCHER_NOT_ACTIVE: "ซองนี้ยังไม่เริ่มใช้งาน",
      USER_NOT_FOUND: "ไม่พบบัญชี TrueWallet ของเบอร์นี้",
      TARGET_USER_NOT_FOUND: "ไม่พบบัญชี TrueWallet ของเบอร์นี้",
      CANNOT_GET_OWN_VOUCHER: "ไม่สามารถรับซองของตัวเองได้",
      INTERNAL_ERROR: "ระบบ TrueMoney ขัดข้อง กรุณาลองใหม่",
    };
    const msg =
      codeMap[status] ||
      twJson?.status?.message ||
      `เกิดข้อผิดพลาด: ${status || "UNKNOWN"}`;
    await logFailure({
      method: "voucher",
      userId: uid,
      voucherCode,
      mobile,
      status: "failed",
      error: status,
      message: msg,
    });
    return json({ success: false, message: msg, code: status }, 200);
  }

  const amount =
    Number(twJson?.data?.my_ticket?.amount_baht) ||
    Number(twJson?.data?.voucher?.amount_baht) ||
    Number(twJson?.data?.amount_baht) ||
    0;
  const ownerName =
    twJson?.data?.voucher?.member_full_name ||
    twJson?.data?.owner_full_name ||
    "-";

  if (!amount || amount <= 0) {
    await logFailure({
      method: "voucher",
      userId: uid,
      voucherCode,
      mobile,
      status: "failed",
      error: "zero_amount",
      raw: JSON.stringify(twJson).slice(0, 500),
    });
    return json(
      { success: false, message: "รับซองสำเร็จแต่ไม่พบยอดเงิน กรุณาแจ้งแอดมิน" },
      200,
    );
  }

  // ── Credit wallet atomically ──
  try {
    const { duplicate, balanceAfter } = await creditWallet({
      uid,
      amount,
      voucherCode,
      ownerName,
      mobile,
    });
    if (duplicate) {
      return json(
        {
          success: false,
          message: "ซองนี้ถูกใช้เติมเงินไปแล้ว",
          code: "DUPLICATE",
          amount,
        },
        200,
      );
    }
    return json(
      {
        success: true,
        amount,
        ownerName,
        balanceAfter,
        message: `เติมเงิน ฿${amount.toLocaleString()} สำเร็จ`,
      },
      200,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[redeem-angpao] credit failed:", msg);
    await logFailure({
      method: "voucher",
      userId: uid,
      voucherCode,
      mobile,
      status: "failed_after_redeem",
      amount,
      error: msg,
    });
    return json(
      {
        success: false,
        message:
          "รับซองสำเร็จแต่เครดิตเข้ากระเป๋าไม่สำเร็จ กรุณาแจ้งแอดมินพร้อมรหัสซอง",
        code: "CREDIT_FAILED",
        amount,
      },
      500,
    );
  }
});
