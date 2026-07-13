import React, { createContext, useContext, useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { TENANT_BRAND, TENANT_THEME, TENANT_HERO, TENANT_DEFAULT_CATEGORIES, TENANT_URLS } from "@/lib/tenantConfig";

export type ParticleMode = "default" | "snow" | "stars" | "bubbles";
export type BackgroundEffect = "none" | "grid" | "dots" | "waves" | "aurora" | "matrix";
export type LoaderStyle = "atom" | "ring" | "dots" | "bars" | "pulse" | "orbit";
export type PerformanceModeSetting = "auto" | "high" | "balanced" | "saver";

export interface ParticlesConfig {
  enabled: boolean;
  mode: ParticleMode;
  count: number;
  speed: number;
  size: number;
  color: string;
  opacity: number;
  linked: boolean;
  linkDistance: number;
}

export interface BackgroundEffectConfig {
  effect: BackgroundEffect;
  opacity: number;
  color?: string;
  speed?: number;
}

export interface Theme3DConfig {
  glow: number;
  tilt: number;
  gradientFrom: string;
  gradientTo: string;
}

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  accentColor: string;
  backgroundColor: string;
  backgroundLayerOrder: "image-on-top" | "color-on-top";
  particles?: ParticlesConfig;
  bgEffect?: BackgroundEffectConfig;
  loaderStyle?: LoaderStyle;
  commandPaletteEnabled?: boolean;
  performanceMode?: PerformanceModeSetting;
  fontHeading?: string;
  fontBody?: string;
  fx3d?: Theme3DConfig;
}

export interface SocialLink {
  id: string;
  label: string;
  url: string;
  iconUrl: string;
  showOnHome?: boolean;
  showOnNavbar?: boolean;
}

export interface ProductDuration {
  id: string;
  label: string;
  days: number;
  price: number;
  resellerPrice?: number;
  discountPercent?: number;
  resellerDiscountPercent?: number;
  maxPerUser?: number;
  cooldownHours?: number;
  cooldownEnabled?: boolean;
  maxPerClaim?: number;
  enabled?: boolean;
  /** เปิดโหมดลิงก์ — ปุ่มของตัวเลือกนี้จะกลายเป็นลิงก์ (ไม่หักเครดิต ไม่บันทึกประวัติ ไม่ใช้สต๊อก) */
  linkMode?: boolean;
  /** URL ที่จะพาไปเมื่อกดปุ่มในโหมดลิงก์ */
  redirectUrl?: string;
  /** ป้ายปุ่มลิงก์ (ค่าเริ่มต้น: "ไปที่ลิงก์") */
  redirectLabel?: string;
  /** เปิดในแท็บใหม่ (default: true) */
  redirectOpenInNewTab?: boolean;
}

export interface GiftCode {
  id: string;
  code: string;
  amount: number;
  maxUses: number;
  usedCount: number;
  enabled: boolean;
  expiresAt?: string;
}

export interface DiscountSettings {
  enabled: boolean;
  globalPercent: number;
  resellerGlobalPercent: number;
  applyTo: "all" | "selected";
  selectedProductIds: string[];
  resellerApplyTo: "all" | "selected";
  resellerSelectedProductIds: string[];
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minPurchase: number;
  maxDiscount: number;
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  perUserLimit: number;
  enabled: boolean;
  expiresAt: string;
  applicableProducts: string[];
  applyTo: "all" | "selected";
}

export interface BundleDiscount {
  id: string;
  name: string;
  /** Product IDs that must ALL appear in the cart for this bundle to apply. */
  requiredProductIds: string[];
  type: "percent" | "fixed";
  value: number;
  enabled: boolean;
}

export interface UserDiscountRule {
  id: string;
  userId: string;
  /** Display label shown in admin UI (snapshot of name/email). */
  userLabel?: string;
  /** "all" = applies to every product, "selected" = only listed productIds. */
  applyTo: "all" | "selected";
  productIds: string[];
  type: "percent" | "fixed";
  value: number;
  enabled: boolean;
}

export interface ReferralRewardTier {
  id: string;
  minReferrals: number;
  bonusReward: number;
  label: string;
  icon: string;
  color: string;
}

export interface ReferralSettings {
  enabled: boolean;
  referrerReward: number;
  refereeReward: number;
  maxReferrals: number;
  rewardType: "credit" | "discount_percent";
  leaderboardEnabled: boolean;
  rewardTiers: ReferralRewardTier[];
}

export interface VipTier {
  id: string;
  name: string;
  icon: string;
  minSpend: number;
  discountPercent: number;
  color: string;
}

export interface VipTierSettings {
  enabled: boolean;
  tiers: VipTier[];
}

export interface LeaderboardReward {
  id: string;
  rankFrom: number;
  rankTo: number;
  label: string;
  reward: string;
  color: string;
}

