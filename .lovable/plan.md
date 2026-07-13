
# แยกโครงสร้าง Admin Components เป็นระบบ

## โครงสร้างใหม่

```text
src/components/admin/
├── shared/                     # ใช้ร่วมกันทุกแท็บ
│   ├── AdminSection.tsx
│   ├── AdminTabProps.ts
│   ├── AdminCardPreview.tsx
│   ├── ImageUploadField.tsx
│   └── AdminStatusWidget.tsx
│
├── main/                       # ตั้งค่าหลักของเว็บ
│   ├── AdminGeneralTab.tsx
│   ├── AdminBrandingTab.tsx
│   ├── AdminThemeTab.tsx
│   ├── AdminLayoutTab.tsx
│   ├── AdminEffectsTab.tsx
│   ├── AdminMusicTab.tsx
│   └── AdminLegalTab.tsx
│
├── catalog/                    # สินค้า/คีย์/หมวดหมู่
│   ├── AdminProductsTab.tsx
│   ├── AdminCategoriesTab.tsx
│   ├── AdminKeysTab.tsx
│   ├── AdminServicesTab.tsx
│   ├── AdminQuickNavTab.tsx
│   ├── AdminLinkPagesTab.tsx
│   ├── AdminWheelsTab.tsx
│   ├── AdminWheelClaimsTab.tsx
│   └── KeyImportLog.tsx
│
├── finance/                    # การเงิน/โปรโมชั่น
│   ├── AdminTopUpTab.tsx
│   ├── AdminTopUpProviders.tsx
│   ├── AdminTransactionsTab.tsx
│   ├── AdminDiscountTab.tsx
│   ├── AdminCoupons.tsx
│   ├── AdminVipTiers.tsx
│   ├── AdminReferral.tsx
│   ├── AdminLeaderboard.tsx
│   └── AdminFinanceCleanup.tsx
│
├── users/                      # ผู้ใช้/สิทธิ์
│   ├── AdminUsersTab.tsx
│   ├── AdminPermissionsTab.tsx
│   └── AdminRoleAccessTab.tsx
│
└── system/                     # ระบบ/ข้อมูล/logs
    ├── AdminBackup.tsx
    ├── AdminDataReset.tsx
    ├── AdminAuditLogTab.tsx
    ├── AdminWebhooks.tsx
    └── AdminRuzienBypassTab.tsx
```

## สิ่งที่ต้องทำ

1. ย้ายไฟล์ทั้งหมดเข้าโฟลเดอร์ตามผังด้านบน (ใช้ `mv` — เนื้อหาไฟล์ไม่แก้)
2. อัปเดต import ในทุกไฟล์ที่อ้างถึงพาธเก่า (หลัก ๆ อยู่ที่ `src/pages/AdminPage.tsx` และไฟล์ในโฟลเดอร์เดียวกันที่ import กันเอง เช่น `AdminTopUpTab` import `AdminTopUpProviders`)
3. ตรวจ TypeScript ให้ผ่านหลัง refactor

## ผลที่ได้

- แต่ละหมวดแยกกันชัดเจน ค้นและแก้ไขง่ายขึ้น
- ไม่กระทบ logic ใด ๆ — เป็นการจัดโครงสร้างล้วน ๆ
- Path pattern: `@/components/admin/<หมวด>/<ชื่อไฟล์>`

## ขอยืนยัน

- โอเคกับผังหมวดข้างต้นไหมครับ? ถ้าอยากปรับ (เช่น รวม/แยก หมวดไหน หรือย้ายไฟล์ข้ามหมวด) แจ้งได้เลย
- ให้ผมเริ่มทำได้เลย หรือขอปรับผังก่อน?

