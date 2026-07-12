## Phase 6 — Tools & Integrations Cleanup

### 1) ลบระบบ Booster (MeeLike) ออกทั้งหมด

**ลบไฟล์:**
- `src/pages/BoosterStorePage.tsx`
- `src/pages/BoosterAdminPage.tsx`
- `src/pages/BoosterOrderHistoryPage.tsx`
- `src/components/admin/AdminBoosterTab.tsx`
- `src/components/admin/BoosterCatalogPanel.tsx`
- `src/lib/boosterApi.ts`
- `supabase/functions/meelike-proxy/index.ts`

**แก้ไข (ตัด import/route/tab/setting/type):**
- `src/App.tsx` — ตัด 3 routes: `/hightxfollowerbooster`, `/boosteradminpanel`, `/booster-orders`
- `src/pages/AdminPage.tsx` — ตัด tab "Booster" + import + type
- `src/pages/HistoryHubPage.tsx` — ตัดรายการ `/booster-orders`
- `src/pages/HubPage.tsx` — ตัดลิงก์ (ถ้ามี)
- `src/pages/SetupGuidePage.tsx` — ตัดหมวด Booster ทั้งหมด
- `src/contexts/SiteSettingsContext.tsx` — ลบ `BoosterSettings`, `booster`, `webhookBooster`, `webhookBoosterUrls`
- `src/components/admin/AdminWebhooks.tsx` — ลบ field/test webhook `booster`
- `src/lib/webhookSender.ts` — ลบ channel `"booster"`
- `src/lib/walletLedger.ts` — ลบ ledger type `"booster_spend"`
- `supabase/functions/send-webhook/index.ts` — ลบ mapping booster (ถ้ามี)

### 2) Thunder API — ปลดสิทธิ์ Owner-only

Dashboard Thunder Quota widget ปัจจุบันแสดงเฉพาะ Owner/Admin (อยู่ในหน้า Dashboard ที่ gate อยู่แล้ว) — จะย้าย/copy ให้ผู้ที่เข้าถึงหน้า TopUp เห็นได้ด้วย (ข้อ 3 ครอบคลุม) และคง Widget เดิมใน Dashboard ไว้โดยไม่มีเงื่อนไข role พิเศษ

### 3) เพิ่มช่องแสดงโควต้า Slip แบบ Realtime

- สร้าง component ใหม่ `src/components/topup/SlipQuotaLive.tsx`
  - เรียก `thunder-info` edge function ทุก 15 วินาที
  - แสดง: ใช้ไป / คงเหลือ / โควต้ารวม + progress bar สี (เขียว/เหลือง/แดง)
  - Badge "🟢 Realtime" พร้อม dot pulsing
- แสดงที่ **หัวหน้า TopUpPage** ให้ user ทุกคนเห็นก่อนอัปโหลดสลิป (จะได้รู้ว่าระบบยังใช้งานได้)
- ไม่ผูก role — เห็นได้ทุกคน

### เทคนิค

- Booster ledger type ถ้ามีเอกสารเก่าใน Firestore ค้างอยู่ จะไม่กระทบเพราะเป็นข้อมูล archive
- `thunder-info` edge function ไม่ต้องแก้ (API key อยู่ server-side อยู่แล้ว)
- Poll 15s บน component mount, cleanup ตอน unmount

หลังจากทำเสร็จ preview จะไม่มีเมนู Booster ใดๆ และหน้า TopUp จะโชว์โควต้า Slip สดๆ ให้ทุกคนเห็น
