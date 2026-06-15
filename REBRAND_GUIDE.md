# 🎨 คู่มือ Rebrand SRC

คู่มือเปลี่ยนแบรนด์เว็บไซต์นี้จาก **HightXClient** ไปเป็นแบรนด์ของคุณ ทำตามขั้นตอนเรียงลำดับได้เลย

---

## 🎯 ขั้นที่ 1: แก้ `src/lib/tenantConfig.ts` (ศูนย์รวมทุกค่า)

ไฟล์เดียวจบ 90% ของงาน rebrand เปิดแล้วแก้ทีละส่วน:

### 1.1 ข้อมูลแบรนด์ (`TENANT_BRAND`)
```ts
name: "ชื่อร้านคุณ",              // เช่น "MyShop"
tagline: "สโลแกนของคุณ",
description: "คำอธิบายสั้นสำหรับ SEO",
developerName: "ชื่อผู้พัฒนา",
developerUrl: "https://...",       // หรือเว้นว่าง ""
footerText: "© 2025 MyShop. All rights reserved.",
subtitle: "ข้อความหน้าแรก",
```

### 1.2 โดเมน (`TENANT_URLS`)
```ts
domain: "myshop.com",
siteUrl: "https://myshop.com",
twitterHandle: "@MyShop",          // หรือ ""
```

### 1.3 รูปภาพ (`TENANT_IMAGES`)
- `ogImage`: รูป 1200x630 อัปโหลดไป imgur/imgbb แล้ววางลิงก์
- `favicon`: ไฟล์ `.png` ใส่ไว้ที่ `public/favicon.png`

### 1.4 ธีมสี (`TENANT_THEME`)
```ts
themeColor: "#xxxxxx",             // HEX สีหลัก (mobile browser bar)
primaryHsl: "234 85% 65%",         // HSL สีหลัก
secondaryHsl: "270 60% 55%",
accentHsl: "300 70% 70%",
```
> 💡 แปลง HEX → HSL ได้ที่ https://hslpicker.com

### 1.5 🔑 Firebase (สำคัญมาก!) — `TENANT_FIREBASE`
ดูรายละเอียดในขั้นที่ 2

### 1.6 Hero Banner + หมวดหมู่เริ่มต้น
แก้ `TENANT_HERO` และ `TENANT_DEFAULT_CATEGORIES` ตามต้องการ

---

## 🔥 ขั้นที่ 2: สร้าง Firebase Project ของคุณ

1. ไป https://console.firebase.google.com → **Add project**
2. ตั้งชื่อโปรเจกต์ → ปิด Analytics ก็ได้ → Create
3. เปิด **Authentication** → Sign-in method → เปิด **Google** + **Email/Password**
4. เปิด **Firestore Database** → Create database → **Production mode** → เลือก region (asia-southeast1)
5. เปิด **Storage** → Get started → Production mode
6. กลับหน้า Project Overview → คลิก **`</>`** (Web app) → ตั้งชื่อ → Register
7. คัดลอก `firebaseConfig` ทั้งก้อนมาวางทับ `TENANT_FIREBASE` ใน `tenantConfig.ts`

---

## 🖼️ ขั้นที่ 3: แทนที่รูปภาพใน `public/`

| ไฟล์ | ขนาด | ใช้ทำอะไร |
|---|---|---|
| `public/favicon.png` | 512x512 | ไอคอนแท็บเบราว์เซอร์ |
| `public/og-image.png` | 1200x630 | preview ตอนแชร์ลิงก์ |

---

## 📄 ขั้นที่ 4: แก้ `index.html`

แก้ `<title>`, `<meta name="description">`, og tags ให้ตรงกับแบรนด์ใหม่

---

## 🛡️ ขั้นที่ 5: Deploy Firestore Rules + Indexes

1. ติดตั้ง Firebase CLI: `npm install -g firebase-tools`
2. แก้ `.firebaserc` → เปลี่ยน `"default": "your-project-id"`
3. รัน:
   ```bash
   firebase login
   firebase use your-project-id
   firebase deploy --only firestore:rules,firestore:indexes
   ```
   หรือดับเบิลคลิก `deploy-firestore.bat` (Windows)

---

## ⚙️ ขั้นที่ 6: Lovable Cloud (Backend สำหรับ Edge Functions)

