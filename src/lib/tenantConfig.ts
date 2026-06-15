/**
 * ===============================================
 * 🏪 Tenant Configuration (ตั้งค่าร้านค้า)
 * ===============================================
 *
 * ไฟล์นี้คือจุดเดียวที่ผู้เช่า/ผู้ซื้อ SRC ต้องแก้ไข
 * เพื่อ Rebrand เว็บไซต์ให้เป็นของตัวเอง
 *
 * ✅ แก้ไขค่าด้านล่างนี้ → รีเฟรช → เว็บเปลี่ยนชื่อทันที
 * ✅ ตั้งค่าเพิ่มเติมได้ที่หน้า Admin → ตั้งค่าเว็บไซต์
 *
 * หมายเหตุ: ค่าบางตัวเป็นแค่ Default (ค่าเริ่มต้น)
 *           สามารถเปลี่ยนผ่านหน้า Admin ได้ทีหลัง
 */

// ========== 🏷️ ข้อมูลร้านค้า ==========
export const TENANT_BRAND = {
  /** ชื่อร้าน/แบรนด์ (แสดงทั่วเว็บ) */
  name: "HightXClient",

  /** สโลแกน / Tagline */
  tagline: "Beyond ur limits",

  /** คำอธิบายสั้นสำหรับ SEO */
  description: "แหล่งรวมคีย์โปรแกรมเสริมเกมระดับพรีเมียม",

  /** ชื่อผู้พัฒนาที่แสดงใน Footer */
  developerName: "HX DEV",

  /** ลิงก์ผู้พัฒนา (ถ้าไม่ต้องการใส่ค่าว่าง "") */
  developerUrl: "",

  /** ข้อความ Footer */
  footerText: "© 2025 HightXClient. All rights reserved.",

  /** ข้อความ Subtitle (แสดงหน้าแรก) */
  subtitle: "Welcome to HightXClient Tools !\n[+] HX ! DEV",
};

// ========== 🌐 โดเมนและ URL ==========
export const TENANT_URLS = {
  /** โดเมนหลักของเว็บไซต์ */
  domain: "hightxclient.com",

  /** URL เต็ม (ใช้สำหรับ SEO, OG tags) */
  siteUrl: "https://hightxclient.com",

  /** Twitter/X handle (ถ้าไม่มีใส่ค่าว่าง "") */
  twitterHandle: "@HightXClient",
};

// ========== 🖼️ รูปภาพเริ่มต้น ==========
export const TENANT_IMAGES = {
  /** OG Image สำหรับแชร์บน Social Media */
  ogImage: "https://img2.pic.in.th/1771383147450_polarre79e5721233d4b7e.jpeg",

  /** Favicon path (ไฟล์ต้องอยู่ใน public/) */
  favicon: "/favicon.png",
};

// ========== 🎨 ธีมเริ่มต้น ==========
export const TENANT_THEME = {
  /** สีหลัก (theme-color สำหรับ mobile browser) - HEX */
  themeColor: "#6366f1",

  /** สีหลัก HSL (สำหรับ CSS variables) */
  primaryHsl: "234 85% 65%",

  /** สีรอง HSL */
  secondaryHsl: "270 60% 55%",

  /** สีเน้น HSL */
  accentHsl: "300 70% 70%",
};

// ========== 🔑 Firebase Config (สำคัญ!) ==========
// ผู้เช่าต้องเปลี่ยนค่านี้เป็นของตัวเอง
// หรือตั้งผ่าน Environment Variables (VITE_FIREBASE_xxx)
export const TENANT_FIREBASE = {
  apiKey: "AIzaSyBV_J5iLhwE8XXa1_ZTk_p9nvmBI_8Y81o",
  authDomain: "hightxclient.firebaseapp.com",
  projectId: "hightxclient",
  storageBucket: "hightxclient.firebasestorage.app",
  messagingSenderId: "186347234458",
  appId: "1:186347234458:web:e0740d2f1c28bab632ab23",
  measurementId: "G-XVW137W5H2",
};

// ========== 📋 Hero Banner Defaults ==========
export const TENANT_HERO = {
  textLines: [`Welcome to ${TENANT_BRAND.name}`, "ระบบจัดการคีย์ครบวงจร"],
  ctaText: "เข้าสู่ระบบ",
  ctaLink: "/login",
};

// ========== 📦 หมวดหมู่เริ่มต้น ==========
export const TENANT_DEFAULT_CATEGORIES = [
  { id: "gaming", name: "Gaming", icon: "🎮", gradient: "from-indigo-500/20 to-purple-500/20" },
  { id: "streaming", name: "Streaming", icon: "📺", gradient: "from-pink-500/20 to-rose-500/20" },
  { id: "license", name: "License", icon: "🔑", gradient: "from-cyan-500/20 to-blue-500/20" },
  { id: "utility", name: "Utility", icon: "🔧", gradient: "from-emerald-500/20 to-teal-500/20" },
];
