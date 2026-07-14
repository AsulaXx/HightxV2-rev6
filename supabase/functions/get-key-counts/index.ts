// Returns unclaimed key counts grouped by `${productId}_${durationId}`.
// Uses Firebase service account so regular users can see stock without being
// able to read raw key strings (which are restricted to staff via Firestore rules).
// Pattern: always HTTP 200, JSON body with success flag.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { gcpToken, corsHeaders } from "../_shared/firebaseAuth.ts";

function deriveProjectId(): string {
  try {
    const sa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
    if (!sa) return "";
    const parsed = JSON.parse(sa.trim().startsWith("{") ? sa.trim() : atob(sa.trim()));
    return String(parsed.project_id || "");
  } catch { return ""; }
}
const PROJECT_ID = deriveProjectId() || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";

const ok = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// Cache: 30s for unclaimed counts, 5min for sold counts (claimed grows forever).
let cache: { ts: number; data: Record<string, number> } | null = null;
let soldCache: { ts: number; data: Record<string, number> } | null = null;
let totalsCache: { ts: number; users: number; stock: number; sales: number } | null = null;

async function runKeysQuery(token: string, claimed: boolean) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "keys" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "claimed" },
          op: "EQUAL",
          value: { booleanValue: claimed },
        },
      },
      select: { fields: [{ fieldPath: "productId" }, { fieldPath: "durationId" }] },
    },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Firestore query failed: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as any[];
}

async function countCollection(token: string, collectionId: string, where?: any): Promise<number> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runAggregationQuery`;
  const structuredQuery: any = { from: [{ collectionId }] };
  if (where) structuredQuery.where = where;
  const body = {
    structuredAggregationQuery: {
      structuredQuery,
      aggregations: [{ alias: "c", count: {} }],
    },
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return 0;
  const rows = (await r.json()) as any[];
  const v = rows?.[0]?.result?.aggregateFields?.c?.integerValue;
  return v ? Number(v) : 0;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!PROJECT_ID) return ok({ success: false, error: "Server misconfigured" });

    const now = Date.now();
    const needCounts = !cache || now - cache.ts >= 30_000;
    const needSold = !soldCache || now - soldCache.ts >= 5 * 60_000;
    const needTotals = !totalsCache || now - totalsCache.ts >= 60_000;

    let token = "";
    if (needCounts || needSold || needTotals) token = await gcpToken();

    if (needCounts) {
      const rows = await runKeysQuery(token, false);
      const counts: Record<string, number> = {};
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const doc = row?.document; if (!doc) continue;
          const pid = doc.fields?.productId?.stringValue || "";
          const did = doc.fields?.durationId?.stringValue || "";
          if (!pid || !did) continue;
          const k = `${pid}_${did}`;
          counts[k] = (counts[k] || 0) + 1;
        }
      }
      cache = { ts: now, data: counts };
    }

    if (needSold) {
      const rows = await runKeysQuery(token, true);
      const sold: Record<string, number> = {};
      if (Array.isArray(rows)) {
        for (const row of rows) {
          const doc = row?.document; if (!doc) continue;
          const pid = doc.fields?.productId?.stringValue || "";
          if (!pid) continue;
          sold[pid] = (sold[pid] || 0) + 1;
        }
      }
      soldCache = { ts: now, data: sold };
    }

    if (needTotals) {
      const claimedFilter = {
        fieldFilter: {
          field: { fieldPath: "claimed" },
          op: "EQUAL",
          value: { booleanValue: true },
        },
      };
      const unclaimedFilter = {
        fieldFilter: {
          field: { fieldPath: "claimed" },
          op: "EQUAL",
          value: { booleanValue: false },
        },
      };
      const [users, stock, sales] = await Promise.all([
        countCollection(token, "users"),
        countCollection(token, "keys", unclaimedFilter),
        countCollection(token, "keys", claimedFilter),
      ]);
      totalsCache = { ts: now, users, stock, sales };
    }

    return ok({
      success: true,
      counts: cache!.data,
      sold: soldCache!.data,
      totals: { users: totalsCache!.users, stock: totalsCache!.stock, sales: totalsCache!.sales },
    });
  } catch (e) {
    return ok({ success: false, error: String((e as Error)?.message || e) });
  }
});
