# 📋 Setup Guide — คู่มือตั้งค่าสำหรับผู้เช่า/ผู้ซื้อ SRC

คู่มือการตั้งค่าทั้งหมดสำหรับผู้ที่ซื้อ/เช่า Source Code ไปใช้งาน

---

## ⚡ Quick Start — เริ่มต้นใน 5 นาที

> **สำหรับผู้เช่า/ผู้ซื้อ SRC** ที่ต้องการเปลี่ยนชื่อร้านและเริ่มใช้งาน

### ขั้นตอนที่ 1: แก้ไขไฟล์ `src/lib/tenantConfig.ts`

ไฟล์นี้คือ **จุดเดียว** ที่คุณต้องแก้เพื่อ Rebrand ทั้งเว็บ:

```typescript
// 🏷️ ข้อมูลร้านค้า
export const TENANT_BRAND = {
  name: "ชื่อร้านของคุณ",           // ← แก้ตรงนี้
  tagline: "สโลแกนของคุณ",          // ← แก้ตรงนี้
  description: "คำอธิบายสั้นสำหรับ SEO",
  developerName: "ชื่อทีมพัฒนา",      // ← แสดงใน Footer
  developerUrl: "",                   // ← ลิงก์ (ถ้ามี)
  footerText: "© 2025 ชื่อร้าน. All rights reserved.",
  subtitle: "ข้อความต้อนรับ",
};

// 🌐 โดเมน
export const TENANT_URLS = {
  domain: "yourdomain.com",           // ← โดเมนของคุณ
  siteUrl: "https://yourdomain.com",
  twitterHandle: "@YourHandle",
};

// 🔑 Firebase Config — ต้องเปลี่ยนเป็นของคุณเอง!
export const TENANT_FIREBASE = {
  apiKey: "AIzaSy...",                 // ← จาก Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  // ... ค่าอื่นๆ
};
```

### ขั้นตอนที่ 2: แก้ไข `index.html`

แก้ `<title>`, `<meta>` tags ให้ตรงกับร้านของคุณ (มี comment ชี้ตำแหน่งไว้แล้ว)

### ขั้นตอนที่ 3: ตั้งค่าผ่านหน้า Admin

หลังล็อกอินเป็น Owner → ไปหน้า **Admin** → ตั้งค่าได้ทุกอย่าง:
- ชื่อร้าน, โลโก้, Favicon
- สีธีม, พื้นหลัง, Particles
- หมวดหมู่, สินค้า, ราคา
- บัญชีธนาคาร, เบอร์ TrueWallet
- Discord Webhooks
- ข้อกำหนดการใช้งาน, นโยบายความเป็นส่วนตัว

### สรุปไฟล์ที่ต้องแก้ไข

| ไฟล์ | ต้องแก้? | หน้าที่ |
|---|---|---|
| `src/lib/tenantConfig.ts` | ✅ **ต้องแก้** | ชื่อร้าน, Firebase config, ธีม, โดเมน |
| `index.html` | ✅ **ต้องแก้** | SEO, OG tags, Title |
| `.env` หรือ `.env.example` | ⚠️ แนะนำ | ตั้ง `VITE_APP_ENV=production` |
| `public/favicon.png` | ⚠️ แนะนำ | เปลี่ยน Favicon |
| `firestore.rules` | ❌ ไม่ต้อง | ใช้ค่าเดิม |
| หน้า Admin | ⚠️ แนะนำ | ตั้งค่าร้านค้าผ่าน UI |

---

## สถาปัตยกรรมระบบ (Architecture)

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + Vite + Tailwind)                 │
│  ├── Firebase Auth (ล็อกอิน)                         │
│  ├── Cloud Firestore (ฐานข้อมูล)                     │
│  └── Firebase Storage (รูปภาพ/ไฟล์)                  │
└──────────────────┬──────────────────────────────────┘
                   │ เรียก Edge Functions
┌──────────────────▼──────────────────────────────────┐
│  Supabase Edge Functions                            │
│  ├── verify-slip       (ตรวจสลิป)                   │
│  ├── redeem-truewallet  (แลกซอง)                    │
│  ├── thunder-info       (เช็คโควต้า)                 │
│  └── auto-archive-keys  (Cron ทุกเที่ยงคืน)          │
└──────────────────┬──────────────────────────────────┘
                   │ เรียก API ภายนอก
