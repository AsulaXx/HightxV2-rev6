/**
 * Single source of truth for classifying a key claim by source.
 * Used by Dashboard, Leaderboard, ClaimHistory, AllClaimHistory…
 *
 * Buckets:
 *   - wheel    → won via spin-the-wheel (purchaseType === "wheel")
 *   - free     → free claim (HightXCrew+ proof) or product priced 0 not from wheel
 *   - reseller → bought with reseller pricing
 *   - normal   → bought at regular price
 */

export type ClaimBucket = "wheel" | "free" | "reseller" | "normal";

export interface ClaimLike {
  purchaseType?: string | null;
  price?: number | null;
}

export const classifyClaim = (k: ClaimLike): ClaimBucket => {
  const pt = (k?.purchaseType || "").toLowerCase();
  if (pt === "wheel") return "wheel";
  if (pt === "reseller") return "reseller";
  if (pt === "free") return "free";
  // Legacy fallback: no purchaseType but price 0 → treat as free
  if (!pt && (Number(k?.price) || 0) === 0) return "free";
  return "normal";
};

/** Whether a claim represents real revenue (paid in THB/credit deducted) */
export const isRevenueClaim = (k: ClaimLike): boolean => {
  const b = classifyClaim(k);
  return b === "normal" || b === "reseller";
};

export const BUCKET_LABEL_TH: Record<ClaimBucket, string> = {
  wheel: "วงล้อ",
  free: "ฟรี",
  reseller: "ตัวแทน",
  normal: "ปกติ",
};
