import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Separate vitest config for Firestore security rules tests.
 * These run against the Firebase Emulator (Node env, no jsdom, no setup file).
 *
 * Usage:
 *   firebase emulators:start --only firestore
 *   npm run test:rules
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/firestore-rules.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