┌──────────────────▼──────────────────────────────────┐
│  External APIs                                      │
│  ├── Thunder API (ByShield) — ตรวจสลิปจริง/ปลอม      │
│  ├── Discord Webhooks — แจ้งเตือนอัตโนมัติ           │
│  └── Google Fonts — โหลดฟอนต์ Dynamic                │
└─────────────────────────────────────────────────────┘
```

---

## 1. Firebase

### 1.1 สร้าง Firebase Project

1. เข้า [Firebase Console](https://console.firebase.google.com) → **Add project**
2. ตั้งชื่อ Project
3. เปิด/ปิด Google Analytics ตามต้องการ
4. รอสร้างเสร็จ

### 1.2 เปิดใช้ Authentication

1. เมนูซ้าย → **Authentication** → Get started
2. แท็บ **Sign-in method**:
   - เปิด **Email/Password**
   - เปิด **Google** (ถ้าต้องการ) → ตั้ง Support email
3. แท็บ **Settings** → **Authorized domains** → เพิ่มโดเมน:
   - โดเมนหลักของเว็บ เช่น `myshop.com`
   - `*.lovableproject.com` (Lovable Preview)
   - `*.lovable.app` (Lovable Published)
   - Firebase defaults (`*.firebaseapp.com`, `*.web.app`)

> ⚠️ หากไม่เพิ่ม Authorized domains → Google Sign-In จะใช้งานไม่ได้

### 1.3 สร้าง Cloud Firestore

1. เมนูซ้าย → **Firestore Database** → Create database
2. เลือก **Start in production mode**
3. เลือก Region → `asia-southeast1` (สิงคโปร์)
4. หลังสร้างเสร็จ → ไปแท็บ **Rules**
5. คัดลอกจากไฟล์ `firestore.rules` ในโปรเจกต์ → กด **Publish**

> ⚠️ ต้อง Publish Rules ก่อน ไม่งั้นผู้ใช้จะเข้าถึงข้อมูลไม่ได้

### 1.4 เปิดใช้ Firebase Storage

1. เมนูซ้าย → **Storage** → Get started
2. เลือก **Start in production mode**
3. ตั้ง Storage Rules:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### 1.5 สร้าง Web App & คัดลอก Config

1. Project Settings (⚙️) → **General** → Your apps → **Add app** → Web (`</>`)
2. ตั้งชื่อ → Register
3. คัดลอก Config ทั้งหมด → ใส่ในไฟล์ `.env`:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 1.6 สร้าง Service Account JSON

1. Project Settings → แท็บ **Service accounts**
2. กด **Generate new private key** → ดาวน์โหลดไฟล์ JSON
3. เนื้อหาไฟล์นี้จะถูกนำไปใช้เป็น Supabase Secret (ขั้นตอน 2.2)

> 🔒 **ห้ามเผยแพร่ไฟล์ Service Account JSON เด็ดขาด!**

---

## 2. Supabase (Edge Functions & Cron)

### 2.1 สร้าง Supabase Project

**วิธีที่ 1 — Lovable Cloud (แนะนำ):**
- Lovable → Settings → Cloud → เปิดใช้ Lovable Cloud
- ค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` จะตั้งให้อัตโนมัติ