export interface LeaderboardSettings {
  enabled: boolean;
  rewards: LeaderboardReward[];
}

export interface TopUpSettings {
  enabled: boolean;
  bankSlipEnabled: boolean;
  truewalletEnabled: boolean;
  voucherEnabled: boolean;
  giftCodeEnabled: boolean;
  truewalletFeeEnabled: boolean;
  truewalletFeePercent: number;
  minTopUp: number;
  maxTopUp: number;
  noticeMessage?: string;
  noticeColor?: "amber" | "green" | "red" | "blue";
  noticeIcon?: "warning" | "info" | "success" | "megaphone" | "bell";
  qrEnabled?: boolean;
  qrProvider?: 'promptpay' | 'plernpay' | 'rdcw';
  qrPromptPayTarget?: string;
  qrExpireMinutes?: number;
}


export interface QuickNavItem {
  id: string;
  name: string;
  icon: string;
  imageUrl: string;
  bannerUrl: string;
  bannerHeight: number;
  gradient: string;
  url: string;
  enabled: boolean;
  order: number;
}

export type WheelPrizeType = "credit" | "product" | "custom" | "none";

export interface WheelPrize {
  id: string;
  label: string;
  weight: number;            // probability weight (>=0)
  rewardType: WheelPrizeType;
  creditAmount?: number;     // when rewardType = credit
  productId?: string;        // when rewardType = product
  productDurationId?: string;// id of the product duration (for matching keys in stock)
  productDays?: number;      // duration in days for product reward (0 = ไม่ระบุ)
  customNote?: string;       // free text reward
  stock: number;             // -1 = unlimited
  color?: string;            // hex/hsl for slice
  iconUrl?: string;
}

export interface WheelConfig {
  id: string;
  slug: string;              // /wheel/<slug>
  name: string;
  description: string;
  enabled: boolean;
  cost: number;              // 0 = free spin
  cooldownSeconds: number;   // 0 = none
  maxSpinsPerUser: number;   // 0 = unlimited
  bannerUrl?: string;
  prizes: WheelPrize[];
  order?: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  imageUrl: string;
  bannerUrl: string;
  gradient: string;
  url: string;
  enabled: boolean;
  order: number;
}

export type DisplayMode = "card" | "banner";

export type BannerLayout = "vertical" | "horizontal";

export type CategorySubDisplayMode = "drilldown" | "accordion";

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  imageUrl: string;
  bannerUrl: string;
  bannerHeight: number;
  gradient: string;
  enabled: boolean;
  order: number;
  /** Parent category id for nested categories. null/undefined = top-level. */
  parentId?: string | null;
  /** When true, this entry behaves as a product card (jumps to product listing) instead of expanding into children. */
  displayAsProduct?: boolean;
  /** How children of this category are revealed in the storefront. */
  subDisplayMode?: CategorySubDisplayMode;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Small thumbnail (auto-generated on upload) — used in grids/lists. Falls back to imageUrl. */
  thumbnailUrl?: string;
  durations: ProductDuration[];
  enabled: boolean;
  categoryId?: string;
  remark?: string;
  /** "available" = ขายปกติ, "unavailable" = ไม่พร้อมขาย, "updating" = กำลังอัพเดท */
  availability?: "available" | "unavailable" | "updating" | "hidden";
  availabilityMessage?: string;
  /** Open Graph (preview เวลาแชร์ลิงก์) — ปล่อยว่างจะ fallback */
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  /** true = ใช้รูปสินค้าเป็น OG image อัตโนมัติ (ค่าเริ่มต้น) */
  ogUseProductImage?: boolean;
  /** ลิงก์คลิปตัวอย่าง/คลิปสอน (YouTube, Drive, etc.) แสดงปุ่มใต้รูปสินค้าในหน้า /product */
  videoUrl?: string;
  /** ป้ายปุ่มของคลิป (ค่าเริ่มต้น: "ดูคลิปตัวอย่าง") */
  videoLabel?: string;
  /** ปุ่มหลังกดซื้อ สูงสุด 4 ปุ่ม (เช่น คลิปสอนติดตั้ง / ดาวน์โหลด) */
  postPurchaseButtons?: { label: string; url: string }[];
  /** สถานะสาธารณะของสินค้า แสดงในหน้า /product-status (เขียว/ส้ม/เหลือง/แดง) */
  publicStatus?: "safe" | "risky" | "updating" | "closed";
  /** ข้อความเพิ่มเติมใต้สถานะสาธารณะ (เช่น เหตุผล หรือคำเตือน) */
  publicStatusNote?: string;
  /** แสดงสินค้านี้ในหน้า /product-status หรือไม่ (default: true) */
  showOnStatusPage?: boolean;
}

