/**
 * Compatibility re-export.
 * แหล่งความจริงเดียว = `/tenant.config.ts` ที่ root ของโปรเจกต์
 * ห้ามแก้ค่าที่ไฟล์นี้ — แก้ที่ root file แทน
 */
export {
  TENANT_BRAND,
  TENANT_URLS,
  TENANT_IMAGES,
  TENANT_THEME,
  TENANT_FIREBASE,
  TENANT_HERO,
  TENANT_DEFAULT_CATEGORIES,
  TENANT_BANK,
  TENANT_WEBHOOKS,
  TENANT_SOCIALS,
} from "../../tenant.config";