**วิธีที่ 2 — สร้างเอง:**
- เข้า [supabase.com/dashboard](https://supabase.com/dashboard) → สร้าง Project ใหม่
- จดค่า Project URL, Anon Key, Project Ref

### 2.2 ตั้งค่า Secrets (สำคัญมาก!)

ไปที่ Supabase Dashboard → **Project Settings** → **Edge Functions** → **Secrets**

| Secret Name | ค่า | ใช้โดย |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | เนื้อหา JSON ทั้งหมดจากไฟล์ Service Account | verify-slip, auto-archive-keys |
| `THUNDER_API_KEY` | API Key จาก thunder.byshield.com | verify-slip, thunder-info |

> ⚠️ ถ้าไม่ตั้ง `FIREBASE_SERVICE_ACCOUNT` → Edge Functions ทั้งหมดที่ต้องเข้าถึง Firestore จะทำงานไม่ได้!

### 2.3 เปิด Extensions

ไปที่ **Database** → **Extensions** → เปิดใช้:
- `pg_cron` — สำหรับตั้งเวลา Cron Job
- `pg_net` — สำหรับเรียก HTTP จากภายใน Database

หรือรัน SQL:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2.4 สร้าง Cron Job: Auto-Archive Keys

รัน SQL นี้ที่ **SQL Editor** (แก้ค่า `YOUR_PROJECT_REF` และ `YOUR_ANON_KEY`):

```sql
SELECT cron.schedule(
  'auto-archive-keys-daily',
  '0 0 * * *',  -- ทุกเที่ยงคืน
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-archive-keys',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### 2.5 สร้าง Storage Bucket (ถ้าต้องการเพลงพื้นหลัง)

1. Supabase Dashboard → **Storage** → New bucket
2. ชื่อ: `music`
3. เลือก **Public bucket**
4. ข้ามได้ถ้าไม่ใช้ฟีเจอร์เพลงพื้นหลัง

### 2.6 Deploy Edge Functions

**ถ้าใช้ Lovable Cloud:** Edge Functions deploy อัตโนมัติ ✅

**ถ้า Self-host:** ใช้ Supabase CLI:

```bash
supabase functions deploy verify-slip
supabase functions deploy redeem-truewallet
supabase functions deploy thunder-info
supabase functions deploy auto-archive-keys
```

---

## 3. Thunder API (ByShield)

### 3.1 สมัครและซื้อโควต้า

1. เข้า [thunder.byshield.com](https://thunder.byshield.com)
2. สมัครสมาชิก → ซื้อโควต้าตรวจสลิป
3. Dashboard → คัดลอก **API Key**

API Endpoints ที่ระบบใช้:
- `POST /v2/verify/bank` — ตรวจสลิปธนาคาร
- `POST /v2/verify/truewallet` — ตรวจสลิป TrueWallet
- `GET /v2/info` — ดึงข้อมูลโควต้า

### 3.2 ตั้งค่า API Key

**วิธีที่ 1 — หน้า Admin (แนะนำ เปลี่ยนง่าย):**
- ล็อกอินเป็น Owner → Admin → ตั้งค่าระบบ → ใส่ Thunder API Key

**วิธีที่ 2 — Supabase Secret:**
- Supabase → Project Settings → Secrets → เพิ่ม `THUNDER_API_KEY`

> ลำดับความสำคัญ: **Admin Settings > Supabase Secret**

### 3.3 ใช้ API Key เดียวกันกับ Discord Bot

✅ **ใช้ได้!** ข้อดี:
- โควต้าใช้ร่วมกัน
- `checkDuplicate` ป้องกันสลิปซ้ำข้ามช่องทาง

ความแตกต่าง:
- **เว็บ**: เช็คสลิป + เช็คเลขบัญชี + เติมเงินอัตโนมัติ
- **บอท**: เช็คสลิปจริง/ปลอมเท่านั้น

---

## 4. Discord Webhooks (ไม่บังคับ)

### 4.1 สร้าง Webhook

1. Discord Server → **Server Settings** → Integrations → Webhooks → New Webhook
2. คัดลอก URL

### 4.2 ตั้งค่าในหน้า Admin

Admin → ตั้งค่าระบบ → Webhook Settings:

| Webhook | หน้าที่ |
|---|---|
| Webhook หลัก | แจ้งเตือนทั่วไป |
| Webhook กดคีย์ | แจ้งเมื่อกดรับคีย์ |
| Webhook เติมเงิน | แจ้งเมื่อเติมเงินสำเร็จ |
| Webhook ซื้อสินค้า | แจ้งเมื่อซื้อด้วยเครดิต |
| Webhook สต็อกต่ำ | แจ้งเมื่อสต็อกน้อย |
| Webhook สรุปรายวัน | สรุปยอดขายประจำวัน |
| Webhook ตรวจสลิป | ผลการตรวจสลิปทุกครั้ง |
| Webhook ลิ้งค์รวม | เมื่อสร้าง/แก้ไขลิ้งค์ |

---

## 5. Deploy & เริ่มใช้งาน

### 5.1 ตั้งค่า .env

```bash
cp .env.example .env
```

ใส่ค่า Firebase Config ทั้งหมด + ตั้ง `VITE_APP_ENV=production`

### 5.2 อัปโหลด Firestore Rules

คัดลอก `firestore.rules` → Firebase Console → Firestore → Rules → Publish

### 5.3 สร้างบัญชี Owner

1. สมัครสมาชิกในเว็บด้วยอีเมลหลัก
2. Firebase Console → Firestore → Collection `users`
3. หาเอกสารของอีเมลที่สมัคร → แก้ field `role` เป็น `owner`
4. ล็อกอินใหม่ → เข้า Admin ได้

> ⚠️ ต้องตั้งยศ Owner ผ่าน Firestore Console โดยตรง เพราะยังไม่มี Admin

### 5.4 ตั้งค่าเบื้องต้นในหน้า Admin

1. **ตั้งค่าทั่วไป**: ชื่อร้าน, โลโก้, บัญชีธนาคาร, เบอร์ TrueWallet
2. **สร้างหมวดหมู่**: Gaming, Streaming, License ฯลฯ
3. **สร้างสินค้า**: ชื่อ + ระยะเวลา + ราคา
4. **เพิ่มคีย์**: หน้า Key Management → เพิ่ม/นำเข้า

### 5.5 Checklist ทดสอบ

- [ ] สมัครสมาชิก / ล็อกอิน / Google Sign-In
- [ ] เติมเงินผ่านสลิปธนาคาร
- [ ] เติมเงินผ่านซอง TrueWallet
- [ ] เติมเงินผ่าน Gift Code
- [ ] ซื้อสินค้าด้วยเครดิต + กดรับคีย์
- [ ] Discord Webhook แจ้งเตือนทุกประเภท
- [ ] ดูหน้า Dashboard, Analytics
- [ ] ลองสลิปซ้ำ → ต้องถูกปฏิเสธ
- [ ] ลองสลิปผิดบัญชี → ต้องถูกปฏิเสธ
- [ ] Cron Job auto-archive ทำงาน

---

## Firestore Collections

| Collection | คำอธิบาย |
|---|---|
| `settings` | ตั้งค่าเว็บทั้งหมด (1 document: `site`) |
| `users` | ข้อมูลผู้ใช้ (uid, email, role ฯลฯ) |
| `keys` | คีย์สินค้าที่ยังใช้งาน |
| `archivedKeys` | คีย์เก่าเกิน 90 วันที่ถูก Archive |
| `claimHistory` | ประวัติการกดรับคีย์ |
| `wallets` | ยอดเงินคงเหลือของผู้ใช้ |
| `walletTransactions` | ประวัติธุรกรรมกระเป๋าเงิน |
| `topUpHistory` | ประวัติการเติมเงินทั้งหมด |
| `announcements` | ประกาศ |
| `activityLogs` | บันทึกกิจกรรมระบบ |
| `linkPages` | หน้าลิ้งค์รวม (LinkTree) |
| `linkClicks` | สถิติการคลิกลิ้งค์ |
| `stats` | สถิติทั่วไป |
| `slipVerifyLogs` | ประวัติการตรวจสลิปทั้งหมด |
| `thunderUsage` | สถิติการใช้โควต้า Thunder API รายวัน |

---

## ยศและสิทธิ์ (Roles)

| ยศ | คำอธิบาย |
|---|---|
| `owner` | เจ้าของร้าน — เข้าถึงทุกอย่าง |
| `admin` | แอดมิน — จัดการผู้ใช้, สินค้า, คีย์ |
| `moderator` | ผู้ดูแล — จัดการสินค้า, คีย์ |
| `hightxcrew` | ทีมงาน — กดคีย์ฟรี, ดู Dashboard |
| `reseller` | ตัวแทน — ราคาพิเศษ, ดู Dashboard |
| `vip` | VIP — ส่วนลดอัตโนมัติ |
| `user` | สมาชิกทั่วไป — ซื้อสินค้า, ดูประวัติ |

---

## ต้องการความช่วยเหลือ?

- อ่าน Setup Guide ในเว็บ: `/setup-guide`
- ตรวจสอบ `.env.example` สำหรับรายการตัวแปรทั้งหมด