โปรเจกต์ใช้ Lovable Cloud สำหรับ edge functions เช่น `verify-slip`, `topup-qr`, `spin-wheel`, `meelike-proxy` ฯลฯ

- ถ้า **Remix** โปรเจกต์ใน Lovable → ได้ Backend ใหม่อัตโนมัติ ไม่ต้องตั้งอะไร
- ถ้า **Self-host** → ต้องตั้ง Supabase ใหม่และ deploy edge functions เอง

### Secrets ที่ต้องใส่ (เฉพาะที่ใช้งาน) ใน Lovable Cloud → Secrets:
| Secret | ใช้ตอนไหน |
|---|---|
| `EASYSLIP_API_KEY` | Verify slip โอนเงิน |
| `MEELIKE_API_KEY` | Booster service |
| `THUNDER_API_KEY` | Thunder API |
| `DISCORD_WEBHOOK_*` | แจ้งเตือน Discord |
| `TRUEWALLET_*` | ระบบ TrueWallet |

---

## 👑 ขั้นที่ 7: ตั้ง Owner คนแรก

1. สมัครสมาชิกผ่าน `/login` ด้วย Google
2. เข้า Firebase Console → Firestore → คอลเลกชัน `users` → หา doc ของคุณ
3. แก้ field `role` เป็น `"owner"` (ถ้ายังไม่มีให้เพิ่ม field ใหม่ type: string)

---

## 🎨 ขั้นที่ 8: ปรับเพิ่มเติมผ่านหน้า `/admin`

หลังเป็น Owner แล้ว เข้า **`/admin`** ได้เลย — ปรับได้:

- **Branding** — โลโก้, สี, ฟอนต์ (override ค่าใน tenantConfig)
- **General** — ชื่อร้าน, ticker, hero banner
- **Categories / Products** — สินค้าและหมวดหมู่จริง
- **Webhooks** — Discord notifications
- **TopUp Providers** — บัญชีรับเงิน, TrueWallet, QR
- **Layout / Theme** — grid, radius, density
- **Quick Nav** — แบนเนอร์ลัด
- **VIP Tiers / Discount / Coupons** — ระบบราคา/ส่วนลด
- **Wheels** — ระบบหมุนวงล้อ

---

## 🌐 ขั้นที่ 9: Custom Domain (ถ้ามี)

1. Lovable → Publish → Add custom domain
2. ตั้ง DNS ตามที่ Lovable แนะนำ (A record → `185.158.133.1`)
3. รอ propagate (สูงสุด 72 ชม.) → SSL จะออกอัตโนมัติ

---

## 📋 Checklist สั้นๆ

- [ ] แก้ `src/lib/tenantConfig.ts` ครบทั้ง 6 sections
- [ ] สร้าง Firebase Project + วาง config
- [ ] เปลี่ยน `public/favicon.png` + `og-image.png`
- [ ] แก้ `index.html` (title, meta, og)
- [ ] แก้ `.firebaserc` → project id ของคุณ
- [ ] Deploy Firestore: `firebase deploy --only firestore`
- [ ] ใส่ Secrets ใน Lovable Cloud (เฉพาะที่ใช้)
- [ ] สมัครสมาชิก → ตั้งตัวเองเป็น `owner` ใน Firestore
- [ ] เข้า `/admin` ปรับ branding/categories/products
- [ ] เชื่อม Custom Domain (ถ้ามี)

---

## ❓ FAQ

**Q: แก้ `tenantConfig.ts` แล้วไม่เปลี่ยน?**  
A: รีเฟรช hard reload (Ctrl+Shift+R) หรือ restart dev server

**Q: Login ไม่ได้?**  
A: ตรวจ Firebase Authentication เปิด provider แล้วหรือยัง + Authorized domains มีโดเมนของคุณไหม

**Q: ข้อมูลไม่ขึ้น?**  
A: ตรวจ Firestore rules deploy แล้วหรือยัง + ดู console error

**Q: ใช้ Firebase ของเดิมได้ไหม?**  
A: ❌ ไม่ควร — ข้อมูลจะปนกัน ต้องสร้างใหม่ของตัวเองเสมอ

---

🎉 **เริ่มจากขั้นที่ 1 + 2 ก่อน** เว็บจะเปลี่ยนเป็นแบรนด์คุณทันที ที่เหลือค่อยปรับทีหลังได้
