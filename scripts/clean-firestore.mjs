#!/usr/bin/env node
/**
 * Wipe demo/seed data from Firestore so the tenant starts clean.
 *
 * Deletes ALL documents in these collections:
 *   products, categories, keys, archivedKeys, claimHistory,
 *   walletLedger, walletTransactions, topUpHistory, processedSlips,
 *   boosterOrders, reviews, notifications, linkPages, linkClicks,
 *   wheels, wheelClaims, coupons, announcements, auditLogs,
 *   webhookLogs, errorLogs, ipGeoCache, otpCodes
 *
 * Resets: settings/main, stats/main
 *
 * Preserves: users/*, wallets/* (so you keep your owner login + credit)
 *
 * Usage:
 *   node scripts/clean-firestore.mjs             # dry-run (lists counts)
 *   node scripts/clean-firestore.mjs --yes       # actually delete
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const CONFIRM = process.argv.includes("--yes");

const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(process.cwd(), "service-account.json");
if (!existsSync(saPath)) {
  console.error(`❌  Service account not found at ${saPath}`);
  process.exit(1);
}
const sa = JSON.parse(readFileSync(saPath, "utf8"));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const COLLECTIONS_TO_WIPE = [
  "products", "categories", "keys", "archivedKeys",
  "claimHistory", "walletLedger", "walletTransactions",
  "topUpHistory", "processedSlips", "boosterOrders",
  "reviews", "notifications", "linkPages", "linkClicks",
  "wheels", "wheelClaims", "coupons", "announcements",
  "auditLogs", "webhookLogs", "errorLogs", "ipGeoCache", "otpCodes",
];

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) return 0;
  if (!CONFIRM) return snap.size;
  // Chunk into batches of 400 (Firestore batch limit = 500)
  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(400, docs.length - i);
  }
  return deleted;
}

async function resetSettings() {
  if (!CONFIRM) return;
  await db.doc("settings/main").set(
    {
      brandName: "HightX",
      logoUrl: "",
      theme: "dark",
      announcement: "",
      webhooks: { purchase: "", topup: "", audit: "" },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  await db.doc("stats/main").set(
    {
      totalUsers: 0, totalClaims: 0, totalKeys: 0,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
}

async function main() {
  console.log(`▶  Project: ${sa.project_id}`);
  console.log(CONFIRM ? "▶  Mode: DELETE\n" : "▶  Mode: DRY-RUN (add --yes to actually delete)\n");

  let total = 0;
  for (const c of COLLECTIONS_TO_WIPE) {
    const n = await deleteCollection(c);
    if (n > 0) console.log(`  ${CONFIRM ? "🗑" : "•"} ${c}: ${n}`);
    total += n;
  }
  await resetSettings();

  console.log(`\n${CONFIRM ? "✅ Deleted" : "🔎 Would delete"} ${total} documents.`);
  console.log("👤 Preserved: users/*, wallets/*");
  if (!CONFIRM) console.log("\nRun again with --yes to execute.");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
