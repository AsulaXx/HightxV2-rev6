// Firebase → Supabase Auth bridge.
// Verifies a Firebase ID token, ensures a matching Supabase Auth user exists,
// then returns a one-time magiclink token_hash the frontend can exchange for a
// Supabase session via supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }).
//
// This lets Supabase Storage RLS policies that check auth.uid() work for users
// who signed in via Firebase.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  authErrorResponse,
  corsHeaders,
  verifyFirebaseRequest,
} from "../_shared/firebaseAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const fb = await verifyFirebaseRequest(req);
    if (!fb.email) {
      return new Response(
        JSON.stringify({ success: false, error: "firebase account has no email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Ensure user exists (idempotent create with metadata linking firebase uid).
    // If already exists (422 duplicate), that's fine.
    const createRes = await admin.auth.admin.createUser({
      email: fb.email,
      email_confirm: true,
      user_metadata: { firebase_uid: fb.uid, source: "firebase-sync" },
    });
    if (createRes.error && !/already been registered|already exists/i.test(createRes.error.message)) {
      return new Response(
        JSON.stringify({ success: false, error: createRes.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mint a magiclink and return the hashed token for verifyOtp on the client.
    const linkRes = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: fb.email,
    });
    if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: linkRes.error?.message || "failed to generate link",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: fb.email,
        token_hash: linkRes.data.properties.hashed_token,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return authErrorResponse(err);
  }
});
