
# รายงานช่องโหว่ + แผนอุด

ตรวจ `firestore.rules` (315 บรรทัด) + เทียบกับ edge functions แล้ว พบจุดที่ผู้ใช้สามารถ "เปิด DevTools → เรียก Firebase SDK ตรงๆ" เพื่อโจมตีได้ดังนี้ จัดลำดับตามความรุนแรง

---

## ระดับ CRITICAL (โดนเมื่อไหร่ = ระบบพัง)

### 1. Privilege Escalation ผ่าน `users/{uid}` (บรรทัด 56-60)
```
allow update: if isSignedIn() && (request.auth.uid == userId || isAdmin());
```
ไม่มี **field whitelist** → user ธรรมดาเปิด console รัน:
```js
updateDoc(doc(db,'users',uid), { role: 'owner' })
```
แล้วกลายเป็น Owner ทันที → เข้าถึงทุกอย่าง

**แก้:** เพิ่ม `affectedKeys().hasOnly([...whitelist ที่ไม่รวม 'role','banned','credits'])` สำหรับเคส self-update; ฟิลด์ `role/banned` ต้องเป็น `isAdmin()` เท่านั้น

### 2. Wallet Self-Topup (บรรทัด 171-177)
User เขียน `balance`, `totalTopUp` ของตัวเองได้ตรงๆ → ตั้งยอดเงินเท่าไหร่ก็ได้ฟรี

**แก้:** บล็อก client เขียน `balance/totalTopUp/totalSpent` ทั้งหมด — บังคับให้ผ่าน edge function (`redeem-truewallet`, `topup-qr`, `verify-slip` ฯลฯ) ที่ใช้ service account เท่านั้น  
client เขียนได้แค่ field meta เช่น `updatedAt` (จริงๆ ไม่ต้องเขียนเลย)

### 3. Wallet Ledger / Transactions / TopUpHistory Self-Create
ทั้ง 3 collection (`walletLedger`, `walletTransactions`, `topUpHistory`) อนุญาตให้ user create record ของตัวเองด้วย amount อะไรก็ได้ → ปลอม transaction → รวมกับ #2 = ทำเงินไม่อั้น + ปลอม audit trail

**แก้:** `allow create: if false` สำหรับ client; ให้ edge function เขียนทั้งหมด (มี service account อยู่แล้ว)

### 4. OTP Self-Set (บรรทัด 243-247)
```
allow create, update: if isSignedIn() && request.auth.uid == userId;
```
User ตั้ง OTP ตัวเองได้ → bypass 2FA โดยตั้งโค้ดที่ตัวเองรู้

**แก้:** `allow write: if false;` — OTP ต้องเขียนผ่าน edge function เท่านั้น (server gen + verify)

### 5. processedSlips Squatting (บรรทัด 109-113)
User สร้าง `processedSlips/{refId}` ของ refId อะไรก็ได้ → DoS ระบบ verify slip (refId จริงของคนอื่นถูกบล็อกถาวร)

**แก้:** `allow create: if false;` — เขียนผ่าน edge `verify-slip` (service account) เท่านั้น

---

## ระดับ HIGH

### 6. boosterOrders Self-Complete (บรรทัด 254-258)
User เขียน `status: 'completed'` ของ order ตัวเองได้ → ถ้ามี trigger ปลายทาง (เช่น refund flow) ถูก abuse ได้

**แก้:** ตัด `status` ออกจาก whitelist; ให้ edge function อัปเดต status

### 7. linkPages clickCounts Unauthed Update (บรรทัด 148-149)
```
allow update: if request.resource.data.diff(resource.data).affectedKeys()
  .hasOnly(['clickCounts', 'totalClicks']);
```
**ไม่มี `isSignedIn()`** → ใครก็ได้ (ไม่ต้องล็อกอิน) ปั่น click count ของทุกหน้าได้ → analytics เพี้ยน

**แก้:** เพิ่ม validation: `request.resource.data.totalClicks == resource.data.totalClicks + 1` เพื่อให้บวกได้ทีละ 1 และจำกัด IP rate-limit ฝั่ง client (มี `rateLimiter.ts` อยู่แล้ว)

### 8. linkClicks `create: if true` (บรรทัด 161)
Unauth user สามารถ insert log นับล้าน record → blow up Firestore quota / bill

**แก้:** เปลี่ยนเป็น `allow create: if isSignedIn() || request.resource.data.keys().hasOnly([...minimal])` + จำกัด rate

### 9. Settings Doc อาจมี webhooks ค้าง
`settings/{docId}` อ่านได้ public (บรรทัด 36) ถูกต้องสำหรับ branding แต่ **ต้องยืนยันว่า field พวก `discordWebhookUrl`, `webhook*`, `bankAccounts`, `thunderApiKey` ไม่ได้อยู่ใน `settings/site` doc** (ถ้ายังอยู่ แม้ลบจาก localStorage แล้ว ใครก็อ่านได้จาก Firestore ตรงๆ)

