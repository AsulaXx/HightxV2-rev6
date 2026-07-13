# แผนรีดีไซน์ V2 "Tactical Dark" ทั้งเว็บ

## เป้าหมาย
เปลี่ยนโหมด V2 จาก "override หน้า Store + Hero" → **สไตล์เว็บใหม่ทั้งเว็บ** ที่ดูเหมือนคนละแบรนด์กับ V1 โดยรื้อคอมโพเนนต์จริงทีละหน้า ไม่ใช่แค่ทับ CSS

## Design tokens (ล็อกไว้ใช้ทุกหน้า)
- **พื้นหลัง**: ดำอมม่วง `hsl(270 40% 6%)` → gradient ไปม่วงเข้ม `hsl(272 45% 10%)`
- **การ์ด/แผง**: `hsl(270 42% 9%)` ขอบ `hsl(270 45% 18%)` **ไม่มี blur**
- **Accent หลัก**: ม่วงนีออน `hsl(272 90% 62%)` / **Accent รอง**: ชมพูแดง `hsl(340 85% 60%)`
- **สถานะ**: เขียว `hsl(150 75% 50%)` · เหลือง `hsl(45 95% 58%)` · แดง `hsl(0 82% 60%)`
- **มุมโค้ง**: 10px (ปุ่ม/input), 12px (การ์ด), 999px (pill/badge)
- **ฟอนต์**: หัวเรื่อง Kanit 700 · เนื้อหา Prompt 400/500 · ตัวเลข Kanit 600
- **ไม่ใช้**: glass blur, aurora bg, particles, floating orbs — แทนด้วยเส้น grid บาง + จุด dot pattern

## ขอบเขต — รื้อทีละหน้า (component-level)

### เฟส 1 — โครง & Nav (ทั่วเว็บ)
- `Navbar.tsx` → แถบเมนูแบบ command bar: โลโก้ซ้าย, เมนูกลาง underline hover, wallet+cart+user ขวาแบบ pill
- `Footer.tsx` → แถบเข้ม 3 คอลัมน์ ขอบบนม่วงบาง, social icons แบบ outline pill
- `GlobalCartPanel.tsx` → panel ขวาแบบ tactical, header ม่วง, list การ์ดเข้ม, ปุ่ม checkout ม่วงนีออน
- `AnnouncementTicker.tsx` → แถบดำขอบม่วง, ไอคอนสามเหลี่ยม accent

### เฟส 2 — Auth & Profile
- `LoginPage.tsx` → split-screen: ซ้ายภาพ/โลโก้ + tagline, ขวาฟอร์มการ์ดเข้ม
- `ProfilePage.tsx` → header banner + avatar overlap, tab แบบ pill, การ์ดสถิติแนว dashboard เกม
- `DashboardPage.tsx` + summary cards → grid card เข้ม, ตัวเลขใหญ่, sparkline สีม่วง

### เฟส 3 — Hub / Tools / Wheel
- `HubPage.tsx` → grid การ์ดเครื่องมือ เหมือน "operator loadout" มีไอคอนใหญ่ + tag
- `WheelHubPage.tsx` / `WheelPage.tsx` → วงล้อพื้นดำ, ขอบม่วงเรืองแสง, ปุ่ม SPIN ทรงหกเหลี่ยม
- `LeaderboardPage.tsx` → ตารางแรงก์แบบ ranking board, top 3 การ์ดใหญ่พิเศษ

### เฟส 4 — เติมเงิน / Wallet / Cart
- `TopUpPage.tsx` → tab providers แบบ segmented ม่วง, การ์ดใบเสร็จเข้ม
- คอมโพเนนต์ `TopUpQR/BankSlip/GiftCode/TrueWallet/Voucher` → form input pill, ปุ่มยืนยันม่วงนีออน
- `WalletHistoryPage.tsx` / `HistoryHubPage.tsx` → ตาราง row เข้ม, badge สถานะเป็น pill accent

### เฟส 5 — เนื้อหาอื่นที่เหลือ
- `AnnouncementsPage.tsx`, `StatusPage.tsx`, `ProductStatusPage.tsx`
- `LinkTreePage.tsx`, `LinkViewPage.tsx`
- `TermsPage.tsx`, `SetupGuidePage.tsx`, `NotFound.tsx`
- `KeyPage.tsx`, `ClaimHistoryPage.tsx`

## วิธีทางเทคนิค
- ทุก override scope ด้วย selector `[data-ui-version="v2"]` ใน `src/index.css` (ไม่แตะ V1)
- คอมโพเนนต์ที่ต้องรื้อ layout จริง → ใช้ `useSiteSettings().uiVersion === "v2"` แล้ว render สาขาใหม่ (คล้าย `HomeV2Hero`) โดยแยกไฟล์ไว้ที่ `src/components/v2/`
- โครงสร้างไฟล์ใหม่:
  ```text
  src/components/v2/
    layout/NavbarV2.tsx, FooterV2.tsx, CartPanelV2.tsx
    ui/CardV2.tsx, ButtonV2.tsx, InputV2.tsx, BadgeV2.tsx
    pages/LoginV2.tsx, ProfileV2.tsx, DashboardV2.tsx, HubV2.tsx,
          WheelV2.tsx, TopUpV2.tsx, WalletV2.tsx, ...
  ```
- Wrapper รูปแบบเดียวกันทุกหน้า:
  ```tsx
  const { settings } = useSiteSettings();
  if (settings.uiVersion === "v2") return <XxxV2 .../>;
  // ...V1 เดิม
  ```
- โหลดฟอนต์ Kanit/Prompt ผ่าน `<link>` ใน `index.html` (มีอยู่แล้วเช็คก่อน)

## ลำดับส่ง
งานใหญ่มาก จะทำเป็น **5 batch ตามเฟส** ให้ผู้ใช้รีวิวทีละเฟส:
1. เฟส 1 (Nav/Footer/Cart/Ticker) — เห็นผลทั่วเว็บทันที
2. เฟส 2 (Auth/Profile/Dashboard)
3. เฟส 3 (Hub/Wheel/Leaderboard)
4. เฟส 4 (TopUp/Wallet/History)
5. เฟส 5 (หน้าที่เหลือ + polish)

## สิ่งที่ **ไม่** แตะ
- Logic ทั้งหมด (auth, cart, wallet, wheel spin, edge functions) — เปลี่ยนแค่ UI
- หน้า Admin ทุกตัว (`AdminPage`, `Admin*Tab`) — เป็นเครื่องมือหลังบ้าน ไม่ควรเปลี่ยน
- ธีม V1 ยังใช้ได้ปกติผ่าน toggle ในแอดมิน

---

**ยืนยันเริ่มเฟส 1 (Navbar + Footer + Cart Panel + Ticker) เลยไหมครับ?** หรืออยากเริ่มเฟสอื่นก่อน
