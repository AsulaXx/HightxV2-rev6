import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyIdToken, AuthError } from "../_shared/firebaseAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountStr = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountStr) {
      return new Response(JSON.stringify({ success: false, error: "Firebase service account not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountStr);
    const { uid, newPassword, idToken } = await req.json();

    // Verify caller via Firebase ID token (no longer trusting client-supplied callerUid)
    let callerUid: string;
    try {
      const verified = await verifyIdToken(String(idToken || ""));
      callerUid = verified.uid;
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: `unauthorized: ${(e as AuthError)?.message || e}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!uid || !newPassword) {
      return new Response(JSON.stringify({ success: false, error: "Missing uid or newPassword" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({ success: false, error: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input sanitization
    if (typeof uid !== "string" || uid.length > 128 || typeof newPassword !== "string" || newPassword.length > 128) {
      return new Response(JSON.stringify({ success: false, error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin via Firestore
    const { initializeApp, cert, getApps } = await import("npm:firebase-admin@13/app");
    const { getFirestore } = await import("npm:firebase-admin@13/firestore");

    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    const db = getFirestore();
    const callerDoc = await db.collection("users").doc(callerUid).get();

    if (!callerDoc.exists) {
      return new Response(JSON.stringify({ success: false, error: "Caller user not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerRole = callerDoc.data()?.role;
    if (!["owner", "admin"].includes(callerRole)) {
      return new Response(JSON.stringify({ success: false, error: "Insufficient permissions — admin or owner required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get access token using service account
    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: "https://identitytoolkit.googleapis.com/",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
    }));

    // Import the private key
    const pemContents = serviceAccount.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "");
    const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const jwt = `${header}.${payload}.${signatureB64}`.replace(/\+/g, "-").replace(/\//g, "_");

    // Get access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Failed to get access token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update user password via Identity Toolkit API
    const projectId = serviceAccount.project_id;
    const updateRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localId: uid,
          password: newPassword,
        }),
      }
    );

    const updateData = await updateRes.json();
    if (updateData.error) {
      return new Response(JSON.stringify({ success: false, error: updateData.error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
