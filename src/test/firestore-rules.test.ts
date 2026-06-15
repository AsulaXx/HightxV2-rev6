/**
 * Firestore security rules tests for `wheelClaims` and `walletLedger`.
 *
 * Requires the Firestore emulator running:
 *   firebase emulators:start --only firestore
 * Then:
 *   npm run test:rules
 *
 * The emulator host/port defaults to 127.0.0.1:8080 (override with
 * FIRESTORE_EMULATOR_HOST env var, e.g. "127.0.0.1:8080").
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
} from "firebase/firestore";

const PROJECT_ID = "lovable-rules-test";

const ADMIN_UID = "admin-uid";
const USER_UID = "user-uid";
const OTHER_UID = "other-uid";

let testEnv: RulesTestEnvironment;

async function seedUser(uid: string, role: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users", uid), { role, email: `${uid}@x.test` });
  });
}

async function seedDoc(path: string, data: Record<string, any>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
      host: process.env.FIRESTORE_EMULATOR_HOST?.split(":")[0] ?? "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":")[1] ?? 8080),
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedUser(ADMIN_UID, "admin");
  await seedUser(USER_UID, "user");
  await seedUser(OTHER_UID, "user");
});

describe("wheelClaims rules", () => {
  const claimPath = "wheelClaims/claim-1";
  const claimData = {
    userId: USER_UID,
    prizeLabel: "100 Credits",
    cost: 50,
    createdAt: Date.now(),
  };

  it("owner can read their own claim", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, claimPath)));
  });

  it("other user cannot read someone else's claim", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, claimPath)));
  });

  it("admin can read any claim", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(getDoc(doc(db, claimPath)));
  });

  it("unauthenticated user cannot read", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, claimPath)));
  });

  it("signed-in user can create a claim", async () => {
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertSucceeds(addDoc(collection(db, "wheelClaims"), claimData));
  });

  it("unauthenticated user cannot create", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, "wheelClaims"), claimData));
  });

  it("regular user cannot update or delete a claim", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertFails(updateDoc(doc(db, claimPath), { prizeLabel: "hacked" }));
    await assertFails(deleteDoc(doc(db, claimPath)));
  });

  it("admin can update and delete a claim", async () => {
    await seedDoc(claimPath, claimData);
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, claimPath), { prizeLabel: "fixed" }));
    await assertSucceeds(deleteDoc(doc(db, claimPath)));
  });
});

describe("walletLedger rules", () => {
  const entryPath = "walletLedger/entry-1";
  const entryData = {
    userId: USER_UID,
    type: "topup_bank",
    amount: 100,
    description: "Top-up via bank",
    createdAt: Date.now(),
  };

  it("owner can read their own ledger entry", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertSucceeds(getDoc(doc(db, entryPath)));
  });

  it("other user cannot read someone else's entry", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.authenticatedContext(OTHER_UID).firestore();
    await assertFails(getDoc(doc(db, entryPath)));
  });

  it("admin can read any entry", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(getDoc(doc(db, entryPath)));
  });

  it("unauthenticated user cannot read", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, entryPath)));
  });

  it("signed-in user can create a ledger entry", async () => {
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertSucceeds(addDoc(collection(db, "walletLedger"), entryData));
  });

  it("unauthenticated user cannot create", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, "walletLedger"), entryData));
  });

  it("regular user cannot update or delete a ledger entry", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.authenticatedContext(USER_UID).firestore();
    await assertFails(updateDoc(doc(db, entryPath), { amount: 9999 }));
    await assertFails(deleteDoc(doc(db, entryPath)));
  });

  it("admin can update and delete a ledger entry", async () => {
    await seedDoc(entryPath, entryData);
    const db = testEnv.authenticatedContext(ADMIN_UID).firestore();
    await assertSucceeds(updateDoc(doc(db, entryPath), { amount: 200 }));
    await assertSucceeds(deleteDoc(doc(db, entryPath)));
  });
});
