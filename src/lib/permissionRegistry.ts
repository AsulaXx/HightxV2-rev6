// Central registry of every feature permission the app knows about.
// Used by AdminRoleAccessTab to render the toggle matrix, and by
// `useHasFeature()` to gate UI throughout the app.
//
// Adding a new gate: add an entry here + call `useHasFeature("your.id")`
// at the guard site. Owner is ALWAYS granted (see useHasFeature).

import type { UserRole } from "@/contexts/AuthContext";

export interface FeaturePermission {
  id: string;
  label: string;
  description?: string;
  /** Roles that get this permission by default when settings haven't been customised. */
  defaultRoles: UserRole[];
}

export interface PermissionGroup {
  id: string;
  label: string;
  items: FeaturePermission[];
}

// Convenience role sets
const ALL: UserRole[] = ["owner", "admin", "moderator", "reseller", "hightxcrew", "vip", "user"];
const STAFF_UP: UserRole[] = ["owner", "admin", "moderator", "hightxcrew"];
const MOD_UP: UserRole[] = ["owner", "admin", "moderator"];
const ADMIN_UP: UserRole[] = ["owner", "admin"];
const OWNER_ONLY: UserRole[] = ["owner"];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "shop",
    label: "ร้านค้า & การซื้อ",
    items: [
      { id: "page.store", label: "ร้านค้า / กดคีย์", defaultRoles: ALL },
      { id: "shop.reseller_price", label: "ซื้อราคาตัวแทน", defaultRoles: ["owner", "admin", "reseller"] },
      { id: "shop.free_claim", label: "กดคีย์ฟรี", defaultRoles: ["owner", "admin", "moderator", "hightxcrew"] },
      { id: "page.history", label: "หน้าประวัติการกด", defaultRoles: ALL },
    ],
  },
  {
    id: "wallet",
    label: "กระเป๋าเงิน & เติมเงิน",
    items: [
      { id: "page.topup", label: "เติมเงิน", defaultRoles: ALL },
      { id: "page.wallet", label: "กระเป๋าเงิน / ยอดเงิน", defaultRoles: ALL },
      { id: "page.wallet_history", label: "ประวัติกระเป๋า (ทั้งระบบ)", defaultRoles: ADMIN_UP },
      { id: "page.customer_balances", label: "ยอดเงินลูกค้า", defaultRoles: ADMIN_UP },
    ],
  },
  {
    id: "dashboard_page",
    label: "หน้า Dashboard",
    items: [
      { id: "page.dashboard", label: "เข้าหน้า Dashboard", defaultRoles: STAFF_UP },
      { id: "page.analytics", label: "หน้า Analytics", defaultRoles: MOD_UP },
    ],
  },
  {
    id: "dashboard_sections",
    label: "Section ใน Dashboard",
    items: [
      { id: "dash.today_sales", label: "ยอดขายวันนี้", defaultRoles: STAFF_UP },
      { id: "dash.summary_cards", label: "การ์ดสรุปภาพรวม", defaultRoles: STAFF_UP },
      { id: "dash.low_stock", label: "สินค้าใกล้หมด", defaultRoles: MOD_UP },
      { id: "dash.recent_keys", label: "คีย์ที่กดล่าสุด", defaultRoles: MOD_UP },
      { id: "dash.users_breakdown", label: "สรุปผู้ใช้แยกยศ", defaultRoles: ADMIN_UP },
      { id: "dash.wallet_tx", label: "ธุรกรรมกระเป๋า", defaultRoles: ADMIN_UP },
      { id: "dash.topup_breakdown", label: "สรุปการเติมเงิน", defaultRoles: ADMIN_UP },
      { id: "dash.wheel_activity", label: "กิจกรรมวงล้อ", defaultRoles: MOD_UP },
      { id: "dash.thunder_quota", label: "โควต้า Thunder", defaultRoles: STAFF_UP },
      { id: "dash.purchase_analytics", label: "วิเคราะห์การซื้อ", defaultRoles: MOD_UP },
      { id: "dash.daily_claim_breakdown", label: "แยกการกดรายวัน", defaultRoles: MOD_UP },
    ],
  },
  {
    id: "tools",
    label: "เครื่องมือ",
    items: [
      { id: "page.stock", label: "จัดการสต็อก", defaultRoles: STAFF_UP },
      { id: "page.key_management", label: "จัดการคีย์", defaultRoles: MOD_UP },
      { id: "page.archived_keys", label: "คีย์ที่เก็บถาวร", defaultRoles: MOD_UP },
      { id: "page.wheel", label: "หมุนวงล้อ", defaultRoles: ALL },
      { id: "page.wheel_history", label: "ประวัติวงล้อ", defaultRoles: STAFF_UP },
      { id: "page.ruzien_bypass", label: "Ruzien Bypass", defaultRoles: OWNER_ONLY },
      { id: "page.leaderboard", label: "Leaderboard", defaultRoles: ALL },
      { id: "page.referral_dashboard", label: "แดชบอร์ด Referral", defaultRoles: ALL },
    ],
  },
  {
    id: "history",
    label: "ประวัติ / รายงาน",
    items: [
      { id: "page.all_claim_history", label: "ประวัติกดทั้งหมด", defaultRoles: MOD_UP },
      { id: "page.all_topup_history", label: "ประวัติเติมเงินทั้งหมด", defaultRoles: ADMIN_UP },
      { id: "page.all_user_history", label: "ประวัติผู้ใช้ทั้งหมด", defaultRoles: ADMIN_UP },
      { id: "page.all_wheel_history", label: "ประวัติวงล้อทั้งหมด", defaultRoles: MOD_UP },
      { id: "page.activity_log", label: "Audit / Activity Log", defaultRoles: ADMIN_UP },
      { id: "page.link_analytics", label: "วิเคราะห์คลิกลิ้งค์", defaultRoles: MOD_UP },
      { id: "page.banned_users", label: "รายชื่อผู้ถูกแบน", defaultRoles: ADMIN_UP },
    ],
  },
  {
    id: "admin_tabs",
    label: "แท็บใน Admin (/admin)",
    items: [
      { id: "admin.tab.general", label: "ทั่วไป", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.branding", label: "Branding", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.theme", label: "ธีม", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.layout", label: "เลย์เอาท์", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.music", label: "เพลง", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.legal", label: "ข้อตกลง", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.categories", label: "หมวดหมู่", defaultRoles: MOD_UP },
      { id: "admin.tab.products", label: "สินค้า", defaultRoles: MOD_UP },
      { id: "admin.tab.keys", label: "ระบบคีย์", defaultRoles: MOD_UP },
      { id: "admin.tab.quicknav", label: "Quick Nav", defaultRoles: MOD_UP },
      { id: "admin.tab.services", label: "บริการ", defaultRoles: MOD_UP },
      { id: "admin.tab.wheels", label: "วงล้อสุ่ม", defaultRoles: MOD_UP },
      { id: "admin.tab.wheelclaims", label: "ตรวจ Wheel Claims", defaultRoles: ADMIN_UP },
      { id: "admin.tab.ruzienbypass", label: "Ruzien Bypass", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.topup", label: "เติมเงิน", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.discount", label: "ส่วนลด", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.coupons", label: "คูปอง", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.viptier", label: "VIP Tier", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.referral", label: "Referral", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.leaderboard", label: "Leaderboard", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.users", label: "จัดการยศ", defaultRoles: ADMIN_UP },
      { id: "admin.tab.permissions", label: "ตารางสิทธิ์ (เดิม)", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.roleaccess", label: "Role Access", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.transactions", label: "ธุรกรรม", defaultRoles: ADMIN_UP },
      { id: "admin.tab.linkpages", label: "ลิ้งค์รวม", defaultRoles: ADMIN_UP },
      { id: "admin.tab.auditlog", label: "Audit Log", defaultRoles: ADMIN_UP },
      { id: "admin.tab.webhook", label: "Webhook", defaultRoles: ADMIN_UP },
      { id: "admin.tab.datareset", label: "รีเซ็ตข้อมูล", defaultRoles: OWNER_ONLY },
      { id: "admin.tab.backup", label: "สำรองข้อมูล", defaultRoles: OWNER_ONLY },
    ],
  },
];

/** Flat map of every permission id → default role list */
export const DEFAULT_FEATURE_MAP: Record<string, UserRole[]> = (() => {
  const m: Record<string, UserRole[]> = {};
  for (const g of PERMISSION_GROUPS) for (const p of g.items) m[p.id] = p.defaultRoles;
  return m;
})();

/** All ids in a flat list, in registration order */
export const ALL_FEATURE_IDS: string[] = Object.keys(DEFAULT_FEATURE_MAP);

/** Build the default role-permissions map (used to seed settings) */
export function buildDefaultRoleFeatures(): Record<UserRole, string[]> {
  const out: Record<string, string[]> = {
    owner: [], admin: [], moderator: [], reseller: [], hightxcrew: [], vip: [], user: [],
  };
  for (const [id, roles] of Object.entries(DEFAULT_FEATURE_MAP)) {
    for (const r of roles) out[r].push(id);
  }
  // Owner always gets everything even if a permission forgot to list them
  out.owner = Array.from(new Set([...out.owner, ...ALL_FEATURE_IDS]));
  return out as Record<UserRole, string[]>;
}
