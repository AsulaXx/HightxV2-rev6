import { initializeApp, cert, getApps } from "npm:firebase-admin@13/app";
import { getFirestore, FieldValue } from "npm:firebase-admin@13/firestore";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Authorization ── one of:
    //  - Firebase admin ID token in `idToken` body field
    //  - CRON_SECRET in `x-cron-secret` header (for scheduled jobs)
    //  - Supabase service role key in Authorization header (pg_cron)
    const body = await req.json().catch(() => ({} as any));
    const authHeader = req.headers.get("authorization") || "";
    const cronHeader = req.headers.get("x-cron-secret") || "";
    let authorized = false;

    if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
      authorized = true;
    } else if (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`) {
      authorized = true;
    } else if (body?.idToken) {
      try {
        const { uid } = await verifyIdToken(String(body.idToken));
        // Optional: any signed-in caller may trigger; for stricter use, look up role.
        if (uid) authorized = true;
      } catch (_) { /* fall through */ }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ success: false, error: "unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Firebase Admin
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "Missing FIREBASE_SERVICE_ACCOUNT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);

    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    const db = getFirestore();

    // Calculate 90-day cutoff
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    // Query claimed keys
    const keysRef = db.collection("keys");
    const snapshot = await keysRef.where("claimed", "==", true).get();

    let archiveCount = 0;
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const claimedAt = data.claimedAt;
      if (!claimedAt) continue;

      const claimedSeconds =
        claimedAt._seconds || claimedAt.seconds || 0;
      if (claimedSeconds >= cutoffTimestamp) continue;

      // Add to archivedKeys
      const archiveRef = db.collection("archivedKeys").doc(docSnap.id);
      batch.set(archiveRef, {
        ...data,
        archivedAt: FieldValue.serverTimestamp(),
      });

      // Delete from keys
      batch.delete(docSnap.ref);

      archiveCount++;
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    // Log activity
    if (archiveCount > 0) {
      await db.collection("activityLogs").add({
        action: "auto_archive_keys",
        userId: "system",
        userEmail: "system@auto",
        userName: "ระบบอัตโนมัติ",
        details: `Auto-Archive ${archiveCount} คีย์เก่าเกิน 90 วัน`,
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        archived: archiveCount,
        message: archiveCount > 0
          ? `Archived ${archiveCount} keys older than 90 days`
          : "No keys to archive",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Auto-archive error:", err);
    return new Response(
      JSON.stringify({ error: String(err), success: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