**แก้:** migrate field sensitive ทั้งหมดไปอยู่ใน `siteSettingsPrivate/site` (rule admin-only มีอยู่แล้ว) แล้วลบจาก `settings/site`

---

## ระดับ MEDIUM

### 10. ipGeoCache อ่านได้ทุก signed-in user (บรรทัด 119)
เห็น IP จริงของ user/admin ทุกคน → privacy leak  
**แก้:** จำกัด `isStaff()` หรือเก็บ hash ของ IP

### 11. reviews ไม่มี purchase verification (บรรทัด 281-289)
User สร้างรีวิว product ใดก็ได้โดยไม่ต้องเคยซื้อ → review bombing  
**แก้:** ใช้ query check `claimHistory` หรือเก็บ `verifiedPurchase: true` ที่ตั้งโดย edge function เท่านั้น

### 12. claimHistory Self-Create (บรรทัด 129-130)
User สร้าง claim record ของตัวเองได้ → ปลอมประวัติให้ดู active เพื่อเลื่อน VIP tier / referral reward  
**แก้:** บังคับให้ผ่าน edge function สำหรับ claim ที่มีผลต่อ wallet/tier

### 13. ไม่มี Firebase App Check
ทั้งหมดข้างบนรุนแรงขึ้นเพราะ Firestore เปิดให้เรียกจากที่ไหนก็ได้ (curl, postman, bot) ไม่ใช่แค่ browser  
**แก้:** เปิด **App Check** ด้วย reCAPTCHA v3 / Enterprise — บล็อก request ที่ไม่ได้มาจาก domain จริง

---

## ระดับ LOW (เก็บกวาด)

- `stats` ให้ `isStaff` write — `hightxcrew` ไม่ควรแก้ stats public
- `ipGeoCache` write ควรเป็น admin ไม่ใช่ทั้ง staff
- `boosterOrders.update` user อัพได้ → จำกัด field ที่ user แตะได้เป็น `[]` (ไม่ให้แตะเลย)
- `archivedKeys` ขาด `allow update` (ดีแล้ว); `allow read` ควรเพิ่ม `isStaff` ถ้า moderator ต้องดู

---

## แผนแก้ (3 phase)

### Phase 1 — แก้ rules (เร่งด่วน ใช้ในไฟล์ `firestore.rules`)
อุด #1, #2, #3, #4, #5, #6, #7, #8 ทั้งหมดในไฟล์เดียว
- เพิ่ม helper `safeUserSelfFields()` whitelist field user แก้ตัวเองได้
- เปลี่ยน wallet/ledger/topUp/OTP/processedSlips/booster เป็น "service account only"
- เติม `isSignedIn()` + delta validation บน linkPages/linkClicks

### Phase 2 — ย้าย sensitive field ใน Firestore (เริ่มแล้ว)

**Step 2.1 ✅ — Thunder API Key ออกจาก client (รั่วจริงเพราะ `settings/site` อ่าน public ได้)**
- ลบ `thunderApiKey` จาก body ที่ client ส่งให้ `verify-slip` / `thunder-info` (TopUpPage 2 จุด + DashboardPage)
- `thunder-info` edge function เลิกรับ key จาก request body — ใช้ `Deno.env.THUNDER_API_KEY` อย่างเดียว → deployed
- field ใน type ยังอยู่เพื่อ backward-compat แต่ไม่มีใครอ่าน

**Step 2.2 (ค้าง) — Gift Codes / Coupons ย้ายไปฝั่ง server**
ตอนนี้ใครก็ตาม `getDoc("settings/site")` ได้รายการ gift code + coupon ทั้งหมด (รวมโค้ดดิบ)
- สร้าง edge function `redeem-gift-code` (service account, atomic txn)
- สร้าง edge function `apply-coupon` (validate + return discount; ไม่ส่งโค้ดดิบกลับ)
- ย้าย array `giftCodes` / `coupons` จาก `settings/site` → `siteSettingsPrivate/site`
- อัพเดต `TopUpPage.tsx` + `GlobalCartPanel.tsx` ให้เรียก edge แทน Firestore txn
- เพิ่ม rule: `siteSettingsPrivate` admin-only (มีอยู่แล้ว)

**Step 2.3 (ค้าง) — Wallet flow → service account**
- edge function `wallet-topup` (เขียน wallets.balance + walletLedger + walletTransactions + topUpHistory + processedSlips ใน txn เดียว)
- edge function `wallet-purchase` (deduct + create claim atomically)
- ปลด TODO ใน `firestore.rules` (`allow create: if false` สำหรับ wallet*, processedSlips)

### Phase 3 — Defense in depth
- เปิด **Firebase App Check** (reCAPTCHA v3 site key เป็น public key, ไม่ใช่ secret)
- เพิ่ม linter test ใน `src/test/firestore-rules.test.ts` ครอบ scenario โจมตี (set role=owner, self-topup, etc.)
- เปิด **Leaked Password Protection** ใน Lovable Cloud Auth

