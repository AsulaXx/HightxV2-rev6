// Allocates and marks unclaimed keys as claimed by the authenticated user.
// Bypasses Firestore client-side read restrictions on `keys` collection so
// regular (non-staff) users can purchase. Wallet deduction + claimHistory
// writes remain on the client so existing audit/refund flows are unchanged.
//
// Pattern: always HTTP 200, JSON body with success flag.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  gcpToken,
  verifyFirebaseRequest,
  authErrorResponse,
} from "../_shared/firebaseAuth.ts";

function deriveProjectId(): string {
  try {
    const sa = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") || "";
    if (!sa) return "";
    const parsed = JSON.parse(sa.trim().startsWith("{") ? sa.trim() : atob(sa.trim()));
    return String(parsed.project_id || "");
  } catch { return ""; }
}
const PROJECT_ID = deriveProjectId() || Deno.env.get("VITE_FIREBASE_PROJECT_ID") || "";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const ok = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type ClaimItem = {
  productId: string;
  durationId: string;
  quantity: number;
  price?: number;
  productName?: string;
  durationLabel?: string;
  claimNote?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!PROJECT_ID) return ok({ success: false, error: "Server misconfigured" });
    const auth = await verifyFirebaseRequest(req);
    const uid = auth.uid;
    const email = auth.email || "";

    const body = await req.json().catch(() => ({}));
    const items: ClaimItem[] = Array.isArray(body?.items) ? body.items : [];
    const batchId: string = String(body?.batchId || "");
    const claimMessage: string = String(body?.claimMessage || "");
    const purchaseType: string = String(body?.purchaseType || "normal");
    const displayName: string = String(body?.displayName || "");

    if (!items.length || !batchId) {
      return ok({ success: false, error: "missing items or batchId" });
    }
    // Hard cap to prevent abuse
    const totalQty = items.reduce((s, i) => s + Math.max(0, Math.floor(Number(i.quantity) || 0)), 0);
    if (totalQty <= 0 || totalQty > 200) {
      return ok({ success: false, error: "invalid quantity" });
    }

    const token = await gcpToken();

    // Optionally fetch user display name from Firestore if not provided
    let resolvedName = displayName;
    if (!resolvedName) {
      try {
        const r = await fetch(`${FS_BASE}/users/${uid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const j = await r.json();
          resolvedName = j?.fields?.displayName?.stringValue || email || "";
        }
      } catch { /* ignore */ }
    }

    const groups: Array<{
      productId: string;
      durationId: string;
      productName?: string;
      durationLabel?: string;
      keys: string[];
      claimedIds: string[];
    }> = [];

    for (const item of items) {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (!item.productId || !item.durationId || qty <= 0) continue;

      // Query unclaimed keys for this product/duration, FIFO by createdAt
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: "keys" }],
          where: {
            compositeFilter: {
              op: "AND",
              filters: [
                { fieldFilter: { field: { fieldPath: "productId" }, op: "EQUAL", value: { stringValue: item.productId } } },
                { fieldFilter: { field: { fieldPath: "durationId" }, op: "EQUAL", value: { stringValue: item.durationId } } },
                { fieldFilter: { field: { fieldPath: "claimed" }, op: "EQUAL", value: { booleanValue: false } } },
              ],
            },
          },
          // Fetch extra to tolerate races; we'll commit up to `qty` successfully.
          limit: qty + 5,
        },
      };

      const qr = await fetch(`${FS_BASE}:runQuery`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(queryBody),
      });
      if (!qr.ok) {
        const txt = await qr.text();
        return ok({ success: false, error: `query failed: ${qr.status} ${txt.slice(0, 200)}` });
      }
      const rows: any[] = await qr.json();
      const docs = (Array.isArray(rows) ? rows : [])
        .map((r) => r?.document)
        .filter(Boolean)
        // Sort FIFO by createdAt (seconds) if present
        .sort((a, b) => {
          const at = Number(a?.fields?.createdAt?.timestampValue ? new Date(a.fields.createdAt.timestampValue).getTime() : 0);
          const bt = Number(b?.fields?.createdAt?.timestampValue ? new Date(b.fields.createdAt.timestampValue).getTime() : 0);
          return at - bt;
        });

      const claimedKeys: string[] = [];
      const claimedIds: string[] = [];
      const nowIso = new Date().toISOString();
      const itemPrice = Number(item.price) || 0;
      const claimNote = String(item.claimNote || "");

      for (const d of docs) {
        if (claimedKeys.length >= qty) break;
        const name: string = d.name; // projects/.../documents/keys/<id>
        const docId = name.split("/").pop() || "";
        const updateTime: string = d.updateTime;
        const keyStr: string = d?.fields?.key?.stringValue || "";

        // Build update with precondition on updateTime to avoid double-claim races.
        const writeBody = {
          writes: [
            {
              update: {
                name,
                fields: {
                  claimed: { booleanValue: true },
                  claimedBy: { stringValue: uid },
                  claimedByEmail: { stringValue: email },
                  claimedByName: { stringValue: resolvedName },
                  claimedAt: { timestampValue: nowIso },
                  batchId: { stringValue: batchId },
                  claimMessage: { stringValue: claimMessage },
                  claimNote: { stringValue: claimNote },
                  price: { doubleValue: itemPrice },
                  purchaseType: { stringValue: purchaseType },
                },
              },
              updateMask: {
                fieldPaths: [
                  "claimed", "claimedBy", "claimedByEmail", "claimedByName",
                  "claimedAt", "batchId", "claimMessage", "claimNote",
                  "price", "purchaseType",
                ],
              },
              currentDocument: { updateTime },
            },
          ],
        };

        const cr = await fetch(`${FS_BASE}:commit`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(writeBody),
        });
        if (cr.ok) {
          claimedKeys.push(keyStr);
          claimedIds.push(docId);
        } // else: race lost, skip and try next
      }

      if (claimedKeys.length > 0) {
        groups.push({
          productId: item.productId,
          durationId: item.durationId,
          productName: item.productName,
          durationLabel: item.durationLabel,
          keys: claimedKeys,
          claimedIds,
        });
      }
    }

    return ok({ success: true, groups });
  } catch (e) {
    return authErrorResponse(e);
  }
});
