
# แท็บ Role Access ใน Admin

ระบบเดิมมี `AdminPermissionsTab` อยู่แล้ว (จัดการ `settings.rolePermissions` แบบ role→permission_id) แต่ครอบคลุมแค่ ~17 permission และหลายหน้ายังใช้ role hardcoded (เช่น Dashboard, Wheel, Ruzien, Admin tabs). แผนนี้ทำ **แท็บใหม่ที่ยกเครื่อง permission matrix ทั้งระบบ**

---

## สิ่งที่จะทำ

### 1. ขยายรายการ permission เป็นระดับหน้า + section
เพิ่ม permission ID ใหม่ให้ครอบคลุม เพื่อให้แต่ละ role toggle ได้ละเอียด:

**หน้า (page-level)**
- `page.dashboard`, `page.analytics`, `page.admin`, `page.stock`, `page.key_management`
- `page.wheel`, `page.wheel_history`, `page.ruzien_bypass`
- `page.leaderboard`, `page.referral_dashboard`, `page.banned_users`
- `page.customer_balances`, `page.wallet_history`, `page.all_topup_history`, `page.all_user_history`, `page.all_claim_history`
- `page.activity_log`, `page.link_analytics`, `page.archived_keys`

**Section ย่อยใน Dashboard**
- `dash.low_stock`, `dash.recent_keys`, `dash.users_breakdown`, `dash.wallet_tx`, `dash.top_up_breakdown`, `dash.wheel_activity`, `dash.thunder_quota`, `dash.today_sales`, `dash.purchase_analytics`

**Admin tab access** (ยศ Admin/Moderator เห็นแท็บไหนบ้าง)
- `admin.tab.general`, `admin.tab.products`, `admin.tab.keys`, `admin.tab.users`, `admin.tab.topup`, `admin.tab.webhooks`, `admin.tab.discounts`, `admin.tab.categories`, `admin.tab.wheels`, `admin.tab.ruzien_bypass`, `admin.tab.role_access` (ใหม่), `admin.tab.audit_log`, `admin.tab.backup`, `admin.tab.data_reset`

Owner ได้ทุก permission โดย default; ยศต่ำสุด (user) เห็นแค่ store/wallet/history

### 2. แท็บใหม่ `AdminRoleAccessTab`
- อยู่ใน `/admin` ต่อจาก tab เดิม (แสดงเฉพาะ Owner)
- UI: 
  - **มุมมองที่ 1 – By Role**: เลือก role → เห็น checklist ทุก permission จัดกลุ่มตามหมวด (Page/Section/Admin Tab) พร้อม toggle
  - **มุมมองที่ 2 – Matrix**: ตารางแนวนอน role × permission (คล้าย AdminPermissionsTab เดิม แต่มี group heading)
  - ปุ่ม "Reset เป็น default", "บันทึก", "Copy from role" (คัดสิทธิ์จาก role อื่นมาเป็นฐาน)
  - Preview: "ยศ X จะเห็น N หน้า / M section"

### 3. ใช้ permission จริงในหน้า (แทน role hardcoded)
สร้าง helper `hasFeature(permId)` ใน `AuthContext` ที่อ่านจาก `settings.rolePermissions` แล้วแทนที่จุด hardcoded:
- `DashboardPage.tsx`: guard เปลี่ยนจาก `allowedRoles` array → `hasFeature("page.dashboard")`; แต่ละ section (Low Stock, Recent Keys, Users Breakdown, Wallet TX ฯลฯ) เช็ค `hasFeature("dash.xxx")`
- `AdminPage.tsx`: ซ่อนแท็บที่ไม่มีสิทธิ์ตาม `admin.tab.*`
- `WheelPage`, `WheelHubPage`, `RuzienBypassPage`, `AnalyticsPage`, `AllClaimHistoryPage` ฯลฯ: guard ด้วย `hasFeature("page.*")`
- Owner จะได้ทุก permission ตลอด (bypass check) เพื่อกันล็อกตัวเอง

### 4. Firestore rules & safety
- ห้ามลบ/แก้สิทธิ์ Owner (UI lock)
- `settings.rolePermissions` เขียนได้แค่ Owner (rule เดิมเป็น `isOwner()` อยู่แล้ว ✓)
- ปุ่ม Save = ยืนยัน 2 ชั้น ถ้ามีการปิดสิทธิ์สำคัญ (`admin.tab.role_access`, `site_settings`)

---

## รายละเอียดเทคนิค

### ไฟล์ที่แก้/สร้าง

**สร้างใหม่**
- `src/components/admin/AdminRoleAccessTab.tsx` – UI แท็บใหม่ (By Role + Matrix)
- `src/lib/permissionRegistry.ts` – รวม permission ID + label + group + default role grants ที่จุดเดียว

**แก้ไข**
- `src/contexts/SiteSettingsContext.tsx` – merge default permissions ใหม่จาก `permissionRegistry`
- `src/contexts/AuthContext.tsx` – เพิ่ม `hasFeature(id)` (Owner = true เสมอ; อ่าน `settings.rolePermissions[profile.role]`)
- `src/pages/AdminPage.tsx` – ลงทะเบียนแท็บใหม่ + ซ่อน tabs ตาม `admin.tab.*`
- `src/pages/DashboardPage.tsx` – guard หน้า + section ด้วย `hasFeature`
- `src/pages/WheelPage.tsx`, `WheelHubPage.tsx`, `RuzienBypassPage.tsx`, `AnalyticsPage.tsx`, `AllClaimHistoryPage.tsx`, `AllTopUpHistoryPage.tsx`, `CustomerBalancesPage.tsx`, `WalletHistoryPage.tsx`, `LeaderboardPage.tsx` ฯลฯ – แทน role check
- `src/App.tsx` (ถ้าจำเป็น) – ไม่แก้ route; ใช้ guard ในแต่ละหน้า

### โครง permissionRegistry
```ts
export const PERMISSION_GROUPS = [
  { id: "shop", label: "ร้านค้า & ประวัติ", items: [...] },
  { id: "wallet", label: "กระเป๋าเงิน", items: [...] },
  { id: "dashboard_page", label: "หน้า Dashboard", items: [...] },
  { id: "dashboard_sections", label: "Section ใน Dashboard", items: [...] },
  { id: "tools", label: "เครื่องมือ (Wheel, Ruzien, Analytics)", items: [...] },
  { id: "admin_tabs", label: "แท็บ Admin", items: [...] },
  { id: "history", label: "ประวัติทั้งหมด", items: [...] },
];
```

### พฤติกรรม `hasFeature`
```
if (role === "owner") return true;
const list = settings.rolePermissions?.[role] ?? DEFAULT_ROLE_PERMISSIONS[role] ?? [];
return list.includes(id);
```

### Migration
- ถ้า `settings.rolePermissions` มีอยู่แล้ว → merge เข้ากับ default (ไม่ทับสิทธิ์เดิมที่ Owner ตั้งไว้; แค่เติม permission ใหม่ให้ role default)
- ทำใน `AuthContext` ตอนโหลด settings ครั้งแรก หรือใน settings context

---

## ที่ **ไม่** ทำในรอบนี้
- ไม่แตะ Firestore rules สำหรับ data-level (ยศไหนอ่าน collection อะไรได้) – ยังเป็น admin-only เหมือนเดิม เพราะจะกระทบ security model ทั้งระบบ ถ้าต้องการค่อยแยก phase 2
- ไม่ทำ per-user override (permission ผูกกับ role เท่านั้น)