export interface PermissionItem {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface RolePermissions {
  [roleId: string]: string[]; // role -> array of permission IDs
}

export interface LayoutConfig {
  // Category grid columns per breakpoint
  categoryCols: { mobile: number; tablet: number; desktop: number };
  // Product grid columns per breakpoint
  productCols: { mobile: number; tablet: number; desktop: number };
  // Featured product grid columns (homepage)
  featuredCols: { mobile: number; tablet: number; desktop: number };
  // Card style
  cardStyle: "default" | "compact" | "spacious";
  // Section spacing
  sectionSpacing: "compact" | "normal" | "spacious";
  // Card border radius
  cardRadius: "sm" | "md" | "lg" | "xl";
  // Show product image in store
  showProductImage: boolean;
  // Product card aspect ratio
  productImageRatio: "1:1" | "4:3" | "3:2" | "16:9";
  // How product image fills its frame
  productImageFit?: "cover" | "contain";
  // Frame mode: fixed compact height or use aspect ratio
  productImageDisplay?: "fixed" | "ratio";
  // Max container width
  maxWidth: "4xl" | "5xl" | "6xl" | "7xl" | "full";
  // Hub grid columns
  hubCols: { mobile: number; tablet: number; desktop: number };
  // Hide product duration options after N entries (0 = show all)
  productOptionsCollapseAfter?: number;
  // Product card visual variant
  productCardVariant?: "split" | "poster" | "compact";
}


export interface HeroBannerConfig {
  enabled: boolean;
  showLogo: boolean;
  logoSize: number;
  textLines: string[];
  fontPreset: string;
  fontSize: number;
  typingEnabled: boolean;
  typingSpeed: number;
  typingDelay: number;
  typingLoop: boolean;
  textColor: string;
  textColorMode: "solid" | "gradient";
  textGradientFrom: string;
  textGradientTo: string;
  textGradientDirection: string;
  textAlign: "left" | "center" | "right";
}

export interface TickerConfig {
  enabled: boolean;
  popupEnabled?: boolean;
  speed: number; // seconds for full loop
  selectedIds: string[]; // announcement IDs to show, empty = all
}

export interface BgMusicConfig {
  enabled: boolean;
  url: string;
  coverUrl: string;
  title: string;
  artist: string;
  startTime: number;
  autoPlay: boolean;
  defaultVolume?: number; // 0..1
}

interface MatchReceiverAccount {
  id: string;
  label: string;
  accountNumber: string;
  type: 'bank' | 'promptpay' | 'truewallet';
}

export type UIVersion = "v1";

export interface RuzienBypassDuration {
  id: string;
  label: string;
  days: number;
  price: number;
  enabled: boolean;
}

export interface RuzienBypassConfig {
  enabled: boolean;
  title: string;
  description: string;
  notice?: string;
  durations: RuzienBypassDuration[];
}

interface SiteSettings {
  uiVersion?: UIVersion;
  bankAccountInfo: string;
  matchReceiverAccount: string;
  matchReceiverAccounts: MatchReceiverAccount[];
  matchReceiverName: string;
  matchReceiverEnabled: boolean;
  brandName: string;
  subtitle: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroCTAText: string;
  heroCTALink: string;
  logoUrl: string;
  logoSize: number;
  faviconUrl: string;
  footerText: string;
  theme: ThemeSettings;
  keySystemEnabled: boolean;
  maxKeysPerUser: number;
  maxKeysPerClaim: number;
  discordWebhookUrl: string;
  webhookKeyClaim: string;
  webhookKeyClaimUrls: string[];
  webhookLowStock: string;
  webhookLowStockUrls: string[];
  webhookDailySummary: string;
  webhookDailySummaryUrls: string[];
  webhookLinkPage: string;
  webhookLinkPageUrls: string[];
  webhookTopUp: string;
  webhookTopUpUrls: string[];
  webhookPurchase: string;
  webhookPurchaseUrls: string[];
  webhookSlipVerify: string;
  webhookSlipVerifyUrls: string[];
  webhookSignup: string;
  webhookSignupUrls: string[];
  webhookLogin: string;
  webhookLoginUrls: string[];
  products: Product[];
  categories: ProductCategory[];
  quickNavItems: QuickNavItem[];
  lowStockThreshold: number;
  lowStockWebhookEnabled: boolean;
  /** Threshold used specifically for the "คีย์ใกล้หมด" webhook. If unset, falls back to lowStockThreshold. 0 = แจ้งเฉพาะตอนหมด */
  lowStockWebhookThreshold?: number;
  /** Only these product IDs will trigger the low-stock webhook. Empty/undefined = all products */
  lowStockWebhookProductIds?: string[];
  /** If true, only send webhook when a duration reaches 0 (ignores threshold) */
  lowStockWebhookOnlyZero?: boolean;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  lastDailySummaryDate: string;
  socialLinks: SocialLink[];
  showSocialLinksOnHome: boolean;
  permissions: PermissionItem[];
  rolePermissions: RolePermissions;
  homeSectionOrder: string[];
  homeSectionTitles: Record<string, string>;
  homeSectionSubtitles: Record<string, string>;
  homeSectionVisibility: Record<string, boolean>;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  ogSiteUrl: string;
  categoryDisplayMode: DisplayMode;
  categoryBannerLayout: BannerLayout;
  categoryBannerColumns: number;
  productDisplayMode: DisplayMode;
  layout: LayoutConfig;
  heroBanner: HeroBannerConfig;
  quickNavDisplayMode: DisplayMode;
  quickNavBannerLayout: BannerLayout;
  quickNavBannerColumns: number;
  ticker: TickerConfig;
  truewalletPhone: string;
  thunderApiKey: string;
  thunderQuotaThreshold: number;
  slipProvider?: 'thunder' | 'slip2go' | 'rdcw' | 'plernpay';
  truewalletProvider?: 'thunder' | 'slip2go' | 'rdcw' | 'plernpay';
  serviceItems: ServiceItem[];
  topUp: TopUpSettings;
  giftCodes: GiftCode[];
  discount: DiscountSettings;
  featuredCount: number;
  bgMusic: BgMusicConfig;
  tosContent: string;
  tosContentEn: string;
  privacyContent: string;
  privacyContentEn: string;
  coupons: Coupon[];
  bundleDiscounts: BundleDiscount[];
  userDiscounts?: UserDiscountRule[];
  referral: ReferralSettings;
  vipTiers: VipTierSettings;
  leaderboard: LeaderboardSettings;
  
