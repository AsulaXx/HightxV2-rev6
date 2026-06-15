/**
 * ===============================================
 * Application Configuration
 * ===============================================
 * 
 * ไฟล์นี้รวม Config ทั้งหมดไว้ที่เดียว
 * - ใช้ Environment Variables (VITE_xxx) เป็นหลัก
 * - มี Fallback สำหรับ Preview / Dev environment
 * - เปลี่ยน environment ได้โดยแก้ .env หรือตั้ง env vars
 * 
 * วิธีใช้งาน:
 * 1. Dev (Lovable Preview): ใช้ fallback อัตโนมัติ
 * 2. Production: ตั้ง VITE_xxx ใน hosting environment
 */

// ========== Helpers ==========
const env = (key: string, fallback: string): string => {
  const value = import.meta.env[key];
  // ป้องกัน placeholder จาก Lovable preview
  if (!value || value === "PLACEHOLDER_VALUE_TO_BE_REPLACED" || value === "") {
    return fallback;
  }
  return value;
};

import { TENANT_BRAND, TENANT_FIREBASE } from "./tenantConfig";

// ========== Firebase Config ==========
// ลำดับ: Environment Variable → tenantConfig.ts (fallback)
export const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY", TENANT_FIREBASE.apiKey),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN", TENANT_FIREBASE.authDomain),
  projectId: env("VITE_FIREBASE_PROJECT_ID", TENANT_FIREBASE.projectId),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET", TENANT_FIREBASE.storageBucket),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID", TENANT_FIREBASE.messagingSenderId),
  appId: env("VITE_FIREBASE_APP_ID", TENANT_FIREBASE.appId),
  measurementId: env("VITE_FIREBASE_MEASUREMENT_ID", TENANT_FIREBASE.measurementId),
};

// ========== App Config ==========
export const appConfig = {
  appName: env("VITE_APP_NAME", TENANT_BRAND.name),
  environment: env("VITE_APP_ENV", "development") as "development" | "production",
  isDev: env("VITE_APP_ENV", "development") === "development",
  isProd: env("VITE_APP_ENV", "development") === "production",
};

// ========== Debug (dev only) ==========
if (appConfig.isDev) {
  console.log(`[Config] Environment: ${appConfig.environment}`);
  console.log(`[Config] Firebase Project: ${firebaseConfig.projectId}`);
}
