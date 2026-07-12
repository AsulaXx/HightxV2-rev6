import { useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Copy, ChevronDown, ChevronRight, Flame, Zap, Shield, MessageSquare, Globe, Key, Database, Server, Terminal, Lock, Users, FileCode, HardDrive, Clock, AlertTriangle, CheckCheck, Download, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import PageBreadcrumb from "@/components/PageBreadcrumb";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  details: string[];
  code?: string;
  links?: { label: string; url: string }[];
  envVars?: string[];
  warning?: string;
  indexItems?: { collection: string; fields: string; purpose: string; createUrl: string }[];
}

interface SetupSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  required: boolean;
  description: string;
  steps: SetupStep[];
}

const sections: SetupSection[] = [
  // ===== 1. FIREBASE =====
  {
    id: "firebase",
    title: "Firebase",
    icon: <Flame className="h-5 w-5" />,
    required: true,
    description: "ฐานข้อมูลหลัก (Firestore), ระบบล็อกอิน (Auth) และ Storage",
    steps: [
      {
        id: "fb-1",
        title: "สร้าง Firebase Project",
        description: "สร้าง Project ใหม่ที่ Firebase Console",
        details: [
          "1. เข้า console.firebase.google.com → กด 'Add project'",
          "2. ตั้งชื่อ Project (เช่น my-shop-app)",
          "3. Google Analytics → เปิดหรือปิดก็ได้ (แนะนำเปิด)",
          "4. รอสร้างเสร็จ → กด Continue",
        ],
        links: [{ label: "Firebase Console", url: "https://console.firebase.google.com" }],
      },
      {
        id: "fb-2",
        title: "เปิดใช้ Authentication",
        description: "ตั้งค่าระบบล็อกอินสำหรับผู้ใช้",
        details: [
          "1. เมนูซ้าย → Authentication → Get started",
          "2. แท็บ 'Sign-in method' → เปิด Email/Password",
          "3. (ถ้าต้องการ) เปิด Google Sign-In → ตั้ง Support email",
          "4. แท็บ 'Settings' → Authorized domains → กด 'Add domain'",
          "5. เพิ่มโดเมนทุกตัวที่จะใช้งาน:",
          "   • โดเมนหลัก เช่น myshop.com",
          "   • Lovable Preview: *.lovableproject.com, *.lovable.app",
          "   • Firebase defaults: *.firebaseapp.com, *.web.app",
        ],
        warning: "หากไม่เพิ่ม Authorized domains → Google Sign-In จะใช้งานไม่ได้",
      },
      {
        id: "fb-3",
        title: "สร้าง Cloud Firestore",
        description: "ฐานข้อมูลหลักสำหรับเก็บ settings, users, keys, orders ฯลฯ",
        details: [
          "1. เมนูซ้าย → Firestore Database → Create database",
          "2. เลือก 'Start in production mode' (ปลอดภัยกว่า)",
          "3. เลือก Region → asia-southeast1 (สิงคโปร์) หรือใกล้กลุ่มผู้ใช้",
          "4. กด Create → รอสร้างเสร็จ",
          "5. ไปที่แท็บ Rules → คัดลอกจากไฟล์ firestore.rules ในโปรเจกต์ → กด Publish",
        ],
        warning: "ต้อง Publish Rules ก่อนใช้งาน ไม่งั้นผู้ใช้จะเข้าถึงข้อมูลไม่ได้",
      },
      {
        id: "fb-4",
        title: "เปิดใช้ Firebase Storage",
        description: "สำหรับเก็บรูปสินค้า, สลิป, โลโก้ ฯลฯ",
        details: [
          "1. เมนูซ้าย → Storage → Get started",
          "2. เลือก 'Start in production mode'",
          "3. เลือก Region เดียวกับ Firestore",
          "4. ไปที่ Rules → ใส่ rules อนุญาตเฉพาะ authenticated users:",
        ],
        code: `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`,
      },
      {
        id: "fb-5",
        title: "สร้าง Web App และคัดลอก Config",
        description: "สร้าง Web App เพื่อรับ API Keys สำหรับใส่ในไฟล์ .env",
        details: [
          "1. Project Settings (ไอคอนเฟือง) → General",
          "2. เลื่อนลง → 'Your apps' → กด Add app → เลือก Web (</>)",
          "3. ตั้งชื่อ App (เช่น my-shop-web) → กด Register app",
          "4. จะเห็น firebaseConfig object → คัดลอกค่าทั้งหมด:",
        ],
        envVars: [
          "VITE_FIREBASE_API_KEY=AIzaSy...",
          "VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com",
          "VITE_FIREBASE_PROJECT_ID=your-project",
          "VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app",
          "VITE_FIREBASE_MESSAGING_SENDER_ID=123456789",
          "VITE_FIREBASE_APP_ID=1:123456789:web:abc123",
        ],
      },
      {
        id: "fb-6",
        title: "สร้าง Service Account JSON",
        description: "ใช้กับ Edge Functions (verify-slip, auto-archive) ที่ต้องเข้าถึง Firestore จากฝั่ง Server",
        details: [
          "1. Project Settings → แท็บ 'Service accounts'",
          "2. กด 'Generate new private key' → ดาวน์โหลดไฟล์ JSON",
          "3. เปิดไฟล์ JSON → คัดลอกเนื้อหาทั้งหมด",
          "4. นำไปตั้งเป็น Secret ใน Supabase (ขั้นตอนถัดไป)",
        ],
        warning: "ห้ามเผยแพร่ไฟล์ Service Account JSON เด็ดขาด! มันให้สิทธิ์เข้าถึงทุกอย่างใน Firebase",
      },
      {
        id: "fb-7",
        title: "สร้าง Firestore Composite Indexes (สำคัญมาก!)",
        description: "Firestore ต้องสร้าง Composite Index สำหรับ Query ที่ใช้หลาย field — ถ้าไม่สร้างระบบจะ Error",
        details: [
          "ไปที่ Firebase Console → Firestore Database → แท็บ 'Indexes' → Composite",
          "กด 'Create index' → สร้างทีละตัวตามรายการด้านล่าง:",
          "",
          "📌 Index ที่ 1 — ค้นหาคีย์ตามสินค้า (หน้าร้านค้า/สินค้า)",
          "  Collection: keys",
          "  Fields:",
          "    • productId — Ascending",
          "    • claimed — Ascending",
          "  Query scope: Collection",
          "",
          "📌 Index ที่ 2 — ค้นหาคีย์ที่ผู้ใช้กดรับ (ประวัติของฉัน)",
          "  Collection: keys",
          "  Fields:",
          "    • claimed — Ascending",
          "    • claimedBy — Ascending",
          "  Query scope: Collection",
          "",
          "📌 Index ที่ 3 — ประวัติเติมเงิน ของผู้ใช้เรียงตามวันที่",
          "  Collection: topUpHistory",
          "  Fields:",
          "    • userId — Ascending",
          "    • createdAt — Descending",
          "  Query scope: Collection",
          "",
          "📌 Index ที่ 4 — ธุรกรรมกระเป๋าเงิน ของผู้ใช้เรียงตามวันที่",
          "  Collection: walletTransactions",
          "  Fields:",
          "    • userId — Ascending",
          "    • createdAt — Descending",
          "  Query scope: Collection",
          "",
          "📌 Index ที่ 5 — ประวัติสั่งซื้อ Booster ของผู้ใช้",
          "  Collection: boosterOrders",
          "  Fields:",
          "    • userId — Ascending",
          "    • createdAt — Descending",
          "  Query scope: Collection",
          "",
          "📌 Index ที่ 6 — ประวัติการกดรับคีย์ ของผู้ใช้",
          "  Collection: claimHistory",
          "  Fields:",
          "    • userId — Ascending",
          "    • claimedAt — Descending",
          "  Query scope: Collection",
        ],
        code: `// ไฟล์ firestore.indexes.json — สามารถ Deploy ผ่าน Firebase CLI ได้
{
  "indexes": [
    {
      "collectionGroup": "keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "productId", "order": "ASCENDING" },
        { "fieldPath": "claimed", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "keys",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "claimed", "order": "ASCENDING" },
        { "fieldPath": "claimedBy", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "topUpHistory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "walletTransactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "boosterOrders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "claimHistory",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "claimedAt", "order": "DESCENDING" }
      ]
    }
  ]
}`,
        warning: "ถ้าไม่สร้าง Indexes → Query ที่ใช้หลาย field จะ Error 'requires an index' ทันที! Index ใช้เวลาสร้าง 1-5 นาที — ⚠️ ลิงก์ด้านล่างเป็นของ Project 'hightxclient' ถ้าใช้ Project อื่นให้เปลี่ยนชื่อ Project ใน URL",
        links: [
          { label: "🔗 เปิดหน้า Indexes ใน Console", url: "https://console.firebase.google.com/project/hightxclient/firestore/indexes" },
          { label: "📖 Firebase Indexes Docs", url: "https://firebase.google.com/docs/firestore/query-data/indexing" },
        ],
        indexItems: [
          { collection: "keys", fields: "productId ↑, claimed ↑", purpose: "ค้นหาคีย์ตามสินค้า", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=Cklwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2tleXMvaW5kZXhlcy9fEAEaDQoJcHJvZHVjdElkEAEaCwoHY2xhaW1lZBABGgwKCF9fbmFtZV9fEAE" },
          { collection: "keys", fields: "claimed ↑, claimedBy ↑", purpose: "คีย์ที่ผู้ใช้กดรับ", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=Cklwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2tleXMvaW5kZXhlcy9fEAEaCwoHY2xhaW1lZBABGg0KCWNsYWltZWRCeRABGgwKCF9fbmFtZV9fEAE" },
          { collection: "topUpHistory", fields: "userId ↑, createdAt ↓", purpose: "ประวัติเติมเงินเรียงวันที่", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=ClFwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3RvcFVwSGlzdG9yeS9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC" },
          { collection: "walletTransactions", fields: "userId ↑, createdAt ↓", purpose: "ธุรกรรมกระเป๋าเงิน", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=Cldwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3dhbGxldFRyYW5zYWN0aW9ucy9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljcmVhdGVkQXQQAhoMCghfX25hbWVfXxAC" },
          { collection: "boosterOrders", fields: "userId ↑, createdAt ↓", purpose: "ประวัติสั่งซื้อ Booster", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=ClJwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2Jvb3N0ZXJPcmRlcnMvaW5kZXhlcy9fEAEaCgoGdXNlcklkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg" },
          { collection: "claimHistory", fields: "userId ↑, claimedAt ↓", purpose: "ประวัติกดรับคีย์", createUrl: "https://console.firebase.google.com/v1/r/project/hightxclient/firestore/indexes?create_composite=ClFwcm9qZWN0cy9oaWdodHhjbGllbnQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2NsYWltSGlzdG9yeS9pbmRleGVzL18QARoKCgZ1c2VySWQQARoNCgljbGFpbWVkQXQQAhoMCghfX25hbWVfXxAC" },
        ],
      },
    ],
  },

  // ===== 2. SUPABASE =====
  {
    id: "supabase",
    title: "Supabase (Edge Functions & Cron)",
    icon: <Zap className="h-5 w-5" />,
    required: true,
    description: "รัน Edge Functions สำหรับตรวจสลิป, แลกซอง, Archive คีย์ และ Cron Job อัตโนมัติ",
    steps: [
      {
        id: "sb-1",
        title: "สร้าง Supabase Project",
        description: "สร้าง Project ที่ Supabase Dashboard หรือใช้ Lovable Cloud",
        details: [
          "วิธีที่ 1 — ใช้ Lovable Cloud (แนะนำ):",
          "  • เปิด Lovable → Settings → Cloud → เปิดใช้ Lovable Cloud",
          "  • ระบบจะสร้าง Supabase Project ให้อัตโนมัติ",
          "  • ค่า VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY จะถูกตั้งให้",
          "",
          "วิธีที่ 2 — สร้างเองที่ Supabase:",
          "  • เข้า supabase.com → สร้าง Project ใหม่",
          "  • เลือก Region ใกล้กลุ่มผู้ใช้",
          "  • จดค่า Project URL และ Anon Key ไว้",
        ],
        links: [
          { label: "Supabase Dashboard", url: "https://supabase.com/dashboard" },
          { label: "Lovable Cloud Docs", url: "https://docs.lovable.dev/features/cloud" },
        ],
      },
      {
        id: "sb-2",
        title: "ตั้งค่า Secrets (สำคัญมาก!)",
        description: "เพิ่ม Secret Keys ที่ Edge Functions ต้องใช้",
        details: [
          "ไปที่ Supabase Dashboard → Project Settings → Edge Functions → Secrets",
          "หรือ Lovable → Settings → Secrets",
          "",
          "เพิ่ม Secrets ดังนี้:",
          "",
          "1. FIREBASE_SERVICE_ACCOUNT",
          "   • ค่า: เนื้อหา JSON ทั้งหมดจากไฟล์ Service Account (ขั้นตอน fb-6)",
          "   • ใช้โดย: verify-slip, auto-archive-keys",
          "",
          "2. THUNDER_API_KEY",
          "   • ค่า: API Key จาก thunder.byshield.com",
          "   • ใช้โดย: verify-slip, thunder-info",
          "   • หมายเหตุ: สามารถตั้งในหน้า Admin แทนได้ (จะ override ค่านี้)",
        ],
        warning: "ถ้าไม่ตั้ง FIREBASE_SERVICE_ACCOUNT → Edge Functions ทั้งหมดจะทำงานไม่ได้!",
      },
      {
        id: "sb-3",
        title: "เปิด Extensions: pg_cron & pg_net",
        description: "จำเป็นสำหรับ Cron Job อัตโนมัติ (เช่น Auto-Archive คีย์เก่า)",
        details: [
          "1. ไปที่ Supabase Dashboard → Database → Extensions",
          "2. ค้นหา 'pg_cron' → กดเปิดใช้",
          "3. ค้นหา 'pg_net' → กดเปิดใช้",
          "",
          "หรือรัน SQL:",
        ],
        code: `CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;`,
      },
      {
        id: "sb-4",
        title: "สร้าง Cron Job: Auto-Archive Keys",
        description: "ตั้งเวลาให้ Edge Function ย้ายคีย์เก่าเกิน 90 วันไป Archive อัตโนมัติ ทุกเที่ยงคืน",
        details: [
          "ไปที่ Supabase Dashboard → SQL Editor → รัน SQL ด้านล่าง",
          "แก้ไข YOUR_PROJECT_REF เป็น Supabase Project Ref ของคุณ",
          "แก้ไข YOUR_ANON_KEY เป็น Supabase Anon Key ของคุณ",
        ],
        code: `SELECT cron.schedule(
  'auto-archive-keys-daily',
  '0 0 * * *',  -- ทุกเที่ยงคืน
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-archive-keys',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);`,
        warning: "อย่าลืมเปลี่ยน YOUR_PROJECT_REF และ YOUR_ANON_KEY เป็นค่าจริง!",
      },
      {
        id: "sb-5",
        title: "สร้าง Storage Bucket: music (ถ้าต้องการ)",
        description: "Bucket สำหรับเก็บไฟล์เพลง Background Music",
        details: [
          "1. Supabase Dashboard → Storage → กด 'New bucket'",
          "2. ตั้งชื่อ 'music'",
          "3. เลือก 'Public bucket' (เพื่อให้เล่นเพลงได้โดยไม่ต้อง Auth)",
          "4. กด Create",
          "",
          "หมายเหตุ: ข้ามขั้นตอนนี้ได้ถ้าไม่ใช้ฟีเจอร์เพลงพื้นหลัง",
        ],
      },
      {
        id: "sb-6",
        title: "Deploy Edge Functions",
        description: "Edge Functions ที่ต้อง Deploy มี 4 ตัว",
        details: [
          "ถ้าใช้ Lovable Cloud → Edge Functions จะ Deploy ให้อัตโนมัติ",
          "",
          "ถ้า Self-host → ต้อง Deploy ด้วย Supabase CLI:",
          "",
          "Edge Functions ในโปรเจกต์:",
          "  1. verify-slip — ตรวจสลิปธนาคาร/TrueWallet ผ่าน Thunder API",
          "  2. redeem-truewallet — แลกซองของขวัญ TrueWallet",
          "  3. thunder-info — ดึงข้อมูลโควต้า Thunder API",
          "  4. auto-archive-keys — ย้ายคีย์เก่าเกิน 90 วัน (Cron)",
        ],
        code: `# Deploy ทั้งหมดด้วย Supabase CLI
supabase functions deploy verify-slip
supabase functions deploy redeem-truewallet
supabase functions deploy thunder-info
supabase functions deploy auto-archive-keys`,
      },
    ],
  },

  // ===== 3. THUNDER API =====
  {
    id: "thunder",
    title: "Thunder API (ByShield)",
    icon: <Shield className="h-5 w-5" />,
    required: true,
    description: "ระบบตรวจสอบสลิปธนาคารและ TrueWallet อัตโนมัติ (ใช้กับ API v2)",
    steps: [
      {
        id: "th-1",
        title: "สมัครและซื้อโควต้า",
        description: "สมัครสมาชิกที่ Thunder API (ByShield)",
        details: [
          "1. เข้า thunder.byshield.com → สมัครสมาชิก",
          "2. ซื้อโควต้าตรวจสลิป (ดูราคาหน้าเว็บ)",
          "3. ไปที่ Dashboard → คัดลอก API Key",
          "",
          "API ที่ระบบใช้:",
          "  • POST /v2/verify/bank — ตรวจสลิปธนาคาร",
          "  • POST /v2/verify/truewallet — ตรวจสลิป TrueWallet",
          "  • GET /v2/info — ดึงข้อมูลโควต้าคงเหลือ",
        ],
        links: [{ label: "Thunder API (ByShield)", url: "https://thunder.byshield.com" }],
      },
      {
        id: "th-2",
        title: "ตั้งค่า API Key (เลือก 1 วิธี)",
        description: "มี 2 วิธีในการตั้งค่า โดยระบบจะใช้หน้า Admin ก่อน",
        details: [
          "วิธีที่ 1 — ตั้งในหน้า Admin (แนะนำ เปลี่ยนง่าย):",
          "  • ล็อกอินเป็น Owner → หน้า Admin → แท็บ 'ตั้งค่าระบบ'",
          "  • ใส่ API Key ในช่อง 'Thunder API Key'",
          "",
          "วิธีที่ 2 — ตั้งเป็น Supabase Secret:",
          "  • Supabase Dashboard → Project Settings → Secrets",
          "  • เพิ่ม THUNDER_API_KEY = ค่า API Key",
          "",
          "ลำดับความสำคัญ: Admin Settings > Supabase Secret",
          "ถ้าตั้งทั้ง 2 ที่ → ระบบจะใช้ค่าจากหน้า Admin",
        ],
      },
      {
        id: "th-3",
        title: "ตั้งค่าการตรวจสลิปให้ตรงกับบัญชี",
        description: "กำหนดเลขบัญชีที่ต้องตรงกับสลิป เพื่อป้องกันสลิปที่โอนไปบัญชีอื่น",
        details: [
          "ระบบใช้ matchAccount เพื่อตรวจสอบว่าปลายทางตรงกับบัญชีร้าน",
          "ตั้งค่าได้ที่หน้า Admin → ข้อมูลบัญชีธนาคาร",
          "",
          "ตัวอย่างการทำงาน:",
          "  • สลิปโอนไป XXX-X-X1234-X → ระบบจะเช็คกับเลขที่ตั้งไว้",
          "  • ตรงกัน → เติมเงินอัตโนมัติ",
          "  • ไม่ตรง → ปฏิเสธ + แจ้งเตือน",
        ],
      },
      {
        id: "th-4",
        title: "ใช้ API Key เดียวกันกับ Discord Bot",
        description: "สำหรับผู้ที่มีระบบเช็คสลิปทั้งในเว็บและ Discord Bot",
        details: [
          "✅ ใช้ API Key ตัวเดียวกันได้!",
          "ข้อดี: โควต้าใช้ร่วมกัน + checkDuplicate ป้องกันข้ามช่องทาง",
          "",
          "วิธีป้องกันสลิปซ้ำข้ามช่องทาง:",
          "  • ทั้งเว็บและบอทส่ง checkDuplicate=true",
          "  • Thunder API จะบันทึก Transaction Reference ไว้",
          "  • ถ้าสลิปเดียวกันถูกส่งมาซ้ำ → API จะตอบว่า duplicate",
          "",
          "ความแตกต่าง:",
          "  • เว็บ: เช็คสลิป + เช็คเลขบัญชี + เติมเงินอัตโนมัติ",
          "  • บอท: เช็คสลิปจริง/ปลอมเท่านั้น (ไม่เติมเงิน)",
        ],
      },
    ],
  },

  // ===== 4. DISCORD WEBHOOKS =====
  {
    id: "discord",
    title: "Discord Webhooks",
    icon: <MessageSquare className="h-5 w-5" />,
    required: false,
    description: "แจ้งเตือนอัตโนมัติผ่าน Discord (ไม่บังคับแต่แนะนำ)",
    steps: [
      {
        id: "dc-1",
        title: "สร้าง Webhook URLs",
        description: "สร้าง Webhook ใน Discord Server",
        details: [
          "1. เปิด Discord → Server Settings → Integrations → Webhooks",
          "2. กด 'New Webhook'",
          "3. ตั้งชื่อ (เช่น 'Shop Notifications')",
          "4. เลือก Channel ที่ต้องการให้แจ้งเตือน",
          "5. กด 'Copy Webhook URL'",
          "",
          "แนะนำ: สร้างหลาย Webhook แยกตามประเภท:",
          "  • #การเติมเงิน → Webhook สำหรับ Top Up",
          "  • #การซื้อ → Webhook สำหรับ Purchase",
          "  • #แจ้งเตือน → Webhook สำหรับ Low Stock, สลิป",
        ],
      },
      {
        id: "dc-2",
        title: "ตั้งค่า Webhook ในหน้า Admin",
        description: "ใส่ Webhook URLs ในระบบ (7 ช่อง)",
        details: [
          "ล็อกอินเป็น Owner → หน้า Admin → แท็บ 'ตั้งค่าระบบ'",
          "",
          "ช่อง Webhook ทั้งหมด:",
          "  1. Webhook หลัก — แจ้งเตือนทั่วไป (fallback)",
          "  2. Webhook กดคีย์ — แจ้งเมื่อมีคนกดรับคีย์",
          "  3. Webhook เติมเงิน — แจ้งเมื่อเติมเงินสำเร็จ",
          "  4. Webhook ซื้อสินค้า — แจ้งเมื่อซื้อด้วยเครดิต",
          "  5. Webhook สต็อกต่ำ — แจ้งเมื่อสต็อกต่ำกว่าเกณฑ์",
          "  6. Webhook สรุปรายวัน — สรุปยอดขายประจำวัน",
          "  7. Webhook ตรวจสลิป — แจ้งผลการตรวจสลิปทุกครั้ง",
          "  8. Webhook ลิ้งค์รวม — แจ้งเมื่อสร้าง/แก้ไขหน้าลิ้งค์",
          "",
          "กดปุ่ม 'ทดสอบ' ข้างแต่ละช่องเพื่อทดสอบว่า Webhook ทำงาน",
        ],
      },
    ],
  },


  // ===== 6. DEPLOY =====
  {
    id: "deploy",
    title: "Deploy & เริ่มใช้งาน",
    icon: <Globe className="h-5 w-5" />,
    required: true,
    description: "ขั้นตอนสุดท้ายก่อนเปิดใช้งานจริง",
    steps: [
      {
        id: "dp-1",
        title: "ตั้งค่า Environment Variables",
        description: "คัดลอก .env.example เป็น .env แล้วใส่ค่าจริง",
        details: [
          "1. คัดลอกไฟล์: cp .env.example .env",
          "2. เปิดไฟล์ .env แล้วใส่ค่า Firebase Config ทั้งหมด",
          "3. ตั้ง VITE_APP_ENV=production",
          "4. ตรวจสอบว่าไม่มีช่องว่างหรือค่าผิดพลาด",
        ],
        code: `# ตัวอย่าง .env ที่ครบถ้วน
VITE_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project
VITE_FIREBASE_STORAGE_BUCKET=my-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=186347234458
VITE_FIREBASE_APP_ID=1:186347234458:web:abc123def456
VITE_APP_NAME=MyShop
VITE_APP_ENV=production`,
      },
      {
        id: "dp-2",
        title: "อัปโหลด Firestore Rules",
        description: "คัดลอก Security Rules ไปวางที่ Firebase Console",
        details: [
          "1. เปิดไฟล์ firestore.rules ในโปรเจกต์",
          "2. คัดลอกเนื้อหาทั้งหมด",
          "3. ไปที่ Firebase Console → Firestore → Rules",
          "4. วางทับ Rules เดิม → กด Publish",
          "",
          "หรือใช้ Firebase CLI:",
          "  firebase deploy --only firestore:rules",
          "",
          "Rules ครอบคลุม Collections ทั้งหมด:",
          "  • settings — read: ทุกคน | write: Owner เท่านั้น",
          "  • users — read: ทุกคน | create: เจ้าของ | update: เจ้าของ+Admin | delete: Admin",
          "  • keys — read: ทุกคน | update: ทุกยศ (เฉพาะคีย์ว่าง) | create/delete: Moderator+",
          "  • announcements — read: ทุกคน | write: Admin+",
          "  • activityLogs — read: Admin | create: ผู้ล็อกอิน | delete: Admin",
          "  • claimHistory — read: เจ้าของ+Staff | create: ผู้ล็อกอิน",
          "  • archivedKeys — read/create/delete: Admin เท่านั้น",
          "  • linkPages — read: published=true หรือล็อกอิน | create: hightxcrew+ | update/delete: เจ้าของ+Owner",
          "  • linkClicks — read: ล็อกอิน | create: ทุกคน",
          "  • wallets — read/write: เจ้าของ+Admin",
          "  • topUpHistory — read: เจ้าของ+Admin | create: ผู้ล็อกอิน",
          "  • walletTransactions — read: เจ้าของ+Admin | create: ผู้ล็อกอิน",
          "  • slipVerifyLogs — read: Admin | create: ผู้ล็อกอิน",
          "  • stats — read: ทุกคน | write: Staff+ (hightxcrew ขึ้นไป)",
          "  • otpCodes — read/write/delete: เจ้าของเท่านั้น",
          "  • boosterOrders — read: เจ้าของ+Admin | create: เจ้าของ | update: เจ้าของ+Admin (จำกัดเฉพาะ field สถานะ)",
        ],
        code: `rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ========== Helper Functions ==========
    function isSignedIn() { return request.auth != null; }
    function getUserRole() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role; }
    function isOwner() { return isSignedIn() && getUserRole() == 'owner'; }
    function isAdmin() { return isSignedIn() && getUserRole() in ['owner', 'admin']; }
    function isModerator() { return isSignedIn() && getUserRole() in ['owner', 'admin', 'moderator']; }
    function isStaff() { return isSignedIn() && getUserRole() in ['owner', 'admin', 'moderator', 'hightxcrew']; }

    // ========== Settings ==========
    match /settings/{docId} {
      allow read: if true;
      allow write: if isOwner();
    }

    // ========== Users ==========
    match /users/{userId} {
      allow read: if true;
      allow create: if isSignedIn() && request.auth.uid == userId;
      allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }

    // ========== Keys ==========
    match /keys/{keyId} {
      allow read: if true;
      allow update: if isSignedIn()
        && getUserRole() in ['member','vip','user','reseller','hightxcrew','moderator','admin','owner']
        && resource.data.claimed == false;
      allow create, delete: if isSignedIn()
        && getUserRole() in ['moderator', 'admin', 'owner'];
    }

    // ========== Announcements ==========
    match /announcements/{annId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    // ========== Activity Logs ==========
    match /activityLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
      allow delete: if isAdmin();
    }

    // ========== Claim History ==========
    match /claimHistory/{claimId} {
      allow read: if isSignedIn()
        && (resource.data.userId == request.auth.uid || isStaff());
      allow create: if isSignedIn();
    }

    // ========== Archived Keys ==========
    match /archivedKeys/{keyId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow delete: if isAdmin();
    }

    // ========== Link Pages ==========
    match /linkPages/{pageId} {
      allow read: if resource.data.published == true;
      allow read: if isSignedIn();
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['clickCounts', 'totalClicks']);
      allow create: if isSignedIn()
        && getUserRole() in ['owner','admin','moderator','hightxcrew']
        && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if isSignedIn()
        && (resource.data.ownerId == request.auth.uid || getUserRole() == 'owner');
    }

    // ========== Link Clicks ==========
    match /linkClicks/{clickId} {
      allow read: if isSignedIn();
      allow create: if true;
    }

    // ========== Wallets ==========
    match /wallets/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create, update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
    }

    // ========== Top-Up History ==========
    match /topUpHistory/{docId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn();
    }

    // ========== Wallet Transactions ==========
    match /walletTransactions/{docId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn();
    }

    // ========== Slip Verify Logs ==========
    match /slipVerifyLogs/{logId} {
      allow read: if isAdmin();
      allow create: if isSignedIn();
    }

    // ========== Stats ==========
    match /stats/{docId} {
      allow read: if true;
      allow write: if isStaff();
    }

    // ========== OTP Codes ==========
    match /otpCodes/{userId} {
      allow read: if isSignedIn() && request.auth.uid == userId;
      allow create, update: if isSignedIn() && request.auth.uid == userId;
      allow delete: if isSignedIn() && request.auth.uid == userId;
    }

    // ========== Booster Orders ==========
    match /boosterOrders/{orderId} {
      allow read: if isSignedIn() && (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update: if isSignedIn()
        && (resource.data.userId == request.auth.uid || isAdmin())
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['status','lastCheckedAt','startCount','remains','charge']);
    }
  }
}`,
        warning: "ถ้าไม่อัป Rules → ผู้ใช้ทั่วไปจะเขียน/อ่านข้อมูลไม่ได้ | Rules นี้เป็นเวอร์ชันล่าสุดที่รวม boosterOrders + claimHistory จำกัด read + stats จำกัด write",
      },
      {
        id: "dp-3",
        title: "สร้างบัญชี Admin แรก (Owner)",
        description: "สมัครสมาชิกแล้วตั้งยศ Owner ผ่าน Firestore Console",
        details: [
          "1. เปิดเว็บ → สมัครสมาชิกด้วยอีเมลหลัก",
          "2. ยืนยันอีเมล (ถ้าเปิด Email Verification)",
          "3. เข้า Firebase Console → Firestore Database",
          "4. เปิด Collection 'users' → หาเอกสารของอีเมลที่เพิ่งสมัคร",
          "5. แก้ไข field 'role' เป็น 'owner'",
          "6. ล็อกอินใหม่ → จะเข้าถึงหน้า Admin ได้",
        ],
        warning: "ต้องตั้งยศ Owner ผ่าน Firestore Console โดยตรง เพราะยังไม่มี Admin ที่จะตั้งให้ได้",
      },
      {
        id: "dp-4",
        title: "ตั้งค่าเบื้องต้นในหน้า Admin",
        description: "ตั้งค่าร้านค้าหลังล็อกอินเป็น Owner",
        details: [
          "เข้าหน้า Admin แล้วตั้งค่าตามลำดับ:",
          "",
          "1. ตั้งค่าทั่วไป:",
          "   • ชื่อร้าน, โลโก้, Favicon",
          "   • ข้อมูลบัญชีธนาคาร (สำหรับเติมเงินผ่านสลิป)",
          "   • เบอร์ TrueWallet (สำหรับรับซองของขวัญ)",
          "",
          "2. สร้างหมวดหมู่สินค้า:",
          "   • แท็บ 'หมวดหมู่' → เพิ่มหมวด เช่น Gaming, Streaming",
          "",
          "3. สร้างสินค้า:",
          "   • แท็บ 'สินค้า' → เพิ่มสินค้า + ระยะเวลา + ราคา",
          "",
          "4. เพิ่มคีย์:",
          "   • ไปที่หน้า Key Management → เพิ่มคีย์ทีละตัว/นำเข้า",
        ],
      },
      {
        id: "dp-5",
        title: "ทดสอบระบบทั้งหมด",
        description: "Checklist สำหรับทดสอบก่อนเปิดใช้จริง",
        details: [
          "☐ สมัครสมาชิก / ล็อกอิน / Google Sign-In",
          "☐ เติมเงินผ่านสลิปธนาคาร",
          "☐ เติมเงินผ่านซอง TrueWallet",
          "☐ เติมเงินผ่าน Gift Code",
          "☐ ซื้อสินค้าด้วยเครดิต + กดรับคีย์",
          "☐ Discord Webhook แจ้งเตือนทุกประเภท",
          "☐ ดูหน้า Dashboard, Analytics",
          "☐ ลองสลิปซ้ำ → ต้องถูกปฏิเสธ",
          "☐ ลองสลิปผิดบัญชี → ต้องถูกปฏิเสธ",
          "☐ Cron Job auto-archive ทำงาน",
        ],
      },
    ],
  },
];

const SetupGuidePage = () => {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("hx-setup-completed");
    return saved ? new Set(JSON.parse(saved)) : new Set<string>();
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["firebase"]));

  const toggleCompleted = (stepId: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      localStorage.setItem("hx-setup-completed", JSON.stringify([...next]));
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const totalSteps = sections.reduce((sum, s) => sum + s.steps.length, 0);
  const completedSteps = sections.reduce(
    (sum, s) => sum + s.steps.filter((step) => completed.has(step.id)).length,
    0
  );
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("คัดลอกแล้ว!");
  };

  const downloadSetupMd = async () => {
    try {
      const res = await fetch("/SETUP.md");
      if (!res.ok) throw new Error("File not found");
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SETUP.md";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลด SETUP.md สำเร็จ!");
    } catch {
      toast.error("ไม่สามารถดาวน์โหลดไฟล์ได้");
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      <PageBreadcrumb items={[{ label: "Setup Guide" }]} title="Setup Guide" subtitle="ขั้นตอนการตั้งค่าทั้งหมดสำหรับเริ่มต้นใช้งาน" />

      {/* Progress bar */}
      <div className="mb-6">
        <div className="bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-muted-foreground">
            {completedSteps}/{totalSteps} ขั้นตอน ({progressPercent}%)
          </p>
          {progressPercent === 100 && (
            <span className="text-sm text-primary font-medium flex items-center gap-1">
              <CheckCheck className="h-4 w-4" /> ตั้งค่าครบแล้ว!
            </span>
          )}
        </div>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
        {sections.map((section) => {
          const done = section.steps.filter((s) => completed.has(s.id)).length;
          const total = section.steps.length;
          const allDone = done === total;
          return (
            <button
              key={section.id}
              onClick={() => {
                setExpandedSections(new Set([section.id]));
                document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth" });
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                allDone ? "border-primary/30 bg-primary/5" : "border-border/50 bg-card/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {section.icon}
                <span className="text-xs font-medium truncate">{section.title}</span>
              </div>
              <p className={`text-xs ${allDone ? "text-primary" : "text-muted-foreground"}`}>
                {done}/{total}
              </p>
            </button>
          );
        })}
      </div>

      {/* Quick Start for Tenants */}
      <Card className="border-primary/30 bg-primary/5 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            ⚡ Quick Start — เริ่มต้นใน 5 นาที
            <Badge variant="default" className="text-xs">สำหรับผู้เช่า/ผู้ซื้อ SRC</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                แก้ไขไฟล์ <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">src/lib/tenantConfig.ts</code>
              </h4>
              <p className="text-xs text-muted-foreground ml-8">
                ไฟล์นี้คือจุดเดียวที่ต้องแก้เพื่อ Rebrand ทั้งเว็บ — ชื่อร้าน, Firebase Config, สีธีม, โดเมน
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                แก้ไข <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">index.html</code>
              </h4>
              <p className="text-xs text-muted-foreground ml-8">
                แก้ Title, Meta tags, OG tags ให้ตรงกับร้านของคุณ (มี comment ชี้ตำแหน่งไว้แล้ว)
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                ตั้งค่าผ่านหน้า Admin
              </h4>
              <p className="text-xs text-muted-foreground ml-8">
                ล็อกอินเป็น Owner → หน้า Admin → ตั้งค่าทุกอย่าง: โลโก้, สี, สินค้า, บัญชีธนาคาร, Webhooks
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <h4 className="text-sm font-semibold mb-2">📁 ไฟล์ที่ต้องแก้ไข</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <code className="text-primary">src/lib/tenantConfig.ts</code>
                <span className="text-muted-foreground">— ต้องแก้</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <code className="text-primary">index.html</code>
                <span className="text-muted-foreground">— ต้องแก้</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <code className="text-muted-foreground">.env</code>
                <span className="text-muted-foreground">— แนะนำ</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <code className="text-muted-foreground">public/favicon.png</code>
                <span className="text-muted-foreground">— แนะนำ</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section) => {
          const sectionCompleted = section.steps.filter((s) => completed.has(s.id)).length;
          const isExpanded = expandedSections.has(section.id);

          return (
            <Card key={section.id} id={`section-${section.id}`} className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleSection(section.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${sectionCompleted === section.steps.length ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"}`}>
                      {sectionCompleted === section.steps.length ? <CheckCheck className="h-5 w-5" /> : section.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {section.title}
                        <Badge variant={section.required ? "default" : "secondary"} className="text-xs">
                          {section.required ? "จำเป็น" : "ไม่บังคับ"}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {sectionCompleted}/{section.steps.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  <Separator />
                  {section.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        completed.has(step.id)
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/30 border-border/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleCompleted(step.id)}
                          className="mt-0.5 shrink-0"
                        >
                          {completed.has(step.id) ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-semibold ${
                              completed.has(step.id) ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {idx + 1}. {step.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">{step.description}</p>

                          {step.warning && (
                            <div className="mt-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                              <p className="text-xs text-destructive">{step.warning}</p>
                            </div>
                          )}

                          <ul className="mt-2 space-y-1">
                            {step.details.map((d, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                {d === "" ? (
                                  <span className="h-2" />
                                ) : (
                                  <>
                                    <span className="text-primary mt-1 shrink-0">•</span>
                                    <span className="whitespace-pre-wrap">{d}</span>
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>

                          {step.code && (
                            <div className="mt-3 relative">
                              <pre className="p-3 bg-muted/80 rounded-lg text-xs font-mono overflow-x-auto text-foreground/80 border border-border/50">
                                {step.code}
                              </pre>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-1.5 right-1.5 h-7 px-2"
                                onClick={() => copyToClipboard(step.code!)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          )}

                          {step.envVars && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md border border-border/30">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                Environment Variables:
                              </p>
                              <div className="space-y-1">
                                {step.envVars.map((v) => (
                                  <div key={v} className="flex items-center justify-between">
                                    <code className="text-xs font-mono text-primary">{v}</code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2"
                                      onClick={() => copyToClipboard(v.split("=")[0])}
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {step.indexItems && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground">Composite Indexes ที่ต้องสร้าง:</p>
                              {step.indexItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border/30">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px] shrink-0">{i + 1}</Badge>
                                      <code className="text-xs text-primary font-mono">{item.collection}</code>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5 ml-7">Fields: {item.fields}</p>
                                    <p className="text-[11px] text-muted-foreground ml-7">→ {item.purpose}</p>
                                  </div>
                                  <a
                                    href={item.createUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 ml-2"
                                  >
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                      <ExternalLink className="h-3 w-3" />
                                      สร้าง Index
                                    </Button>
                                  </a>
                                </div>
                              ))}
                              <p className="text-[10px] text-muted-foreground italic">
                                ⚠️ ลิงก์เป็นของ Project &apos;hightxclient&apos; — ถ้าใช้ Project อื่นให้เปลี่ยนชื่อ Project ใน URL
                              </p>
                            </div>
                          )}

                          {step.links && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {step.links.map((link) => (
                                <a
                                  key={link.url}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {link.label}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Architecture Overview */}
      <Card className="mt-8 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            สถาปัตยกรรมระบบ (Architecture)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="font-semibold text-foreground mb-2">Frontend (React + Vite)</p>
              <p>→ ผู้ใช้เข้าเว็บ → React App ทำงานในเบราว์เซอร์</p>
              <p>→ เชื่อมต่อ Firebase Auth, Firestore, Storage โดยตรง</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="font-semibold text-foreground mb-2">Backend (Supabase Edge Functions)</p>
              <p>→ verify-slip: รับสลิป → ส่งไป Thunder API → บันทึก Firestore</p>
              <p>→ redeem-truewallet: รับลิงก์ซอง → แลกเงินผ่าน API TrueWallet</p>
              <p>→ thunder-info: ดึงข้อมูลโควต้า Thunder API</p>
              <p>→ auto-archive-keys: ย้ายคีย์เก่า 90 วัน+ (Cron ทุกเที่ยงคืน)</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="font-semibold text-foreground mb-2">External APIs</p>
              <p>→ Thunder API (ByShield): ตรวจสลิปจริง/ปลอม + ป้องกันซ้ำ</p>
              <p>→ Discord Webhooks: แจ้งเตือนอัตโนมัติ</p>
              <p>→ Google Fonts: โหลดฟอนต์แบบ Dynamic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* .env reference */}
      <Card className="mt-4 border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            ไฟล์ .env.example
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            ดูรายละเอียดตัวแปรทั้งหมดได้ในไฟล์ <code className="text-primary">.env.example</code> และ <code className="text-primary">SETUP.md</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard("cp .env.example .env")}
            >
              <Copy className="h-4 w-4 mr-2" />
              cp .env.example .env
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={downloadSetupMd}
            >
              <Download className="h-4 w-4 mr-2" />
              ดาวน์โหลด SETUP.md
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupGuidePage;
