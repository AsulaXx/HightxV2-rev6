/**
 * Server-side rate limiter backed by Firestore.
 * Complements client-side `rateLimiter.ts` (which is bypassable via devtools).
 *
 * Doc shape: rateLimits/{uid}_{action}
 *   { count, windowStart (ms), blockedUntil (ms), updatedAt }
 *
 * Uses a Firestore transaction so concurrent requests can't race past the cap.
 * Owner/Admin roles bypass automatically when `bypassRoles` includes their role.
 */
import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import type { UserRole } from "@/contexts/AuthContext";

export interface ServerRateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export const SERVER_RL_CONFIGS: Record<string, ServerRateLimitConfig> = {
  claim_key:      { maxAttempts: 10, windowMs: 60_000,      blockDurationMs: 60_000 },
  topup_submit:   { maxAttempts: 5,  windowMs: 5 * 60_000,  blockDurationMs: 5 * 60_000 },
  wheel_spin:     { maxAttempts: 20, windowMs: 60_000,      blockDurationMs: 30_000 },
  ruzien_claim:   { maxAttempts: 3,  windowMs: 60 * 60_000, blockDurationMs: 60 * 60_000 },
  gift_redeem:    { maxAttempts: 10, windowMs: 60_000,      blockDurationMs: 5 * 60_000 },
};

const BYPASS_ROLES: UserRole[] = ["owner", "admin"];

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export const checkServerRateLimit = async (
  action: keyof typeof SERVER_RL_CONFIGS | string,
  userId: string,
  role?: UserRole,
): Promise<RateLimitResult> => {
  if (role && BYPASS_ROLES.includes(role)) {
    return { allowed: true, retryAfterMs: 0, remaining: Infinity };
  }
  const cfg = SERVER_RL_CONFIGS[action];
  if (!cfg || !userId) return { allowed: true, retryAfterMs: 0, remaining: Infinity };

  const ref = doc(db, "rateLimits", `${userId}_${action}`);
  const now = Date.now();

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? (snap.data() as any) : null;

      if (data?.blockedUntil && data.blockedUntil > now) {
        return { allowed: false, retryAfterMs: data.blockedUntil - now, remaining: 0 };
      }

      const windowStart = data?.windowStart || 0;
      const withinWindow = now - windowStart < cfg.windowMs;
      const count = withinWindow ? (data?.count || 0) : 0;

      if (count >= cfg.maxAttempts) {
        const blockedUntil = now + cfg.blockDurationMs;
        tx.set(ref, { count, windowStart, blockedUntil, updatedAt: serverTimestamp() }, { merge: true });
        return { allowed: false, retryAfterMs: cfg.blockDurationMs, remaining: 0 };
      }

      const nextCount = count + 1;
      tx.set(ref, {
        count: nextCount,
        windowStart: withinWindow ? windowStart : now,
        blockedUntil: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      return { allowed: true, retryAfterMs: 0, remaining: cfg.maxAttempts - nextCount };
    });
  } catch (err) {
    // Fail-open on transient Firestore errors so we don't lock out legit users.
    console.error("serverRateLimit failed, allowing request:", err);
    return { allowed: true, retryAfterMs: 0, remaining: 0 };
  }
};

export const formatRetryMs = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} วินาที`;
  const m = Math.ceil(s / 60);
  if (m < 60) return `${m} นาที`;
  return `${Math.ceil(m / 60)} ชั่วโมง`;
};
