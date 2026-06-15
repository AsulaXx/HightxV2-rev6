// Scheduled cleanup of activityLogs (older than 90d) and slipVerifyLogs / linkClicks (older than 60d).
// Deletes via Firestore REST API with a service-account JWT.
// Invoked by pg_cron (see supabase setup) — also callable manually with header `x-cron-key`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};

const FIREBASE_PROJECT_ID = Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const FIREBASE_SA = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
// Optional shared secret to gate manual invocations
const CRON_KEY = Deno.env.get("CRON_KEY") || "";

// Retention windows (days)
const RETENTION = {
  activityLogs: 90,
  slipVerifyLogs: 60,
  linkClicks: 60,
};

let cachedToken: { token: string; exp: number } | null = null;

async function gcpToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const raw = FIREBASE_SA.trim();
  const sa = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) =>
    btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const unsigned =
    b64u(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
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
    ""
  );
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned)
    )
  );
  const sigB64 = btoa(String.fromCharCode(...sig))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${sigB64}`,
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("GCP token failed: " + JSON.stringify(j));
  cachedToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

interface CleanupResult {
  collection: string;
  scanned: number;
  deleted: number;
  cutoffISO: string;
  error?: string;
}

/** Find docs older than cutoff via runQuery, then commit batched deletes. */
async function cleanupCollection(
  token: string,
  col: string,
  retentionDays: number,
  maxBatch = 200
): Promise<CleanupResult> {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffISO = new Date(cutoffMs).toISOString();
  const result: CleanupResult = { collection: col, scanned: 0, deleted: 0, cutoffISO };

  try {
    // Try multiple timestamp field names commonly used in this project
    const tsFields = ["timestamp", "createdAt", "ts", "verifiedAt"];
    let docNames: string[] = [];

    for (const tsField of tsFields) {
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: col }],
          where: {
            fieldFilter: {
              field: { fieldPath: tsField },
              op: "LESS_THAN",
              value: { timestampValue: cutoffISO },
            },
          },
          limit: maxBatch,
        },
      };
      const r = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(queryBody),
        }
      );
      if (!r.ok) continue;
      const arr = (await r.json()) as Array<{ document?: { name: string } }>;
      const found = arr.map((x) => x.document?.name).filter(Boolean) as string[];
      if (found.length > 0) {
        docNames = found;
        break;
      }
    }

    result.scanned = docNames.length;
    if (docNames.length === 0) return result;

    // commitBatchDelete
    const writes = docNames.map((name) => ({ delete: name }));
    const commitR = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ writes }),
      }
    );
    if (commitR.ok) {
      result.deleted = docNames.length;
    } else {
      const txt = await commitR.text();
      result.error = `commit ${commitR.status}: ${txt.slice(0, 200)}`;
    }
  } catch (e) {
    result.error = String(e);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Optional CRON_KEY protection
  if (CRON_KEY) {
    const provided = req.headers.get("x-cron-key") || "";
    if (provided !== CRON_KEY) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_SA) {
    return new Response(
      JSON.stringify({ ok: false, error: "FIREBASE_PROJECT_ID/FIREBASE_SERVICE_ACCOUNT not configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const token = await gcpToken();
    const results: CleanupResult[] = [];
    for (const [col, days] of Object.entries(RETENTION)) {
      // run up to 5 batches per collection per invocation (max ~1000 deletes)
      let totalDel = 0;
      let totalScan = 0;
      let lastErr: string | undefined;
      for (let i = 0; i < 5; i++) {
        const r = await cleanupCollection(token, col, days);
        totalScan += r.scanned;
        totalDel += r.deleted;
        if (r.error) { lastErr = r.error; break; }
        if (r.scanned < 200) break; // no more old docs
      }
      results.push({
        collection: col,
        scanned: totalScan,
        deleted: totalDel,
        cutoffISO: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        error: lastErr,
      });
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
