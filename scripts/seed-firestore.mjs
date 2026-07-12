#!/usr/bin/env node
/**
 * Seed Firestore with minimum data required to test the app.
 *
 * Usage:
 *   1) Place your Firebase service-account JSON at ./service-account.json
 *      (or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json)
 *   2) node scripts/seed-firestore.mjs <YOUR_UID> [email]
 *
 * <YOUR_UID> = Firebase Auth UID of the account that should become "owner".
 *              Sign up once in the app, then copy the UID from Firebase
 *              Authentication console.
 *
 * Safe to re-run: uses set({ merge: true }).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const uid = process.argv[2];
const email = process.argv[3] || "owner@example.com";
if (!uid) {
  console.error("❌  Missing UID.\n   node scripts/seed-firestore.mjs <FIREBASE_UID> [email]");
  process.exit(1);
}

const saPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(process.cwd(), "service-account.json");
if (!existsSync(saPath)) {
  console.error(`❌  Service account not found at ${saPath}`);
  console.error("   Download from Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}
const sa = JSON.parse(readFileSync(saPath, "utf8"));

initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();
const now = FieldValue.serverTimestamp();

console.log(`▶  Seeding project: ${sa.project_id}`);
console.log(`▶  Owner UID:       ${uid}\n`);

async function main() {
  // 1) Owner user
  await db.doc(`users/${uid}`).set(
    {
      email,
      displayName: "Owner",
      role: "owner",
      credit: 1000,
      createdAt: now,
    },
    { merge: true },
  );
  console.log("✅ users/" + uid);

  // 2) Site settings
  await db.doc("settings/main").set(
    {
      brandName: "HightX Dev",
      logoUrl: "",
      theme: "dark",
      announcement: "🚀 Dev environment ready",
      webhooks: { purchase: "", topup: "", audit: "" },
      updatedAt: now,
    },
    { merge: true },
  );
  console.log("✅ settings/main");

  // 3) Stats
  await db.doc("stats/main").set(
    { totalUsers: 1, totalClaims: 0, totalKeys: 0, updatedAt: now },
    { merge: true },
  );
  console.log("✅ stats/main");

  // 4) Category
  await db.doc("categories/demo").set(
    { name: "Demo Category", order: 1, visible: true, createdAt: now },
    { merge: true },
  );
  console.log("✅ categories/demo");

  // 5) Product with one duration
  await db.doc("products/demo-product").set(
    {
      name: "Demo Product",
      description: "Test product for development",
      categoryId: "demo",
      imageUrl: "",
      visible: true,
      order: 1,
      durations: [
        { id: "1d", label: "1 Day", price: 10, memberPrice: 8, resellerPrice: 5 },
      ],
      createdAt: now,
    },
    { merge: true },
  );
  console.log("✅ products/demo-product");

  // 6) One test key
  const keyRef = db.collection("keys").doc();
  await keyRef.set({
    key: "DEMO-KEY-0001",
    productId: "demo-product",
    durationId: "1d",
    claimed: false,
    createdAt: now,
  });
  console.log("✅ keys/" + keyRef.id);

  // 7) Wallet
  await db.doc(`wallets/${uid}`).set(
    { balance: 1000, updatedAt: now },
    { merge: true },
  );
  console.log("✅ wallets/" + uid);

  console.log("\n🎉 Seed complete. Log in with the seeded UID to access owner features.");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
