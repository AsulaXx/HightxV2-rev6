/**
 * Lightweight i18n dictionary for toast / error strings.
 *
 * Why minimal: the project ships with Thai-default UI and English fallbacks
 * scattered across ~50 files. A heavyweight library (react-i18next) would
 * bloat the bundle and require migrating every component at once. Instead
 * this module provides:
 *
 *   1. A single source of truth for the most common toast/error strings.
 *   2. A `t(key, params?)` helper with simple {placeholder} interpolation.
 *   3. Locale switching via `setLocale("en")` (defaults to "th").
 *
 * Migration is progressive — replace literal strings with `t("key")` as you
 * touch each file. Unknown keys fall back to the key itself so it's safe to
 * roll out incrementally.
 */

export type Locale = "th" | "en";

type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = {
  th: {
    "common.loading": "กำลังโหลด...",
    "common.saving": "กำลังบันทึก...",
    "common.saved": "บันทึกสำเร็จ!",
    "common.saveFailed": "บันทึกไม่สำเร็จ",
    "common.error": "เกิดข้อผิดพลาด",
    "common.networkError": "เครือข่ายผิดพลาด ลองใหม่อีกครั้ง",
    "common.confirm": "ยืนยัน",
    "common.cancel": "ยกเลิก",
    "common.delete": "ลบ",
    "common.deleted": "ลบเรียบร้อย",
    "common.copied": "คัดลอกแล้ว",
    "common.notFound": "ไม่พบข้อมูล",
    "common.permissionDenied": "ไม่มีสิทธิ์เข้าใช้งาน",

    "auth.loginRequired": "กรุณาเข้าสู่ระบบก่อน",
    "auth.loginSuccess": "เข้าสู่ระบบสำเร็จ",
    "auth.loginFailed": "เข้าสู่ระบบไม่สำเร็จ",
    "auth.logoutSuccess": "ออกจากระบบแล้ว",
    "auth.signupSuccess": "สมัครสมาชิกสำเร็จ",

    "wallet.insufficient": "เครดิตไม่เพียงพอ",
    "wallet.deducted": "หักเครดิต {amount} บาทแล้ว",
    "wallet.added": "เพิ่มเครดิต {amount} บาทแล้ว",

    "claim.success": "รับคีย์สำเร็จ!",
    "claim.outOfStock": "สินค้าหมดแล้ว",
    "claim.cooldown": "ต้องรออีก {seconds} วินาที",

    "wheel.spinning": "กำลังหมุน...",
    "wheel.tooFast": "หมุนถี่เกินไป รอสักครู่",
    "wheel.maxReached": "ครบจำนวนหมุนสูงสุดแล้ว",
  },
  en: {
    "common.loading": "Loading...",
    "common.saving": "Saving...",
    "common.saved": "Saved!",
    "common.saveFailed": "Save failed",
    "common.error": "Something went wrong",
    "common.networkError": "Network error, please try again",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.deleted": "Deleted",
    "common.copied": "Copied",
    "common.notFound": "Not found",
    "common.permissionDenied": "Permission denied",

    "auth.loginRequired": "Please sign in first",
    "auth.loginSuccess": "Signed in",
    "auth.loginFailed": "Sign-in failed",
    "auth.logoutSuccess": "Signed out",
    "auth.signupSuccess": "Account created",

    "wallet.insufficient": "Insufficient credits",
    "wallet.deducted": "Deducted {amount} credits",
    "wallet.added": "Added {amount} credits",

    "claim.success": "Key claimed!",
    "claim.outOfStock": "Out of stock",
    "claim.cooldown": "Wait {seconds} more seconds",

    "wheel.spinning": "Spinning...",
    "wheel.tooFast": "Spinning too fast — slow down",
    "wheel.maxReached": "Maximum spins reached",
  },
};

const STORAGE_KEY = "lov-locale";

const detectInitialLocale = (): Locale => {
  if (typeof window === "undefined") return "th";
  const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (stored === "th" || stored === "en") return stored;
  return "th";
};

let currentLocale: Locale = detectInitialLocale();
const listeners = new Set<(loc: Locale) => void>();

export const getLocale = (): Locale => currentLocale;

export const setLocale = (loc: Locale) => {
  currentLocale = loc;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, loc);
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((fn) => fn(loc));
};

export const onLocaleChange = (fn: (loc: Locale) => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const interpolate = (template: string, params?: Record<string, string | number>) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_m, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`,
  );
};

/**
 * Translate a key. Falls back to the key itself if missing — making
 * progressive adoption safe.
 */
export const t = (key: string, params?: Record<string, string | number>): string => {
  const dict = dictionaries[currentLocale] || dictionaries.th;
  const template = dict[key] ?? dictionaries.th[key] ?? key;
  return interpolate(template, params);
};

/** Add or override translations at runtime (e.g. tenant overrides). */
export const extendDictionary = (locale: Locale, entries: Dict) => {
  dictionaries[locale] = { ...dictionaries[locale], ...entries };
};
