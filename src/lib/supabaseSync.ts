// Bridges Firebase Auth → Supabase Auth so Storage RLS policies that check
// auth.uid() work. Call syncSupabaseSession() after Firebase login/register.
//
// Storage uploads must be nested under `<supabase-user-id>/...` — use
// getSupabaseUploadPrefix() to obtain the current uid, waiting for the session
// if syncing is still in flight.

import { supabase } from "@/integrations/supabase/client";
import { auth } from "@/lib/firebase";
import { logError } from "@/lib/errorLogger";

let inflight: Promise<string | null> | null = null;
let lastSyncError: string | null = null;


async function waitForFirebaseUser(timeoutMs = 4000) {
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<typeof auth.currentUser>((resolve) => {
    let done = false;
    const unsub = auth.onAuthStateChanged((u) => {
      if (done) return;
      done = true;
      unsub();
      resolve(u);
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      unsub();
      resolve(auth.currentUser);
    }, timeoutMs);
  });
}

async function doSync(): Promise<string | null> {
  const fbUser = await waitForFirebaseUser();
  if (!fbUser) {
    lastSyncError = "ยังไม่ได้เข้าสู่ระบบ (Firebase user null)";
    return null;
  }

  try {
    const idToken = await fbUser.getIdToken();
    const { data, error } = await supabase.functions.invoke("firebase-supabase-sync", {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (error) throw error;
    if (!data?.success || !data?.token_hash) {
      throw new Error(data?.error || "sync failed");
    }
    const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: data.token_hash,
    });
    if (verifyErr) throw verifyErr;
    lastSyncError = null;
    return verifyData.user?.id ?? null;
  } catch (err) {
    lastSyncError = err instanceof Error ? err.message : String(err);
    logError("supabaseSync.doSync", err);
    return null;
  }
}


/** Ensures a Supabase session exists for the current Firebase user. Idempotent. */
export async function syncSupabaseSession(force = false): Promise<string | null> {
  if (!force) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id) return data.session.user.id;
  }
  if (!inflight) {
    inflight = doSync().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Returns the Supabase user id to prefix storage paths with. */
export async function getSupabaseUploadPrefix(): Promise<string> {
  const uid = await syncSupabaseSession();
  if (!uid) throw new Error("Supabase session unavailable — please re-login");
  return uid;
}

export async function clearSupabaseSession() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    logError("supabaseSync.clearSupabaseSession", err);
  }
}
