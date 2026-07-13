
# แผน: สร้าง UI Preset "V2 — Awang Style" (Global, Pixel-perfect)

## เป้าหมาย
สลับหน้าเว็บทั้งเว็บให้เหมือน awang.store ผ่าน `[data-ui-version="v2"]` โดยคง V1 (Liquid Glass) ไว้เป็นค่าเริ่มต้น
Admin เลือกได้ 1 คลิก → refresh → เปลี่ยนทั้งเว็บ

## คีย์ดีไซน์ awang.store ที่จะทำซ้ำ
- โทน: พื้นดำสนิท `#0A0510`, การ์ดม่วงเข้ม, เส้นขอบ `hsl(270 60% 15% / 0.6)`, primary ม่วงนีออน `#7C3AED`
- ฟอนต์: Thai — `Prompt` / `Kanit`, Latin — `Inter`
- Radius: ปุ่มโค้ง full (pill), การ์ด `rounded-2xl`
- Nav: บรรทัดเดียว โลโก้ซ้าย + tab กลาง (มี underline สีม่วงใต้ tab ที่ active) + ปุ่ม outline "ติดต่อเรา" + ปุ่ม solid ม่วง "สมัคร/เข้าสู่ระบบ" ขวา
- Hero: banner รูปเดียว **เต็มความกว้าง ไม่มี glass frame** โค้งขอบเบา ๆ
- Section หัวเรื่อง: pill เล็ก ("● หมวดหมู่") + ชื่อใหญ่ + subtitle + ปุ่มสองปุ่ม (solid + outline)
- Stat card: 4 ใบเรียงกัน — ไอคอน+label เล็กด้านบน, ตัวเลขใหญ่สีม่วง, watermark ไอคอนใหญ่มุมขวา, ขีดสั้นสีม่วงใต้ตัวเลข
- Recent purchases: card ยาว มี icon+ชื่อผู้ใช้+สินค้าซ้าย, เวลาขวา, แถวคั่นบาง
- ตำแหน่ง cookie/help bubble: fixed มุมล่างขวา (มีอยู่แล้ว)

## โครงงานที่จะเปลี่ยน

### 1. Type + Setting (SiteSettingsContext.tsx)
- `UIVersion = "v1" | "v2"` (คืนกลับมา — เคยถอด)
- default `v1` เพื่อความเข้ากันได้ย้อนหลัง
- persist `uiVersion` → Firestore + apply `document.documentElement.dataset.uiVersion`

### 2. Global tokens (index.css)
เพิ่มบล็อก `[data-ui-version="v2"]` ทั้ง `:root` และ `.dark`:
```
--background: 270 60% 4%
--card: 270 40% 8%
--primary: 265 85% 60%   /* awang violet */
--primary-glow: 275 100% 70%
--border: 270 50% 18% / 0.5
--radius: 1rem
```
Override:
- `.glass-card` → พื้นทึบ `bg-card`, ขอบ `border-primary/20`, ยกเลิก backdrop-blur
- `.btn-gradient` → solid `bg-primary` + hover glow
- `.glass-pill` → pill `bg-primary/10 text-primary border-primary/30`
- import Google Fonts Prompt/Kanit เฉพาะเมื่อ v2

### 3. Component v2-only variants
สร้างตัวใหม่ (ไม่ทับ v1) เลือกใช้ตาม `settings.uiVersion`:
- `src/components/v2/NavbarV2.tsx` — tab underline + right actions
- `src/components/v2/HeroBannerV2.tsx` — full-bleed banner
- `src/components/v2/StatCardV2.tsx` — big number + watermark icon
- `src/components/v2/RecentActivityRow.tsx` — long list row
- `src/components/v2/SectionHeaderV2.tsx` — pill + title + actions

### 4. Route switcher
ใน `App.tsx` / `Layout.tsx`:
```
const isV2 = settings.uiVersion === "v2";
return isV2 ? <NavbarV2 /> : <Navbar />;
```
หน้าที่กระทบ (pixel-perfect ตาม awang):
- **Index (Home)** — Hero + Welcome + Stats + Recent
- **StorePage** — Header row + card grid (คงพฤติกรรม, ปรับสไตล์การ์ดตาม v2)
- **Hub, Admin, Profile ฯลฯ** — ใช้ token v2 อัตโนมัติ ไม่ทำ layout ใหม่ (จะกลายเป็น "ใช้ธีม v2" ที่ยังเดินได้)

### 5. Admin UI (AdminEffectsTab หรือ AdminBrandingTab)
- ตัวเลือก radio: V1 (Liquid Glass) / V2 (Awang Violet)
- Preview panel เล็กแสดง Nav+Stat card+Hero mini
- ปุ่ม "บันทึกและรีเฟรช"

### 6. Migration guard
- ค่าเก่า `uiVersion` ที่ไม่ใช่ `v1`/`v2` → normalize เป็น `v1`
- `useEffect` ใน SiteSettingsContext เขียน dataset ทันทีตอน settings โหลด (มีอยู่แล้ว)

## ขอบเขตที่ **ไม่ทำ** ในรอบนี้
- ไม่รีเดสิญหน้า Admin/Hub/Cart/Checkout เป็น pixel-perfect (แค่รับ token v2)
- ไม่แตะ business logic, ไม่แตะ routing, ไม่แตะ Firestore schema
- ไม่ทำโหมด light สำหรับ v2 (awang เป็นดาร์กเท่านั้น)

## ลำดับการลงมือ
1. คืน `UIVersion` type + save/load logic  
2. เขียนบล็อก `[data-ui-version="v2"]` ใน index.css (tokens + override .glass-*)  
3. สร้าง v2 components ทั้ง 5 ไฟล์  
4. Wire สลับที่ Layout/Navbar/Index (Home)  
5. StorePage: การ์ดสินค้ารับสไตล์ใหม่อัตโนมัติผ่าน token (ไม่ต้องเขียน component ใหม่)  
6. Admin picker + preview  
7. Typecheck + เช็ก /  /store  /hub ว่ายังใช้งานได้

## ความเสี่ยงและวิธีแก้
- **CSS token ชน**: ทดสอบ dark mode ทั้งสอง preset  
- **การ์ดสินค้าเดิมพัง**: fallback ให้ยังโค้งและอ่านออก แม้ไม่ได้ทำ v2 variant  
- **ฟอนต์โหลดช้า**: ใช้ `font-display: swap`, preload เฉพาะเมื่อ v2 active  
- **Admin แอบเปลี่ยนแล้วงง**: ต้องมีคำเตือน "หน้าจะ refresh"

ยืนยันแผน แล้วผมจะเริ่มลงมือทีเดียวจบครับ
