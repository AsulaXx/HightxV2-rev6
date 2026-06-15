/**
 * HightX Booster API Client
 * เรียกผ่าน Edge Function เพื่อซ่อน API Key
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function callBoosterApi(payload: Record<string, string>, apiKeyOverride?: string) {
  const body: Record<string, string> = { ...payload };
  if (apiKeyOverride) body.apiKeyOverride = apiKeyOverride;

  const { getIdToken } = await import("@/lib/firebaseIdToken");
  body.idToken = await getIdToken();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/meelike-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "API Error");
  return json.data;
}

export interface BoosterService {
  service: string;
  name: string;
  type: string;
  rate: string;
  min: string;
  max: string;
  category: string;
  refill: boolean;
  cancel: boolean;
  description?: string;
}

export interface BoosterOrderResult {
  order: number;
}

export interface BoosterOrderStatus {
  charge: string;
  start_count: string;
  status: string;
  remains: string;
  currency: string;
}

export interface BoosterBalance {
  balance: string;
  currency: string;
}

/** ตั้งค่ากำไร — เก็บใน Firestore */
export interface BoosterProfitConfig {
  /** กำไรรวม % (ใช้เมื่อไม่มี category-specific) */
  globalMarkup: number;
  /** กำไรแยกตามหมวดหมู่ { "Instagram": 30, "TikTok": 50 } */
  categoryMarkup: Record<string, number>;
}

export const DEFAULT_PROFIT_CONFIG: BoosterProfitConfig = {
  globalMarkup: 20,
  categoryMarkup: {},
};

/** คำนวณราคาขายจริง (หลังบวกกำไร) */
export function getSellingRate(baseRate: number, category: string, config: BoosterProfitConfig): number {
  const markup = config.categoryMarkup[category] ?? config.globalMarkup;
  return baseRate * (1 + markup / 100);
}

/** ดึงรายการบริการทั้งหมด */
export const getServices = (apiKey?: string): Promise<BoosterService[]> =>
  callBoosterApi({ action: "services" }, apiKey);

/** สั่งซื้อบริการ */
export const addOrder = (params: {
  service: string;
  link: string;
  quantity: string;
  runs?: string;
  interval?: string;
}, apiKey?: string): Promise<BoosterOrderResult> =>
  callBoosterApi({ action: "add", ...params }, apiKey);

/** เช็คสถานะออเดอร์ */
export const getOrderStatus = (orderId: string, apiKey?: string): Promise<BoosterOrderStatus> =>
  callBoosterApi({ action: "status", order: orderId }, apiKey);

/** เช็คยอดเงินคงเหลือ (Admin only) */
export const getBalance = (apiKey?: string): Promise<BoosterBalance> =>
  callBoosterApi({ action: "balance" }, apiKey);

/** ขอ Refill */
export const refillOrder = (orderId: string, apiKey?: string) =>
  callBoosterApi({ action: "refill", order: orderId }, apiKey);

/** เช็คสถานะ Refill */
export const getRefillStatus = (refillId: string, apiKey?: string) =>
  callBoosterApi({ action: "refill_status", refill: refillId }, apiKey);

/** ยกเลิกออเดอร์ */
export const cancelOrder = (orderId: string, apiKey?: string) =>
  callBoosterApi({ action: "cancel", order: orderId }, apiKey);
