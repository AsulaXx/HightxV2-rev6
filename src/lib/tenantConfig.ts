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
 * ⚠️ หมายเหตุสำคัญ:
 *   - ไฟล์นี้ถูกล้างค่าเริ่มต้นทิ้งทั้งหมด เพื่อไม่ให้โปรเจกต์
 *     เผลอไปต่อกับ Firebase / แบรนด์ของเว็บต้นฉบับ
 *   - ต้องกรอกค่าตัวเองทั้งหมดก่อนใช้งาน
 *   - หรือจะตั้งผ่าน `.env` ด้วยตัวแปร VITE_* ก็ได้
 *     (env จะถูกใช้ก่อน ไฟล์นี้คือ fallback)
 */

// ========== 🏷️ ข้อมูลร้านค้า ==========
export const TENANT_BRAND = {
  /** ชื่อร้าน/แบรนด์ (แสดงทั่วเว็บ) */
  name: "My Store",

  /** สโลแกน / Tagline */
  tagline: "",

  /** คำอธิบายสั้นสำหรับ SEO */
  description: "",

  /** ชื่อผู้พัฒนาที่แสดงใน Footer */
  developerName: "",

  /** ลิงก์ผู้พัฒนา (ถ้าไม่ต้องการใส่ค่าว่าง "") */
  developerUrl: "",

  /** ข้อความ Footer */
  footerText: "",

  /** ข้อความ Subtitle (แสดงหน้าแรก) */
  subtitle: "",
};

// ========== 🌐 โดเมนและ URL ==========
export const TENANT_URLS = {
  /** โดเมนหลักของเว็บไซต์ */
  domain: "",

  /** URL เต็ม (ใช้สำหรับ SEO, OG tags) */
  siteUrl: "",

  /** Twitter/X handle (ถ้าไม่มีใส่ค่าว่าง "") */
  twitterHandle: "",
};

// ========== 🖼️ รูปภาพเริ่มต้น ==========
export const TENANT_IMAGES = {
  /** OG Image สำหรับแชร์บน Social Media */
  ogImage: "",

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
// ⚠️ ค่าทั้งหมดเป็นค่าว่าง ต้องกรอกของตัวเอง
//    หรือตั้งผ่าน Environment Variables (VITE_FIREBASE_xxx) ใน .env
//    ถ้าปล่อยว่างไว้แอปจะไม่สามารถ connect Firebase ได้ (ตามตั้งใจ)
export const TENANT_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: "",
};

// ========== 📋 Hero Banner Defaults ==========
export const TENANT_HERO = {
  textLines: [`Welcome to ${TENANT_BRAND.name || "My Store"}`],
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