  autoBanEnabled: boolean;
  autoBanMaxAttempts: number;
  autoBanWindowHours: number;
  autoBanIncludeWrongAccount: boolean;
  autoBanIncludeDuplicate: boolean;
  bankAccounts: { id: string; bankName: string; accountName: string; accountNumber: string; type: string; enabled: boolean }[];
  wheels: WheelConfig[];
  claimCooldownHours: number;
  cooldownEnabled: boolean;
  ruzienBypass?: RuzienBypassConfig;
  /** New granular per-role feature flags (permissionRegistry). Undefined = fall back to defaults. */
  roleFeatures?: Record<string, string[]>;
}


interface SiteSettingsContextType {
  settings: SiteSettings;
  updateSettings: (newSettings: Partial<SiteSettings>) => void;
  loading: boolean;
}

const defaultTheme: ThemeSettings = {
  primaryColor: TENANT_THEME.primaryHsl,
  secondaryColor: TENANT_THEME.secondaryHsl,
  accentColor: TENANT_THEME.accentHsl,
  backgroundImage: "",
  backgroundOpacity: 0.3,
  backgroundBlur: 0,
  backgroundColor: "",
  backgroundLayerOrder: "image-on-top",
  bgEffect: { effect: "none", opacity: 0.35, color: "auto", speed: 1 },
  loaderStyle: "atom",
  commandPaletteEnabled: true,
  performanceMode: "auto",
  fx3d: {
    glow: 55,
    tilt: 3,
    gradientFrom: "#6366f1",
    gradientTo: "#a855f7",
  },
};

const DEFAULT_PERMISSIONS: PermissionItem[] = [
  // ── ร้านค้า & การซื้อ ──
  { id: "store", label: "ร้านค้า / กดคีย์", description: "เลือกสินค้าและระยะเวลาเพื่อรับคีย์", icon: "store" },
  { id: "store_reseller_price", label: "ซื้อราคาตัวแทน", description: "เห็นและซื้อสินค้าในราคาพิเศษสำหรับตัวแทน", icon: "store_reseller_price" },
  { id: "store_free_claim", label: "กดคีย์ฟรี", description: "กดคีย์ได้โดยไม่ต้องใช้เครดิต", icon: "store_free_claim" },
  { id: "history", label: "ประวัติการกด", description: "ดูคีย์ที่เคยกดไปแล้วทั้งหมด", icon: "history" },

  // ── กระเป๋าเงิน & เติมเงิน ──
  { id: "topup", label: "เติมเงิน", description: "เติมเงินเข้ากระเป๋า (TrueWallet, สลิป, Gift Code)", icon: "topup" },
  { id: "wallet", label: "กระเป๋าเงิน", description: "ดูยอดเงินและประวัติธุรกรรม", icon: "wallet" },

  // ── Dashboard & วิเคราะห์ ──
  { id: "dashboard", label: "Dashboard", description: "ภาพรวมระบบ สถิติการกดคีย์ และจำนวนผู้ใช้", icon: "dashboard" },
  { id: "dashboard_recent_keys", label: "ดูคีย์ล่าสุด", description: "ดูรายการคีย์ที่ถูกกดล่าสุดใน Dashboard", icon: "dashboard_recent_keys" },
  { id: "analytics", label: "วิเคราะห์ยอดขาย", description: "วิเคราะห์ข้อมูลการขายแบบละเอียด พร้อมกราฟและสถิติ", icon: "analytics" },

  // ── จัดการสต็อก & คีย์ ──
  { id: "stock", label: "จัดการสต็อก", description: "แปลงรหัสสินค้า จัดการสต็อก และเครื่องมือต่างๆ", icon: "stock" },
  { id: "key_management", label: "จัดการคีย์", description: "เพิ่ม/ลบ คีย์ในระบบ", icon: "key_management" },

  // ── ลิ้งค์ & ประกาศ ──
  { id: "link_pages", label: "ลิ้งค์รวม", description: "สร้างและจัดการหน้าลิ้งค์รวม (LinkTree)", icon: "link_pages" },
  { id: "announcement_manage", label: "จัดการประกาศ", description: "สร้าง แก้ไข และลบประกาศในระบบ", icon: "announcement_manage" },

  // ── ผู้ดูแล ──
  { id: "user_management", label: "จัดการยศ", description: "จัดการยศและสิทธิ์ของสมาชิกทั้งหมด", icon: "user_management" },
  { id: "activity_log", label: "บันทึกกิจกรรม", description: "ดู Log การใช้งานของทุกคนในระบบ", icon: "activity_log" },
  { id: "all_claim_history", label: "ประวัติกดทั้งหมด", description: "ดูประวัติการกดคีย์ของผู้ใช้ทุกคน", icon: "all_claim_history" },
  { id: "site_settings", label: "ตั้งค่าเว็บไซต์", description: "ตั้งค่าเว็บไซต์ ธีม และระบบทั้งหมด", icon: "site_settings" },
];

const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  user: ["store", "history", "topup", "wallet"],
  vip: ["store", "history", "topup", "wallet", "analytics"],
  hightxcrew: ["store", "store_free_claim", "history", "topup", "wallet", "analytics", "stock", "dashboard", "dashboard_recent_keys"],
  reseller: ["store", "store_reseller_price", "history", "topup", "wallet", "analytics", "stock", "dashboard", "dashboard_recent_keys"],
  moderator: ["store", "store_free_claim", "history", "topup", "wallet", "analytics", "stock", "dashboard", "dashboard_recent_keys", "key_management", "link_pages", "announcement_manage", "activity_log", "all_claim_history"],
  admin: ["store", "store_free_claim", "store_reseller_price", "history", "topup", "wallet", "analytics", "stock", "dashboard", "dashboard_recent_keys", "key_management", "link_pages", "announcement_manage", "user_management", "activity_log", "all_claim_history"],
  owner: ["store", "store_free_claim", "store_reseller_price", "history", "topup", "wallet", "analytics", "stock", "dashboard", "dashboard_recent_keys", "key_management", "link_pages", "announcement_manage", "user_management", "activity_log", "all_claim_history", "site_settings"],
};

