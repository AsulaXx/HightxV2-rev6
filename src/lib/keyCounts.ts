// Fetch unclaimed-key counts via edge function (uses service account).
// Needed because Firestore rules restrict /keys list-reads to staff only —
// regular users would otherwise get permission errors and see "out of stock".
import { supabase } from "@/integrations/supabase/client";

let memCache: { ts: number; data: Record<string, number> } | null = null;

export async function fetchKeyCounts(opts?: { force?: boolean }): Promise<Record<string, number>> {
  if (!opts?.force && memCache && Date.now() - memCache.ts < 25_000) return memCache.data;
  try {
    const { data, error } = await supabase.functions.invoke("get-key-counts", { body: {} });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "get-key-counts failed");
    const counts = (data.counts || {}) as Record<string, number>;
    memCache = { ts: Date.now(), data: counts };
    return counts;
  } catch (e) {
    console.error("fetchKeyCounts failed:", e);
    return memCache?.data || {};
  }
}
