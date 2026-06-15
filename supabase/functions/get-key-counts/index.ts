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

// Cache results 30s — counts don't need to be real-time per request.
let cache: { ts: number; data: Record<string, number> } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!PROJECT_ID) return ok({ success: false, error: "Server misconfigured" });

    if (cache && Date.now() - cache.ts < 30_000) {
      return ok({ success: true, counts: cache.data, cached: true });
    }

    const token = await gcpToken();
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

    // runQuery returns up to ~20MB. With select=(productId,durationId) each doc
    // is tiny so this comfortably handles tens of thousands of unclaimed keys.
    const body = {
      structuredQuery: {
        from: [{ collectionId: "keys" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "claimed" },
            op: "EQUAL",
            value: { booleanValue: false },
          },
        },
        select: {
          fields: [
            { fieldPath: "productId" },
            { fieldPath: "durationId" },
          ],
        },
      },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      return ok({ success: false, error: `Firestore query failed: ${r.status} ${txt.slice(0, 200)}` });
    }
    const rows: any[] = await r.json();
    const counts: Record<string, number> = {};
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const doc = row?.document;
        if (!doc) continue;
        const pid = doc.fields?.productId?.stringValue || "";
        const did = doc.fields?.durationId?.stringValue || "";
        if (!pid || !did) continue;
        const k = `${pid}_${did}`;
        counts[k] = (counts[k] || 0) + 1;
      }
    }

    cache = { ts: Date.now(), data: counts };
    return ok({ success: true, counts });
  } catch (e) {
    return ok({ success: false, error: String((e as Error)?.message || e) });
  }
});