const defaultSettings: SiteSettings = {
  uiVersion: "v1",
  bankAccountInfo: "",
  matchReceiverAccount: "",
  matchReceiverAccounts: [],
  matchReceiverName: "",
  matchReceiverEnabled: true,
  brandName: TENANT_BRAND.name,
  subtitle: TENANT_BRAND.subtitle,
  heroTitle: TENANT_BRAND.name,
  heroSubtitle: "",
  heroImageUrl: "",
  heroCTAText: TENANT_HERO.ctaText,
  heroCTALink: TENANT_HERO.ctaLink,
  logoUrl: "",
  logoSize: 32,
  faviconUrl: "",
  footerText: TENANT_BRAND.footerText,
  theme: defaultTheme,
  keySystemEnabled: false,
  maxKeysPerUser: 0,
  maxKeysPerClaim: 0,
  discordWebhookUrl: "",
  webhookKeyClaim: "",
  webhookKeyClaimUrls: [],
  webhookLowStock: "",
  webhookLowStockUrls: [],
  webhookDailySummary: "",
  webhookDailySummaryUrls: [],
  webhookLinkPage: "",
  webhookLinkPageUrls: [],
  webhookTopUp: "",
  webhookTopUpUrls: [],
  webhookPurchase: "",
  webhookPurchaseUrls: [],
  webhookSlipVerify: "",
  webhookSlipVerifyUrls: [],
  webhookSignup: "",
  webhookSignupUrls: [],
  webhookLogin: "",
  webhookLoginUrls: [],
  products: [],
  categories: TENANT_DEFAULT_CATEGORIES.map((cat, i) => ({
    ...cat,
    description: "",
    imageUrl: "",
    bannerUrl: "",
    bannerHeight: 128,
    enabled: true,
    order: i,
  })),
  lowStockThreshold: 5,
  lowStockWebhookEnabled: true,
  lowStockWebhookThreshold: 5,
  lowStockWebhookProductIds: [],
  lowStockWebhookOnlyZero: false,
  dailySummaryEnabled: true,
  dailySummaryTime: "23:00",
  lastDailySummaryDate: "",
  socialLinks: [],
  showSocialLinksOnHome: true,
  permissions: DEFAULT_PERMISSIONS,
  rolePermissions: DEFAULT_ROLE_PERMISSIONS,
  homeSectionOrder: [],
  homeSectionTitles: {},
  homeSectionSubtitles: {},
  homeSectionVisibility: {},
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogType: "website",
  ogSiteUrl: TENANT_URLS.siteUrl,
  categoryDisplayMode: "card",
  categoryBannerLayout: "vertical",
  categoryBannerColumns: 2,
  productDisplayMode: "card",
  layout: {
    categoryCols: { mobile: 2, tablet: 3, desktop: 4 },
    productCols: { mobile: 1, tablet: 2, desktop: 2 },
    featuredCols: { mobile: 2, tablet: 3, desktop: 4 },
    cardStyle: "default",
    sectionSpacing: "normal",
    cardRadius: "xl",
    showProductImage: true,
    productImageRatio: "3:2",
    productImageFit: "cover",
    productImageDisplay: "fixed",
    maxWidth: "7xl",
    hubCols: { mobile: 1, tablet: 2, desktop: 3 },
    productOptionsCollapseAfter: 4,
  },
  heroBanner: {
    enabled: true,
    showLogo: true,
    logoSize: 48,
    textLines: TENANT_HERO.textLines,
    fontPreset: "Inter",
    fontSize: 24,
    typingEnabled: true,
    typingSpeed: 80,
    typingDelay: 1500,
    typingLoop: true,
    textColor: "",
    textColorMode: "solid",
    textGradientFrom: "#6366f1",
    textGradientTo: "#ec4899",
    textGradientDirection: "to right",
    textAlign: "center",
  },
  quickNavItems: [],
  quickNavDisplayMode: "card",
  quickNavBannerLayout: "horizontal",
  quickNavBannerColumns: 2,
  ticker: {
    enabled: true,
    popupEnabled: true,
    speed: 30,
    selectedIds: [],
  },
  truewalletPhone: "",
  thunderApiKey: "",
  thunderQuotaThreshold: 100,
  slipProvider: 'thunder',
  truewalletProvider: 'thunder',
  serviceItems: [],
  topUp: {
    enabled: true,
    bankSlipEnabled: true,
    truewalletEnabled: true,
    voucherEnabled: true,
    giftCodeEnabled: false,
    truewalletFeeEnabled: false,
    truewalletFeePercent: 2.9,
    minTopUp: 0,
    maxTopUp: 0,
    qrEnabled: false,
    qrProvider: 'plernpay',
    qrPromptPayTarget: '',
    qrExpireMinutes: 15,
  },
  giftCodes: [],
  featuredCount: 8,
  discount: {
    enabled: false,
    globalPercent: 0,
    resellerGlobalPercent: 0,
    applyTo: "all",
    selectedProductIds: [],
    resellerApplyTo: "all",
    resellerSelectedProductIds: [],
  },
  bgMusic: {
    enabled: false,
    url: "",
    coverUrl: "",
    title: "",
    artist: "",
    startTime: 0,
    autoPlay: true,
    defaultVolume: 0.5,
  },
  tosContent: "",
  tosContentEn: "",
  privacyContent: "",
  privacyContentEn: "",
  coupons: [],
  bundleDiscounts: [],
  userDiscounts: [],
  referral: {
    enabled: false,
    referrerReward: 10,
    refereeReward: 10,
    maxReferrals: 50,
    rewardType: "credit",
    leaderboardEnabled: true,
    rewardTiers: [
      { id: "t1", minReferrals: 5, bonusReward: 20, label: "Bronze Referrer", icon: "🥉", color: "from-amber-600 to-amber-800" },
      { id: "t2", minReferrals: 15, bonusReward: 50, label: "Silver Referrer", icon: "🥈", color: "from-gray-400 to-gray-600" },
      { id: "t3", minReferrals: 30, bonusReward: 100, label: "Gold Referrer", icon: "🥇", color: "from-yellow-400 to-amber-500" },
      { id: "t4", minReferrals: 50, bonusReward: 200, label: "Diamond Referrer", icon: "💎", color: "from-cyan-400 to-blue-500" },
    ],
  },
  vipTiers: {
    enabled: false,
    tiers: [
      { id: "bronze", name: "Bronze", icon: "🥉", minSpend: 500, discountPercent: 3, color: "from-amber-600 to-amber-800" },
      { id: "silver", name: "Silver", icon: "🥈", minSpend: 2000, discountPercent: 5, color: "from-gray-400 to-gray-600" },
      { id: "gold", name: "Gold", icon: "🥇", minSpend: 5000, discountPercent: 8, color: "from-yellow-400 to-amber-500" },
      { id: "diamond", name: "Diamond", icon: "💎", minSpend: 15000, discountPercent: 12, color: "from-cyan-400 to-blue-500" },
    ],
  },
  leaderboard: {
    enabled: true,
    rewards: [
      { id: "r1", rankFrom: 1, rankTo: 1, label: "🥇 อันดับ 1", reward: "ส่วนลด 20% ทั้งร้าน + Badge พิเศษ", color: "from-yellow-400 to-amber-500" },
      { id: "r2", rankFrom: 2, rankTo: 2, label: "🥈 อันดับ 2", reward: "ส่วนลด 15% ทั้งร้าน", color: "from-gray-300 to-gray-400" },
      { id: "r3", rankFrom: 3, rankTo: 3, label: "🥉 อันดับ 3", reward: "ส่วนลด 10% ทั้งร้าน", color: "from-orange-400 to-amber-600" },
      { id: "r4", rankFrom: 4, rankTo: 10, label: "🏅 Top 10", reward: "ส่วนลด 5% ทั้งร้าน", color: "from-blue-400 to-indigo-500" },
    ],
  },
  autoBanEnabled: true,
  autoBanMaxAttempts: 3,
  autoBanWindowHours: 24,
  autoBanIncludeWrongAccount: true,
  autoBanIncludeDuplicate: true,
  bankAccounts: [],
  wheels: [],
  claimCooldownHours: 0,
  cooldownEnabled: true,
  ruzienBypass: {
    enabled: true,
    title: "Ruizen Bypass UID",
    description: "กรอก UID และเลือกจำนวนวันเพื่อรับคีย์",
    notice: "",
    durations: [
      { id: "d1", label: "1 วัน", days: 1, price: 10, enabled: true },
      { id: "d7", label: "7 วัน", days: 7, price: 50, enabled: true },
      { id: "d30", label: "30 วัน", days: 30, price: 150, enabled: true },
    ],
  },
};

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
  loading: true,
});

