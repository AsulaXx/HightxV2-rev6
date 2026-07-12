import { db } from "@/lib/firebase";
import { doc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { logError } from "@/lib/errorLogger";

export type LedgerType =
  | "topup_bank"
  | "topup_truewallet"
  | "topup_voucher"
  | "topup_giftcode"
  | "topup_qr"
  | "topup_admin_add"
  | "topup_admin_deduct"
  | "topup_reconcile_approve"
  | "purchase"
  | "wheel_spend"
  | "wheel_prize"
  
  | "refund"
  | "adjust";

export interface LedgerEntry {
  type: LedgerType;
  /** Positive for credit (add money), negative for debit (subtract money). */
  amount: number;
  description: string;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  /** Free-form correlation id (transRef, voucherCode, batchId, etc.). */
  refId?: string;
  /** Optional method label used in dashboards. */
  method?: string;
  /** Any structured data to keep around for forensics. */
  meta?: Record<string, any>;
  /** Actor who initiated (for admin operations). */
  actorId?: string;
  actorName?: string;
  /**
   * If true, atomically reserves `processedSlips/{refId}` inside the same txn,
   * so the same refId can never apply ledger twice (hard guarantee against slip
   * replay across sessions/tabs/race conditions). Throws DUPLICATE_REF if seen.
   */
  requireUniqueRefId?: boolean;
}

export interface LedgerResult {
  balanceBefore: number;
  balanceAfter: number;
  ledgerId: string;
}

/**
 * Atomically updates wallets/{userId}.balance and writes a walletLedger record
 * inside the same Firestore transaction. Returns balance before/after so callers
 * can show clear UI feedback. Throws on failure (do not swallow — caller decides).
 *
 * IMPORTANT: this never reads outside the transaction, so it is safe to call
 * from places where a doc may not yet exist (will create wallet doc on the fly).
 */
export async function applyLedger(entry: LedgerEntry): Promise<LedgerResult> {
  if (!entry.userId) throw new Error("walletLedger: missing userId");
  if (!Number.isFinite(entry.amount)) throw new Error("walletLedger: amount must be a number");

  const walletRef = doc(db, "wallets", entry.userId);
  const ledgerRef = doc(collection(db, "walletLedger"));
  const slipRef = entry.requireUniqueRefId && entry.refId
    ? doc(db, "processedSlips", String(entry.refId).replace(/[\/#?]/g, "_"))
    : null;

  const result = await runTransaction(db, async (tx) => {
    // ── ALL READS first ──
    const snap = await tx.get(walletRef);
    if (slipRef) {
      const slipSnap = await tx.get(slipRef);
      if (slipSnap.exists()) {
        const e: any = new Error("DUPLICATE_REF");
        e.code = "DUPLICATE_REF";
        throw e;
      }
    }

    const currentBalance = snap.exists() ? Number(snap.data()?.balance || 0) : 0;
    const nextBalance = currentBalance + entry.amount;

    // ── WRITES ──
    if (snap.exists()) {
      tx.update(walletRef, {
        balance: nextBalance,
        ...(entry.amount > 0 ? { lastTopUp: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(walletRef, {
        balance: nextBalance,
        userId: entry.userId,
        ...(entry.amount > 0 ? { lastTopUp: serverTimestamp() } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    tx.set(ledgerRef, {
      ...entry,
      balanceBefore: currentBalance,
      balanceAfter: nextBalance,
      createdAt: serverTimestamp(),
    });

    if (slipRef) {
      tx.set(slipRef, {
        userId: entry.userId,
        amount: entry.amount,
        type: entry.type,
        ledgerId: ledgerRef.id,
        createdAt: serverTimestamp(),
      });
    }

    return { balanceBefore: currentBalance, balanceAfter: nextBalance };
  });

  return { ...result, ledgerId: ledgerRef.id };
}

/**
 * Writes a walletLedger record WITHOUT touching the wallet balance. Use when
 * the balance was already updated atomically elsewhere (e.g., inside a Firestore
 * transaction that combines multiple writes) and you only need an audit trail.
 */
export async function recordLedgerOnly(entry: LedgerEntry & { balanceBefore?: number; balanceAfter?: number }): Promise<void> {
  const { addDoc, collection: col, serverTimestamp: ts } = await import("firebase/firestore");
  try {
    await addDoc(col(db, "walletLedger"), {
      ...entry,
      balanceTrackedExternally: true,
      createdAt: ts(),
    });
  } catch (e) {
    logError("recordLedgerOnly", e);
  }
}

/**
 * Defensive history writer with one retry. Use for any non-critical history
 * write (top-up, claim, voucher attempt) so transient Firestore hiccups do not
 * silently lose the record. Never throws — failures are logged.
 */
export async function safeAddHistory(
  collectionName: string,
  payload: Record<string, any>
): Promise<void> {
  const { addDoc, collection: col, serverTimestamp: ts } = await import("firebase/firestore");
  try {
    await addDoc(col(db, collectionName), { ...payload, createdAt: ts() });
  } catch (e) {
    logError(`safeAddHistory.${collectionName}`, e);
    try {
      await new Promise((r) => setTimeout(r, 800));
      await addDoc(col(db, collectionName), { ...payload, createdAt: ts(), retryWrite: true });
    } catch (e2) {
      logError(`safeAddHistory.${collectionName}.retry`, e2);
    }
  }
}

/** Generates a short, sortable-ish unique id used for client-side attempt tracking. */
export function generateAttemptId(prefix: string = "att"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
