// Simple in-memory cache for Firestore queries to reduce reads.
// Cross-tab invalidation via BroadcastChannel: when admin saves config in tab A,
// tabs B/C immediately drop their cached copies.
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const BC_NAME = "lov-firestore-cache";

let bc: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = (ev) => {
      const { type, prefix } = ev.data || {};
      if (type === "invalidate") localInvalidate(prefix);
    };
  }
} catch { /* unsupported — fall back to local-only cache */ }

function localInvalidate(keyPrefix?: string) {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(keyPrefix)) cache.delete(key);
  }
}

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate cache locally AND broadcast to other open tabs/windows so they drop
 * their copies too. Pass a prefix to scope invalidation; omit to clear everything.
 */
export function invalidateCache(keyPrefix?: string): void {
  localInvalidate(keyPrefix);
  try { bc?.postMessage({ type: "invalidate", prefix: keyPrefix }); } catch { /* ignore */ }
}

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL
): Promise<T> {
  const cached = getCached<T>(key, ttl);
  if (cached !== null) return cached;
  const data = await fetcher();
  setCache(key, data);
  return data;
}