export const useSiteSettings = () => useContext(SiteSettingsContext);

// Helper: check if a role has a specific permission
export const roleHasPermission = (settings: SiteSettings, role: string, permissionId: string): boolean => {
  const rp = settings.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
  // Safety: user and vip roles should NEVER have store_free_claim
  if ((role === 'user' || role === 'vip') && permissionId === 'store_free_claim') return false;
  return rp[role]?.includes(permissionId) ?? false;
};

export const DEFAULT_PERMISSIONS_LIST = DEFAULT_PERMISSIONS;
export const DEFAULT_ROLE_PERMISSIONS_MAP = DEFAULT_ROLE_PERMISSIONS;

const loadedFonts = new Set<string>();
const loadGoogleFont = (fontName: string) => {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, "+")}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
};

// SECURITY: never persist these to localStorage (webhooks, API keys, bank info, etc.)
// Source of truth = Firestore; UI re-hydrates on load.
const SENSITIVE_KEYS = new Set<string>([
  "discordWebhookUrl", "thunderApiKey",
  "bankAccountInfo", "bankAccounts",
  "matchReceiverAccount", "matchReceiverAccounts", "matchReceiverName",
  "truewalletPhone", "giftCodes", "coupons",
  "topUp", "ruzienBypass", "referral",
]);
const sanitizeForStorage = (s: SiteSettings): Partial<SiteSettings> => {
  const out: any = { ...s };
  for (const k of Object.keys(out)) {
    if (SENSITIVE_KEYS.has(k) || /^webhook/i.test(k)) delete out[k];
  }
  return out;
};
// One-time purge of legacy cache (which contained webhooks/keys in plaintext)
const LEGACY_PURGE_FLAG = "hx-site-settings-purged-v1";
if (typeof window !== "undefined" && !localStorage.getItem(LEGACY_PURGE_FLAG)) {
  try { localStorage.removeItem("hx-site-settings"); } catch {}
  try { localStorage.setItem(LEGACY_PURGE_FLAG, "1"); } catch {}
}

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    const saved = localStorage.getItem("hx-site-settings");
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "settings", "site");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<SiteSettings>;
        setSettings((prev) => ({
          ...prev,
          ...data,
          theme: { ...defaultTheme, ...prev.theme, ...(data.theme || {}) },
          products: data.products ?? prev.products ?? [],
          categories: data.categories ?? prev.categories ?? defaultSettings.categories,
          socialLinks: data.socialLinks ?? prev.socialLinks ?? [],
          permissions: data.permissions ?? prev.permissions ?? DEFAULT_PERMISSIONS,
          rolePermissions: data.rolePermissions ?? prev.rolePermissions ?? DEFAULT_ROLE_PERMISSIONS,
        }));
      }
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Only cache non-sensitive UI fields (theme/branding/layout) for fast first paint.
    try {
      localStorage.setItem("hx-site-settings", JSON.stringify(sanitizeForStorage(settings)));
    } catch { /* ignore quota */ }
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme.primaryColor) {
      root.style.setProperty("--primary", settings.theme.primaryColor);
      root.style.setProperty("--ring", settings.theme.primaryColor);
    }
    if (settings.theme.secondaryColor) {
      root.style.setProperty("--secondary", settings.theme.secondaryColor);
    }
    root.style.setProperty(
      "--gradient-primary",
      `linear-gradient(135deg, hsl(${settings.theme.primaryColor}) 0%, hsl(${settings.theme.secondaryColor}) 100%)`
    );
    root.style.setProperty(
      "--gradient-hero",
      `linear-gradient(135deg, hsl(${settings.theme.primaryColor}) 0%, hsl(${settings.theme.secondaryColor}) 50%, hsl(${settings.theme.accentColor || "300 70% 70%"}) 100%)`
    );
    // Apply font settings — supports comma-separated stacks like '"Inter", "Prompt"'
    const loadStack = (stack: string) => {
      stack.split(",").forEach((part) => {
        const name = part.trim().replace(/^["']|["']$/g, "");
        if (name && !/^(sans-serif|serif|monospace|system-ui|-apple-system)$/i.test(name)) {
          loadGoogleFont(name);
        }
      });
    };
    if (settings.theme.fontHeading) {
      root.style.setProperty("--font-heading", `${settings.theme.fontHeading}, sans-serif`);
      loadStack(settings.theme.fontHeading);
    }
    if (settings.theme.fontBody) {
      root.style.setProperty("--font-body", `${settings.theme.fontBody}, sans-serif`);
      loadStack(settings.theme.fontBody);
    }
  }, [settings.theme]);

  // Apply UI version (v1 = single skin)
  useEffect(() => {
    document.documentElement.setAttribute("data-ui-version", "v1");
  }, [settings.uiVersion]);

  // Apply 3D effect CSS variables (glow / tilt / gradient)
  useEffect(() => {
    const fx = settings.theme?.fx3d;
    const root = document.documentElement;
    const glow = Math.max(0, Math.min(100, fx?.glow ?? 55)) / 100;
    const tilt = Math.max(0, Math.min(8, fx?.tilt ?? 3));
    root.style.setProperty("--fx-glow", String(glow));
    root.style.setProperty("--fx-tilt", `${tilt}deg`);
    root.style.setProperty("--fx-grad-from", fx?.gradientFrom || "#6366f1");
    root.style.setProperty("--fx-grad-to", fx?.gradientTo || "#a855f7");
  }, [settings.theme?.fx3d]);

  // Apply OG meta tags from settings
  useEffect(() => {
    const setMeta = (property: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:")) {
          el.setAttribute("property", property);
        } else {
          el.setAttribute("name", property);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const ogTitle = settings.ogTitle || settings.brandName;
    const ogDesc = settings.ogDescription || settings.subtitle?.split("\n")[0] || "";
    document.title = ogTitle ? `${ogTitle} - Dashboard` : "Dashboard";
    setMeta("og:title", ogTitle);
    setMeta("og:description", ogDesc);
    setMeta("og:type", settings.ogType || "website");
    if (settings.ogImage) setMeta("og:image", settings.ogImage);
    setMeta("twitter:card", "summary_large_image");
    if (settings.ogImage) setMeta("twitter:image", settings.ogImage);
    setMeta("description", ogDesc);
  }, [settings.ogTitle, settings.ogDescription, settings.ogImage, settings.ogType, settings.brandName, settings.subtitle]);

  const updateSettings = async (newSettings: Partial<SiteSettings>) => {
    const merged = {
      ...settings,
      ...newSettings,
      theme: { ...settings.theme, ...(newSettings.theme || {}) },
    };
    setSettings(merged);
    try {
      await setDoc(doc(db, "settings", "site"), merged, { merge: true });
    } catch (err) {
      console.error("Failed to save settings to Firestore:", err);
    }
  };

  return (
    <SiteSettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {/* Background layers */}
      {(settings.theme.backgroundImage || settings.theme.backgroundColor) && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {/* Color layer */}
          {settings.theme.backgroundColor && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: `hsl(${settings.theme.backgroundColor})`,
                zIndex: settings.theme.backgroundLayerOrder === "color-on-top" ? 2 : 1,
              }}
            />
          )}
          {/* Image layer */}
          {settings.theme.backgroundImage && (
            <img
              src={settings.theme.backgroundImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: settings.theme.backgroundOpacity ?? 0.3,
                filter: settings.theme.backgroundBlur ? `blur(${settings.theme.backgroundBlur}px)` : undefined,
                zIndex: settings.theme.backgroundLayerOrder === "image-on-top" ? 2 : 1,
              }}
              referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
        </div>
      )}
      {children}
    </SiteSettingsContext.Provider>
  );
};
