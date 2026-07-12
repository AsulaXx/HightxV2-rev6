// Reliable topUpHistory writer with retry + localStorage fallback queue.
// Ensures that even during transient network / Firestore failures the top-up
// attempt is not silently dropped — fixes the "wallet credited but no history"
// bug reported on the main site.

import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logError } from "@/lib/errorLogger";

const QUEUE_KEY = "topupHistory:pendingQueue:v1";
const MAX_QUEUE = 50;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const readQueue = (): any[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: any[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUE)));
  } catch {
    // ignore quota errors — best effort
  }
};

const enqueue = (payload: any) => {
  const q = readQueue();
  q.push({ ...payload, __queuedAt: Date.now() });
  writeQueue(q);
};

/**
 * Write a topUpHistory doc with retries and a localStorage fallback queue.
 * Never throws — logging must never break the top-up flow itself.
 */
export async function safeAddTopUpHistory(payload: Record<string, any>): Promise<void> {
  const base = { ...payload };
  // Ensure createdAt is always present. serverTimestamp() is preferred, but
  // when the write is retried from the offline queue we fall back to a client
  // Timestamp so the record still shows up in history.
  if (!base.createdAt) base.createdAt = serverTimestamp();

  const attempts = [0, 600, 1800]; // 3 tries: immediate, ~0.6s, ~1.8s
  for (let i = 0; i < attempts.length; i++) {
    if (attempts[i] > 0) await sleep(attempts[i]);
    try {
      await addDoc(collection(db, "topUpHistory"), {
        ...base,
        ...(i > 0 ? { retryAttempt: i } : {}),
      });
      return; // success
    } catch (err) {
      logError(`safeAddTopUpHistory.attempt${i + 1}`, err);
    }
  }

  // All retries failed → persist locally so we can flush later.
  enqueue({
    ...base,
    createdAt: Timestamp.now(),
    fromOfflineQueue: true,
  });
}

/**
 * Flush any queued top-up history records to Firestore.
 * Call this on app start and after successful writes.
 */
export async function flushTopUpHistoryQueue(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: any[] = [];
  for (const item of queue) {
    try {
      // Strip our internal marker before writing
      const { __queuedAt, ...doc } = item;
      void __queuedAt;
      await addDoc(collection(db, "topUpHistory"), doc);
    } catch (err) {
      logError("flushTopUpHistoryQueue", err);
      remaining.push(item);
    }
  }
  writeQueue(remaining);
}
