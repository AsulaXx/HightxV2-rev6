// Client-side rate limiter using localStorage
interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  blockedUntil: number;
}

const getEntry = (key: string): RateLimitEntry => {
  try {
    const raw = localStorage.getItem(`rl_${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { attempts: 0, firstAttempt: 0, blockedUntil: 0 };
};

const setEntry = (key: string, entry: RateLimitEntry) => {
  localStorage.setItem(`rl_${key}`, JSON.stringify(entry));
};

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;      // time window in ms
  blockDurationMs: number; // how long to block after exceeding
}

const CONFIGS: Record<string, RateLimitConfig> = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 },
  key_claim: { maxAttempts: 5, windowMs: 60 * 1000, blockDurationMs: 60 * 1000 },
  topup: { maxAttempts: 3, windowMs: 5 * 60 * 1000, blockDurationMs: 5 * 60 * 1000 },
};

export const checkRateLimit = (action: string, userId?: string): { allowed: boolean; retryAfterMs: number } => {
  const config = CONFIGS[action];
  if (!config) return { allowed: true, retryAfterMs: 0 };

  const key = userId ? `${action}_${userId}` : action;
  const entry = getEntry(key);
  const now = Date.now();

  // Check if currently blocked
  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.blockedUntil - now };
  }

  // Reset if window expired
  if (now - entry.firstAttempt > config.windowMs) {
    setEntry(key, { attempts: 1, firstAttempt: now, blockedUntil: 0 });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Check attempts
  if (entry.attempts >= config.maxAttempts) {
    const blockedUntil = now + config.blockDurationMs;
    setEntry(key, { ...entry, blockedUntil });
    return { allowed: false, retryAfterMs: config.blockDurationMs };
  }

  // Increment
  setEntry(key, { ...entry, attempts: entry.attempts + 1 });
  return { allowed: true, retryAfterMs: 0 };
};

export const resetRateLimit = (action: string, userId?: string) => {
  const key = userId ? `${action}_${userId}` : action;
  localStorage.removeItem(`rl_${key}`);
};

export const formatRetryTime = (ms: number): string => {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} วินาที`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} นาที`;
};
