// Server-side wheel spin.
// - Verifies caller's Firebase ID token (RS256 via Google JWKS)
// - Performs the entire spin atomically via Firestore REST transaction
//   (read wheel + user-spin + wallet + candidate keys → validate → weighted pick → commit)
// - Returns the chosen prize + claimed key (if product reward)
//
// This removes the previous client-side `pickWeightedIndex()` choice — the user can no
// longer spoof prizeId via devtools to pick a desired in-stock prize.
//
// verify_jwt = false in supabase/config.toml (we verify the Firebase token in code).
// Always returns HTTP 200 (project edge-function pattern); status in JSON body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIREBASE_PROJECT_ID = Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";

// ─── GCP service-account access token (cached) ───
let cachedGcp: { token: string; exp: number } | null = null;
async function gcpToken(): Promise<string> {
  if (cachedGcp && Date.now() < cachedGcp.exp - 60_000) return cachedGcp.token;
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
  if (!j.access_token) throw new Error("GCP token failed: " + JSON.stringify(j));
  cachedGcp = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

// ─── Firebase ID token verification (JWKS, cached 1h) ───
let jwksCache: { keys: any[]; exp: number } | null = null;
async function getJwks(): Promise<any[]> {
  if (jwksCache && Date.now() < jwksCache.exp) return jwksCache.keys;
  const r = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
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

async function verifyIdToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed id token");
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(b64uDecodeStr(headerB64));
  const payload = JSON.parse(b64uDecodeStr(payloadB64));

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now - 30) throw new Error("token expired");
  if (typeof payload.iat !== "number" || payload.iat > now + 60) throw new Error("token iat in future");
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error("wrong audience");
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error("wrong issuer");
  if (!payload.sub) throw new Error("missing sub");
  if (header.alg !== "RS256") throw new Error("unexpected alg");

  const keys = await getJwks();
  const jwk = keys.find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown kid");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
  );
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = b64uDecodeBytes(sigB64);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data);
  if (!valid) throw new Error("invalid signature");

  return { uid: payload.sub, email: payload.email };
}

// ─── Firestore REST helpers ───
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FS_DOC_PREFIX = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

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

function encode(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === "object") {
    const fields: Record<string, any> = {};
    for (const [k, vv] of Object.entries(v)) fields[k] = encode(vv);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function encodeFields(o: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) out[k] = encode(v);
  return out;
}

