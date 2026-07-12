/**
 * ===============================================
 * 🏪 TENANT CONFIG — จุดเดียวที่ต้องกรอก
 * ===============================================
 *
 * ⚠️ ไฟล์นี้คือ "แหล่งความจริงเดียว" ของการตั้งค่าเว็บทั้งหมด
 * แก้เฉพาะที่ไฟล์นี้ที่เดียว → ทุก component จะดึงไปใช้อัตโนมัติ
 *
 * โครงสร้าง:
 *   1. BRAND         — ชื่อ/สโลแกน/ผู้พัฒนา
 *   2. URLS          — โดเมน/ลิงก์ทางการ
 *   3. IMAGES        — favicon / og
 *   4. THEME         — สีหลัก/รอง (HSL)
 *   5. FIREBASE      — Firebase Web SDK config (บังคับ)
 *   6. HERO          — Banner หน้าแรก
 *   7. CATEGORIES    — หมวดหมู่เริ่มต้น
 *   8. BANK          — ข้อมูลบัญชีรับเงิน (default)
 *   9. WEBHOOKS      — Discord webhook URLs (default)
 *  10. SOCIALS       — ลิงก์โซเชียล (default)
 *
 * หมายเหตุ: ค่าใน 8-10 เป็นค่าเริ่มต้น ปรับเปลี่ยนภายหลังได้จากหน้า Admin
 * ค่าใน 1-7 คือค่าที่ใช้ตอน bootstrap ก่อน Firestore settings/main โหลด
 *
 * Environment override: ถ้าตั้ง VITE_FIREBASE_* ใน .env จะทับค่าใน section 5
 */

// ========== 1. BRAND ==========
export const TENANT_BRAND = {
  name: "My Store",
  tagline: "",
  description: "",
  developerName: "",
  developerUrl: "",
  footerText: "",
  subtitle: "",
};

// ========== 2. URLS ==========
export const TENANT_URLS = {
  domain: "",
  siteUrl: "",
  twitterHandle: "",
};

// ========== 3. IMAGES ==========
export const TENANT_IMAGES = {
  ogImage: "",
  favicon: "/favicon.png",
};

// ========== 4. THEME ==========
export const TENANT_THEME = {
  themeColor: "#6366f1",
  primaryHsl: "234 85% 65%",
  secondaryHsl: "270 60% 55%",
  accentHsl: "300 70% 70%",
};

// ========== 5. FIREBASE (บังคับ) ==========
export const TENANT_FIREBASE = {
  apiKey: "AIzaSyCmv1I1cstH04Aj-lLzR1NQzaKfMsKneV4",
  authDomain: "dev-hightx.firebaseapp.com",
  projectId: "dev-hightx",
  storageBucket: "dev-hightx.firebasestorage.app",
  messagingSenderId: "639566342180",
  appId: "1:639566342180:web:c31c4a1b89aa21bc6050b1",
  measurementId: "G-75FMW90FWZ",
};

// ========== 6. HERO ==========
export const TENANT_HERO = {
  textLines: [`Welcome to ${TENANT_BRAND.name || "My Store"}`],
  ctaText: "เข้าสู่ระบบ",
  ctaLink: "/login",
};

// ========== 7. CATEGORIES ==========
export const TENANT_DEFAULT_CATEGORIES = [
  { id: "gaming", name: "Gaming", icon: "🎮", gradient: "from-indigo-500/20 to-purple-500/20" },
  { id: "streaming", name: "Streaming", icon: "📺", gradient: "from-pink-500/20 to-rose-500/20" },
  { id: "license", name: "License", icon: "🔑", gradient: "from-cyan-500/20 to-blue-500/20" },
  { id: "utility", name: "Utility", icon: "🔧", gradient: "from-emerald-500/20 to-teal-500/20" },
];

// ========== 8. BANK (ค่าเริ่มต้น — แก้จาก Admin ได้) ==========
export const TENANT_BANK = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  promptPayId: "",
  trueWalletPhone: "",
};

// ========== 9. WEBHOOKS (Discord — แก้จาก Admin ได้) ==========
export const TENANT_WEBHOOKS = {
  claim: "",
  topup: "",
  admin: "",
  error: "",
  daily: "",
};

// ========== 10. SOCIALS (แก้จาก Admin ได้) ==========
export const TENANT_SOCIALS: { id: string; label: string; url: string; iconUrl: string }[] = [];
