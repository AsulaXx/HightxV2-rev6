/**
 * Lightweight IP geolocation lookup with multi-tier cache:
 *   1. localStorage (per-device, 7d TTL)
 *   2. Firestore /ipGeoCache/{ip} (shared across all admins, 30d TTL)
 *   3. ipapi.co → ip-api.com fallback
 * Includes 429 cooldown to avoid hammering the upstream API when limited.
 */

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface IpGeo {
  country?: string;      // e.g. "TH"
  countryName?: string;  // e.g. "Thailand"
  region?: string;       // e.g. "Bangkok"
  city?: string;         // e.g. "Bangkok"
  flag?: string;         // emoji flag
  fetchedAt: number;
}

const STORAGE_KEY = "ip_geo_cache_v1";
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days local
const REMOTE_CACHE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days Firestore
const inflight = new Map<string, Promise<IpGeo | null>>();

// Backoff state when upstream returns 429 — pause all lookups for a window
let backoffUntil = 0;
const BACKOFF_MS = 5 * 60 * 1000; // 5 min cool-off


// Simple concurrency limiter — avoid blasting ipapi.co with 100s of parallel requests on first load
const MAX_CONCURRENT = 4;
let active = 0;
const queue: Array<() => void> = [];
const acquire = () => new Promise<void>((resolve) => {
  if (active < MAX_CONCURRENT) { active++; resolve(); }
  else queue.push(() => { active++; resolve(); });
});
const release = () => {
  active--;
  const next = queue.shift();
  if (next) next();
};

const load = (): Record<string, IpGeo> => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
};
const save = (map: Record<string, IpGeo>) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch {}
};

const flagFromCC = (cc?: string): string => {
  if (!cc || cc.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(...cc.toUpperCase().split("").map(c => A + (c.charCodeAt(0) - 65)));
};

const isPublicIp = (ip: string): boolean => {
  if (!ip || ip === "Unknown") return false;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.")) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  return true;
};

export const getCachedIpGeo = (ip: string): IpGeo | null => {
  const map = load();
  const hit = map[ip];
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit;
  return null;
};

// Sanitize IP for Firestore doc id (replace ":" in ipv6, etc.)
const ipDocId = (ip: string) => ip.replace(/[^0-9a-zA-Z.-]/g, "_").slice(0, 60);

const fetchRemoteCache = async (ip: string): Promise<IpGeo | null> => {
  try {
    const snap = await getDoc(doc(db, "ipGeoCache", ipDocId(ip)));
    if (!snap.exists()) return null;
    const data = snap.data() as IpGeo;
    if (!data.fetchedAt || Date.now() - data.fetchedAt > REMOTE_CACHE_MS) return null;
    return data;
  } catch {
    return null;
  }
};

const persistRemoteCache = (ip: string, geo: IpGeo) => {
  // fire and forget
  setDoc(doc(db, "ipGeoCache", ipDocId(ip)), geo, { merge: true }).catch(() => {});
};

export const lookupIpGeo = async (ip: string): Promise<IpGeo | null> => {
  if (!isPublicIp(ip)) return null;
  const cached = getCachedIpGeo(ip);
  if (cached) return cached;
  if (inflight.has(ip)) return inflight.get(ip)!;

  const job = (async (): Promise<IpGeo | null> => {
    // 1) Try Firestore-shared cache (free, shared across admins)
    const remote = await fetchRemoteCache(ip);
    if (remote) {
      const map = load(); map[ip] = remote; save(map);
      return remote;
    }

    // 2) If recently rate-limited, skip upstream
    if (Date.now() < backoffUntil) return null;

    await acquire();
    try {
      // Try ipapi.co
      try {
        const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(4000) });
        if (r.status === 429) {
          backoffUntil = Date.now() + BACKOFF_MS;
        } else if (r.ok) {
          const j = await r.json();
          if (!j.error && j.country_code) {
            const geo: IpGeo = {
              country: j.country_code,
              countryName: j.country_name,
              region: j.region,
              city: j.city,
              flag: flagFromCC(j.country_code),
              fetchedAt: Date.now(),
            };
            const map = load(); map[ip] = geo; save(map);
            persistRemoteCache(ip, geo);
            return geo;
          }
        }
      } catch {}
      // Fallback ip-api.com (45 req/min limit)
      try {
        const r = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city`, { signal: AbortSignal.timeout(4000) });
        if (r.status === 429) {
          backoffUntil = Date.now() + BACKOFF_MS;
        } else if (r.ok) {
          const j = await r.json();
          if (j.status === "success") {
            const geo: IpGeo = {
              country: j.countryCode,
              countryName: j.country,
              region: j.regionName,
              city: j.city,
              flag: flagFromCC(j.countryCode),
              fetchedAt: Date.now(),
            };
            const map = load(); map[ip] = geo; save(map);
            persistRemoteCache(ip, geo);
            return geo;
          }
        }
      } catch {}
      return null;
    } finally {
      release();
    }
  })();
  inflight.set(ip, job);
  try { return await job; } finally { inflight.delete(ip); }
};

export const formatGeoLabel = (g: IpGeo): string => {
  const parts = [g.city, g.region && g.region !== g.city ? g.region : null, g.countryName].filter(Boolean);
  return parts.join(", ");
};