async function fsBeginTxn(token: string): Promise<string> {
  const r = await fetch(`${FS_BASE}:beginTransaction`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  const j = await r.json();
  if (!j.transaction) throw new Error("beginTransaction failed: " + JSON.stringify(j));
  return j.transaction;
}

async function fsBatchGet(token: string, paths: string[], txn: string): Promise<Record<string, any | null>> {
  const r = await fetch(`${FS_BASE}:batchGet`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      documents: paths.map((p) => `${FS_DOC_PREFIX}/${p}`),
      transaction: txn,
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("batchGet failed: " + text);
  // Response is JSON-array-of-results
  const lines = text.trim().split("\n").filter(Boolean);
  // Some servers return one big JSON array; some return NDJSON. Try both.
  let items: any[];
  try { items = JSON.parse(text); } catch { items = lines.map((l) => JSON.parse(l)); }
  const out: Record<string, any | null> = {};
  for (const it of items) {
    if (it.found) {
      const name = it.found.name as string;
      const path = name.replace(`${FS_DOC_PREFIX}/`, "");
      out[path] = decodeFields(it.found.fields || {});
    } else if (it.missing) {
      const path = (it.missing as string).replace(`${FS_DOC_PREFIX}/`, "");
      out[path] = null;
    }
  }
  return out;
}

async function fsRunQuery(token: string, parent: string, structuredQuery: any, txn?: string): Promise<{ docId: string; data: Record<string, any> }[]> {
  const url = parent ? `${FS_BASE}/${parent}:runQuery` : `${FS_BASE}:runQuery`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(txn ? { structuredQuery, transaction: txn } : { structuredQuery }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("runQuery failed: " + text);
  let arr: any[];
  try { arr = JSON.parse(text); } catch { arr = text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  return arr
    .filter((x) => x.document)
    .map((x) => {
      const name = x.document.name as string;
      const docId = name.split("/").pop() as string;
      return { docId, data: decodeFields(x.document.fields || {}) };
    });
}

async function fsCommit(token: string, writes: any[], txn: string): Promise<void> {
  const r = await fetch(`${FS_BASE}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ writes, transaction: txn }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error("commit failed: " + text);
}

async function fsRollback(token: string, txn: string): Promise<void> {
  await fetch(`${FS_BASE}:rollback`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ transaction: txn }),
  }).catch(() => {});
}

// ─── Per-IP rate limit (10 spins/min) ───
const ipBuckets = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (ipBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 10) { ipBuckets.set(ip, arr); return true; }
  arr.push(now);
  ipBuckets.set(ip, arr);
  return false;
}

// ─── Per-uid in-flight lock (prevents double spin during the 4s animation) ───
const inFlight = new Set<string>();

// ─── Weighted random ───
function weightedPick<T>(items: T[], getW: (x: T) => number): T {
  const total = items.reduce((s, x) => s + Math.max(0, getW(x)), 0);
  if (total <= 0) return items[items.length - 1];
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, getW(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// ─── Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "unknown";

  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) {
    return new Response(JSON.stringify({ ok: false, error: "server_not_configured" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let uid = "";
  let userEmail = "";
  let txn = "";
  let gcp = "";

  try {
    const body = await req.json().catch(() => ({}));
    const wheelId: string = body.wheelId;
    const idToken: string = body.idToken;
    if (!wheelId || !idToken) {
      return new Response(JSON.stringify({ ok: false, error: "missing_args" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Verify caller
    const claims = await verifyIdToken(idToken);
    uid = claims.uid;
    userEmail = claims.email || "";

    if (inFlight.has(uid)) {
      return new Response(JSON.stringify({ ok: false, error: "spin_in_progress" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    inFlight.add(uid);

    gcp = await gcpToken();

    // 2. Read wheel CONFIG from public settings doc (admins author wheels there)
    //    We need the prize list + cost + cooldown + maxSpins.
    const settingsRead = await fsBatchGet(gcp, ["settings/site"], await (async () => {
      // Use a separate read-only txn for config (cheaper) — or just inline-read without txn
      txn = await fsBeginTxn(gcp);
      return txn;
    })());
    const settings = settingsRead["settings/site"] || {};
    const wheelCfg = (settings.wheels || []).find((w: any) => w.id === wheelId && w.enabled);
    if (!wheelCfg) {
      await fsRollback(gcp, txn);
      return new Response(JSON.stringify({ ok: false, error: "wheel_not_found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const productCfg = (settings.products || []);

    // 3. Read state docs (wheel state, user spin doc, wallet, profile)
    const reads = await fsBatchGet(gcp, [
      `wheels/${wheelId}`,
      `wheels/${wheelId}/users/${uid}`,
      `wallets/${uid}`,
      `users/${uid}`,
    ], txn);
    const wheelState = reads[`wheels/${wheelId}`] || {};
    const userSpinDoc = reads[`wheels/${wheelId}/users/${uid}`] || {};
    const wallet = reads[`wallets/${uid}`] || {};
    const userProfile = reads[`users/${uid}`] || {};

    // ─── Validate cooldown / maxSpins / balance ───
    const cooldownSec = Number(wheelCfg.cooldownSeconds || 0);
    const lastSpinAt = userSpinDoc.lastSpinAt ? new Date(userSpinDoc.lastSpinAt).getTime() : 0;
    if (cooldownSec > 0 && lastSpinAt + cooldownSec * 1000 > Date.now()) {
      await fsRollback(gcp, txn);
      const remain = Math.ceil((lastSpinAt + cooldownSec * 1000 - Date.now()) / 1000);
      return new Response(JSON.stringify({ ok: false, error: "cooldown", remain }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const spinCount = Number(userSpinDoc.spinCount || 0);
    if (Number(wheelCfg.maxSpinsPerUser || 0) > 0 && spinCount >= Number(wheelCfg.maxSpinsPerUser)) {
      await fsRollback(gcp, txn);
      return new Response(JSON.stringify({ ok: false, error: "max_spins" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cost = Number(wheelCfg.cost || 0);
    const balance = Number(wallet.balance || 0);
    if (cost > 0 && balance < cost) {
      await fsRollback(gcp, txn);
      return new Response(JSON.stringify({ ok: false, error: "insufficient" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Build effective stocks (state overrides config defaults) ───
    const stocks: Record<string, number> = {};
    for (const p of wheelCfg.prizes || []) {
      const fromState = (wheelState.prizeStocks || {})[p.id];
      stocks[p.id] = fromState === undefined ? Number(p.stock) : Number(fromState);
    }

    // ─── Eligible prizes (weight > 0 + has stock) ───
    const eligible = (wheelCfg.prizes || []).filter((p: any) =>
      Number(p.weight || 0) > 0 && (stocks[p.id] === -1 || (stocks[p.id] ?? 0) > 0)
    );
    if (eligible.length === 0) {
      await fsRollback(gcp, txn);
      return new Response(JSON.stringify({ ok: false, error: "all_out_of_stock" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Server-side weighted pick
    const prize: any = weightedPick(eligible, (p: any) => Number(p.weight) || 0);
    const isProductReward = prize.rewardType === "product" && !!prize.productId;
    const productInfo = isProductReward ? productCfg.find((x: any) => x.id === prize.productId) : null;
    const targetDurationId: string =
      prize.productDurationId
      || (productInfo && prize.productDays
            ? (productInfo.durations || []).find((d: any) => Number(d.days) === Number(prize.productDays))?.id || ""
            : "");

    // 5. If product reward: pick an unclaimed key via runQuery (inside txn)
    let claimedKey: { docId: string; value: string } | null = null;
    if (isProductReward) {
      const filters: any[] = [
        { fieldFilter: { field: { fieldPath: "productId" }, op: "EQUAL", value: { stringValue: prize.productId } } },
        { fieldFilter: { field: { fieldPath: "claimed" }, op: "EQUAL", value: { booleanValue: false } } },
      ];
      if (targetDurationId) {
        filters.push({ fieldFilter: { field: { fieldPath: "durationId" }, op: "EQUAL", value: { stringValue: targetDurationId } } });
      }
      const candidates = await fsRunQuery(gcp, "", {
        from: [{ collectionId: "keys" }],
        where: { compositeFilter: { op: "AND", filters } },
        limit: 1,
      }, txn);
      if (candidates.length > 0) {
        claimedKey = { docId: candidates[0].docId, value: String(candidates[0].data.key || "") };
      }
    }

    // 6. Build commit writes
    const nowIso = new Date().toISOString();
    const newStocks = { ...stocks };
    if (newStocks[prize.id] !== -1) newStocks[prize.id] = Math.max(0, (newStocks[prize.id] ?? 0) - 1);

    const creditWin = prize.rewardType === "credit" ? Number(prize.creditAmount || 0) : 0;
    const netDelta = creditWin - cost;

    const writes: any[] = [];
    // Wheel state — full overwrite of prizeStocks map + updatedAt
    writes.push({
      update: {
        name: `${FS_DOC_PREFIX}/wheels/${wheelId}`,
        fields: encodeFields({ prizeStocks: newStocks, updatedAt: nowIso }),
      },
      updateMask: { fieldPaths: ["prizeStocks", "updatedAt"] },
    });
    // User spin doc
    writes.push({
      update: {
        name: `${FS_DOC_PREFIX}/wheels/${wheelId}/users/${uid}`,
        fields: encodeFields({ lastSpinAt: nowIso, spinCount: spinCount + 1 }),
      },
      updateMask: { fieldPaths: ["lastSpinAt", "spinCount"] },
    });
    // Wallet — atomic increment if there's any net change
    if (netDelta !== 0) {
      writes.push({
        transform: {
          document: `${FS_DOC_PREFIX}/wallets/${uid}`,
          fieldTransforms: [{ fieldPath: "balance", increment: { integerValue: String(netDelta) } }],
        },
      });
    }
    // Mark key claimed (with precondition: must still exist)
    if (claimedKey) {
      writes.push({
        update: {
          name: `${FS_DOC_PREFIX}/keys/${claimedKey.docId}`,
          fields: encodeFields({
            claimed: true,
            claimedBy: uid,
            claimedByEmail: userEmail,
            claimedAt: nowIso,
            price: 0,
            purchaseType: "wheel",
            claimNote: `รางวัลจากวงล้อ: ${wheelCfg.name}`,
            wheelId,
            wheelPrizeId: prize.id,
          }),
        },
        updateMask: {
          fieldPaths: ["claimed", "claimedBy", "claimedByEmail", "claimedAt", "price", "purchaseType", "claimNote", "wheelId", "wheelPrizeId"],
        },
        currentDocument: { exists: true },
      });
    }

    // Append-only log: spin record
    const spinDocId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    writes.push({
      update: {
        name: `${FS_DOC_PREFIX}/wheels/${wheelId}/spins/${spinDocId}`,
        fields: encodeFields({
          wheelId,
          wheelName: wheelCfg.name,
          userId: uid,
          userEmail,
          userName: userProfile.displayName || userProfile.email || "",
          prizeId: prize.id,
          prizeLabel: prize.label,
          rewardType: prize.rewardType,
          creditAmount: creditWin,
          productId: prize.productId || null,
          productName: productInfo?.name || null,
          productDays: Number(prize.productDays || 0),
          productKey: claimedKey?.value || null,
          customNote: prize.customNote || null,
          cost,
          stockDecremented: prize.stock !== -1,
          at: nowIso,
        }),
      },
    });

    // Append-only audit doc for product key wins (admin can correlate to keys collection)
    if (claimedKey) {
      const claimDocId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      writes.push({
        update: {
          name: `${FS_DOC_PREFIX}/wheelClaims/${claimDocId}`,
          fields: encodeFields({
            wheelId,
            wheelName: wheelCfg.name,
            prizeId: prize.id,
            prizeLabel: prize.label,
            productId: prize.productId,
            productName: productInfo?.name || prize.label,
            durationId: targetDurationId,
            durationLabel: (productInfo?.durations || []).find((d: any) => d.id === targetDurationId)?.label
              || (prize.productDays ? `${prize.productDays} วัน` : ""),
            key: claimedKey.value,
            userId: uid,
            userEmail,
            userName: userProfile.displayName || userProfile.email || "",
            costCredit: cost,
            claimedAt: nowIso,
          }),
        },
      });
    }

    // 7. Commit atomically
    await fsCommit(gcp, writes, txn);

    return new Response(JSON.stringify({
      ok: true,
      prize: {
        id: prize.id,
        label: prize.label,
        rewardType: prize.rewardType,
        creditAmount: creditWin,
        productId: prize.productId || null,
        productName: productInfo?.name || null,
        productDays: Number(prize.productDays || 0),
        durationId: targetDurationId,
        customNote: prize.customNote || null,
      },
      claimedKey: claimedKey?.value || null,
      newBalance: balance + netDelta,
      newSpinCount: spinCount + 1,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    if (txn && gcp) await fsRollback(gcp, txn);
    console.error("[spin-wheel] error:", e);
    return new Response(JSON.stringify({ ok: false, error: "server_error", detail: String(e?.message || e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (uid) inFlight.delete(uid);
  }
});
