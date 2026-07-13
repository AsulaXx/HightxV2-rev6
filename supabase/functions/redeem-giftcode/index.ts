// Edge Function: redeem-giftcode
// Atomically validates & increments a gift code's usedCount inside
// settings/site (owner-only doc), so clients (any signed-in user) can
// redeem without needing write access to the settings doc.
//
// Body: { code: string }
// Auth: Authorization: Bearer <Firebase ID token>
// Returns: { success, amount?, code?, id?, message }
//
// The client is still responsible for writing wallet ledger + topUpHistory
// (those collections already allow user writes with the correct RLS).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyFirebaseRequest, gcpToken, corsHeaders, authErrorResponse } from "../_shared/firebaseAuth.ts";

const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
function extractProjectIdFromSA(sa: string): string {
  if (!sa) return "";
  try {
    const raw = sa.trim();
    const parsed = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
    return parsed.project_id || "";
  } catch { return ""; }
}
const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  extractProjectIdFromSA(FIREBASE_SA);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fsBase = () =>
  `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const fsDocName = (path: string) =>
  `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;

// Convert Firestore REST value → JS
function fromFsValue(v: any): any {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in v) {
    const out: any = {};
    const fields = v.mapValue.fields || {};
    for (const k of Object.keys(fields)) out[k] = fromFsValue(fields[k]);
    return out;
  }
  return null;
}
function toFsValue(x: any): any {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "string") return { stringValue: x };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") {
    return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  }
  if (Array.isArray(x)) return { arrayValue: { values: x.map(toFsValue) } };
  if (typeof x === "object") {
    const fields: any = {};
    for (const k of Object.keys(x)) fields[k] = toFsValue(x[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(x) };
}

// Rate limit (per uid, 10/min)
const rl = new Map<string, { count: number; resetAt: number }>();
function allowRate(key: string): boolean {
  const now = Date.now();
  const e = rl.get(key);
  if (!e || now > e.resetAt) { rl.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  return ++e.count <= 10;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Method not allowed" }, 200);

  let uid = "";
  try {
    const auth = await verifyFirebaseRequest(req);
    uid = auth.uid;
  } catch (e) {
    return authErrorResponse(e);
  }
  if (!allowRate(uid)) return json({ success: false, message: "คำขอมากเกินไป กรุณารอสักครู่" });

  let body: { code?: string };
  try { body = await req.json(); } catch { return json({ success: false, message: "Invalid JSON body" }); }
  const rawCode = String(body.code || "").trim();
  if (!rawCode) return json({ success: false, message: "กรุณาระบุ Gift Code" });
  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) return json({ success: false, message: "Server misconfigured" });

  const token = await gcpToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Firestore transaction: read settings + guard, then commit atomically ──
  const settingsPath = "settings/site";
  const guardPath = `processedSlips/gift_${rawCode.replace(/[\/#?]/g, "_")}_${uid}`;

  // Begin txn
  const beginRes = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:beginTransaction`, {
    method: "POST", headers, body: JSON.stringify({ options: { readWrite: {} } }),
  });
  const beginJson = await beginRes.json();
  if (!beginJson.transaction) return json({ success: false, message: "เริ่ม transaction ไม่สำเร็จ" });
  const txn: string = beginJson.transaction;

  const rollback = () => fetch(`${fsBase().replace(/\/documents$/, "")}/documents:rollback`, {
    method: "POST", headers, body: JSON.stringify({ transaction: txn }),
  }).catch(() => {});

  // Batch read settings + guard
  const batchRes = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:batchGet`, {
    method: "POST", headers,
    body: JSON.stringify({ documents: [fsDocName(settingsPath), fsDocName(guardPath)], transaction: txn }),
  });
  const batchJson = await batchRes.json();
  if (!Array.isArray(batchJson)) { await rollback(); return json({ success: false, message: "อ่านข้อมูลไม่สำเร็จ" }); }

  let settingsFields: any = null;
  let guardExists = false;
  for (const item of batchJson) {
    if (item.found?.name?.endsWith(settingsPath)) settingsFields = item.found.fields || {};
    else if (item.found?.name?.endsWith(guardPath)) guardExists = true;
  }
  if (!settingsFields) { await rollback(); return json({ success: false, message: "ไม่พบการตั้งค่า" }); }
  if (guardExists) { await rollback(); return json({ success: false, message: "คุณเคยใช้ Gift Code นี้แล้ว" }); }

  const giftCodes: any[] = settingsFields.giftCodes ? (fromFsValue(settingsFields.giftCodes) || []) : [];
  const idx = giftCodes.findIndex((c: any) => c && c.code === rawCode && c.enabled);
  if (idx < 0) { await rollback(); return json({ success: false, message: "Gift Code ไม่ถูกต้องหรือถูกปิดใช้งาน" }); }
  const gc = giftCodes[idx];
  const usedCount = Number(gc.usedCount || 0);
  const maxUses = Number(gc.maxUses || 0);
  if (maxUses > 0 && usedCount >= maxUses) { await rollback(); return json({ success: false, message: "Gift Code นี้ถูกใช้ครบจำนวนแล้ว" }); }
  if (gc.expiresAt && new Date(gc.expiresAt) < new Date()) { await rollback(); return json({ success: false, message: "Gift Code หมดอายุแล้ว" }); }
  const amount = Number(gc.amount || 0);
  if (!amount || amount <= 0) { await rollback(); return json({ success: false, message: "จำนวนเงินของ Gift Code ไม่ถูกต้อง" }); }

  const updatedCodes = giftCodes.map((c, i) => i === idx ? { ...c, usedCount: usedCount + 1 } : c);

  // Commit: update settings.giftCodes only + create per-user guard doc
  const nowIso = new Date().toISOString();
  const writes: unknown[] = [
    {
      update: {
        name: fsDocName(settingsPath),
        fields: { giftCodes: toFsValue(updatedCodes) },
      },
      updateMask: { fieldPaths: ["giftCodes"] },
    },
    {
      update: {
        name: fsDocName(guardPath),
        fields: {
          userId: { stringValue: uid },
          type: { stringValue: "topup_giftcode" },
          giftCodeId: { stringValue: String(gc.id || "") },
          code: { stringValue: rawCode },
          amount: { doubleValue: amount },
          createdAt: { timestampValue: nowIso },
          source: { stringValue: "redeem-giftcode" },
        },
      },
      currentDocument: { exists: false },
    },
  ];

  const commitRes = await fetch(`${fsBase().replace(/\/documents$/, "")}/documents:commit`, {
    method: "POST", headers, body: JSON.stringify({ writes, transaction: txn }),
  });
  const commitJson = await commitRes.json();
  if (!commitRes.ok || commitJson.error) {
    const msg = JSON.stringify(commitJson);
    if (msg.includes("ALREADY_EXISTS")) return json({ success: false, message: "คุณเคยใช้ Gift Code นี้แล้ว" });
    return json({ success: false, message: "บันทึกข้อมูลไม่สำเร็จ: " + msg.slice(0, 200) });
  }

  return json({ success: true, amount, code: rawCode, id: gc.id || "", message: "OK" });
});
