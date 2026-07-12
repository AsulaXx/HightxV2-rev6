
# Phase 10: Admin & Compliance — Full Rollout

ทำเรียงตาม priority 5 tracks. ทุก track deploy ได้อิสระ ไม่ break ของเดิม.

---

## 🔴 Track 1: Re-consent Gate + Consent Log (PDPA)

**เป้า:** เก็บหลักฐานว่า user ยอมรับ Terms/Privacy version ไหน + บังคับ re-accept เมื่อมีการอัปเดต

- เพิ่ม field `termsVersion`, `privacyVersion`, `updatedAt` ใน `settings/site` (แก้ผ่าน AdminLegalTab)
- เก็บ `acceptedTermsVersion`, `acceptedPrivacyVersion`, `acceptedAt` ใน user profile
- สร้าง collection `consentLogs/{autoId}` — uid, version, ip, ua, timestamp (audit trail)
- Component `ConsentGate.tsx` — ครอบ `App.tsx` หลัง login: ถ้า version ไม่ตรง → modal บังคับ accept ก่อนใช้งาน
- AdminLegalTab: ปุ่ม "Publish new version" bump version + timestamp

## 🔴 Track 2: Server-side Rate Limiting

**เป้า:** ปิดช่องโหว่ client-side bypass (ล้าง localStorage แล้วผ่าน)

- Collection `rateLimits/{uid}_{action}` — count, windowStart, blockedUntil
- Helper `src/lib/serverRateLimit.ts` — check + increment ใน Firestore transaction
- ใช้กับ actions สำคัญ: `claim_key`, `topup_submit`, `wheel_spin`, `ruzien_claim`
- Edge functions ที่มีอยู่ (`claim-keys`, `ruzien-bypass-claim`, `spin-wheel`): เพิ่ม server check ก่อน mutate
- Owner/Admin bypass ผ่าน role check
- แสดง countdown UI แทน error message (component `CooldownBadge.tsx`)

## 🟡 Track 3: Admin Tabs Hardening

**เป้า:** admin 30+ tabs โหลดเร็ว, tab เดียวพังไม่ล่มทั้งหน้า, หาง่ายขึ้น

- Lazy-load ทุก admin tab component ด้วย `React.lazy` + `Suspense`
- `AdminTabErrorBoundary.tsx` — wrap ทุก tab, แสดง fallback + reload button
- Tab search bar ใน AdminPage sidebar (filter by name)
- Pin favorite tabs — เก็บใน localStorage `admin_pinned_tabs`
- Permission-gate ระดับ tab (ซ่อนเลยถ้าไม่มีสิทธิ์ — ไม่ใช่แค่ block content)

## 🟡 Track 4: Audit Log Enhancement

**เป้า:** traceability ครบ + filter หายาก + retention

- เพิ่ม `ip`, `userAgent` ในทุก `logActivity()` call (helper อยู่แล้วใน `activityLogger.ts`)
- Settings action: เก็บ `beforeJson`, `afterJson` → diff view UI (สีแดง/เขียว)
- AdminAuditLogTab: เพิ่ม filter action-type dropdown + date range picker
- Auto-archive logs > 90 วัน (ใช้ pattern เดียวกับ archived-keys) via existing `cleanup-logs` edge function

## 🟢 Track 5: Permissions Matrix QoL

**เป้า:** จัดการ role/permission ง่ายขึ้น + มี audit trail

- Log ทุก permission mutation ลง `activityLogs` (action: `permission_change`)
- "View as role" — dropdown ให้ Owner ดู UI ในมุมของ role อื่น (session storage flag, view-only)
- Bulk toggle: checkbox column header + "toggle all in group"

---

## 📐 Technical Notes

**Data model additions:**
```
settings/site
  ├─ termsVersion: number
  ├─ privacyVersion: number
  └─ legalUpdatedAt: timestamp

users/{uid}
  ├─ acceptedTermsVersion: number
  └─ acceptedPrivacyVersion: number

consentLogs/{autoId}   ← new
rateLimits/{uid_action} ← new (TTL 24h via scheduled cleanup)
```

**Files ใหม่:**
- `src/components/ConsentGate.tsx`
- `src/components/CooldownBadge.tsx`
- `src/components/admin/AdminTabErrorBoundary.tsx`
- `src/lib/serverRateLimit.ts`
- `src/lib/consentLogger.ts`

**Files แก้:**
- `src/App.tsx` (ครอบ ConsentGate)
- `src/pages/AdminPage.tsx` (lazy load + search + pin)
- `src/components/admin/AdminLegalTab.tsx` (version publish button)
- `src/components/admin/AdminAuditLogTab.tsx` (filter + diff)
- `src/components/admin/AdminPermissionsTab.tsx` (log + bulk)
- `src/lib/activityLogger.ts` (ip/ua auto-inject)
- `src/pages/PermissionsPage.tsx` (view-as-role)
- Edge functions: `claim-keys`, `ruzien-bypass-claim`, `spin-wheel` (server rate check)

**Firestore rules:** เพิ่ม rules สำหรับ `consentLogs` (create-only by owner), `rateLimits` (server-only writes)

**Verify:** เปิด admin หลังสร้าง — ทุก tab โหลดได้, กด accept terms flow ครบ, rate limit ทำงานหลังล้าง localStorage

---

**ประมาณการ:** ~15-20 file changes, 5 new files, 1 migration (Firestore rules update). ทำเรียง Track 1→5, commit หลังจบแต่ละ track เพื่อให้ preview เห็นความคืบหน้า.
