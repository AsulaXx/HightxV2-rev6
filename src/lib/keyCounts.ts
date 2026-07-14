// Fetch unclaimed-key counts (and sold counts per product) via edge function.
// Uses service account because Firestore rules restrict /keys list-reads to staff only.
import { supabase } from "@/integrations/supabase/client";

export type SiteTotals = { users: number; stock: number; sales: number };

let memCache: {
  ts: number;
  counts: Record<string, number>;
  sold: Record<string, number>;
  totals: SiteTotals;
} | null = null;

async function fetchAll(force?: boolean) {
  if (!force && memCache && Date.now() - memCache.ts < 25_000) return memCache;
  try {
    const { data, error } = await supabase.functions.invoke("get-key-counts", { body: {} });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "get-key-counts failed");
    memCache = {
      ts: Date.now(),
      counts: (data.counts || {}) as Record<string, number>,
      sold: (data.sold || {}) as Record<string, number>,
      totals: (data.totals || { users: 0, stock: 0, sales: 0 }) as SiteTotals,
    };
    return memCache;
  } catch (e) {
    console.error("fetchKeyCounts failed:", e);
    return memCache || { ts: 0, counts: {}, sold: {}, totals: { users: 0, stock: 0, sales: 0 } };
  }
}

export async function fetchKeyCounts(opts?: { force?: boolean }): Promise<Record<string, number>> {
  const r = await fetchAll(opts?.force);
  return r.counts;
}

export async function fetchSoldCounts(opts?: { force?: boolean }): Promise<Record<string, number>> {
  const r = await fetchAll(opts?.force);
  return r.sold;
}

export async function fetchSiteTotals(opts?: { force?: boolean }): Promise<SiteTotals> {
  const r = await fetchAll(opts?.force);
  return r.totals;
}

