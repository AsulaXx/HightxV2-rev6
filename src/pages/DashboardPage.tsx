import { useState, useEffect, lazy, Suspense } from "react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import type { DailyProductClaim } from "@/components/dashboard/DailyClaimBreakdown";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { db } from "@/lib/firebase";
import { collection, getDocs, getCountFromServer, query, where, orderBy, limit as firestoreLimit, doc, getDoc, setDoc } from "firebase/firestore";
import { cachedQuery, invalidateCache } from "@/lib/firestoreCache";
import { supabase } from "@/integrations/supabase/client";
import { toThaiDateKey, thaiNow } from "@/lib/utils";
import { classifyClaim } from "@/lib/claimClassifier";
import { Users, Key, TrendingUp, Clock, Shield, AlertTriangle, Package, Lock, Minimize2, Maximize2, Send, DollarSign, CalendarDays, ArrowUpRight, ArrowDownRight, Wallet, Gift, CreditCard, Banknote, Smartphone, BarChart3, Download, ListChecks, ShoppingCart, Zap, RefreshCw, Settings, RotateCcw } from "lucide-react";
const DailyClaimBreakdown = lazy(() => import("@/components/dashboard/DailyClaimBreakdown"));
const PurchaseAnalytics = lazy(() => import("@/components/dashboard/PurchaseAnalytics"));
const TodaySalesSummary = lazy(() => import("@/components/dashboard/TodaySalesSummary"));
const DashboardSummaryCards = lazy(() => import("@/components/dashboard/DashboardSummaryCards"));
const DashboardTopUpBreakdown = lazy(() => import("@/components/dashboard/DashboardTopUpBreakdown"));
const DashboardThunderQuota = lazy(() => import("@/components/dashboard/DashboardThunderQuota"));
const DashboardWheelActivity = lazy(() => import("@/components/dashboard/DashboardWheelActivity"));
import { ROLE_LABELS, type UserRole } from "@/contexts/AuthContext";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useCollapsible } from "@/hooks/useCollapsible";
import CollapsibleSection from "@/components/CollapsibleSection";
import { toast } from "sonner";
import * as XLSX from "xlsx";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Filler, Title, Tooltip, Legend);

interface ProductStat {
  productName: string;
  productId: string;
  durations: { label: string; durationId: string; claimed: number; available: number; freeClaimed: number; normalClaimed: number; resellerClaimed: number; wheelClaimed: number; paidRevenue: number; resellerRevenue: number }[];
  totalClaimed: number;
  totalAvailable: number;
  freeClaimed: number;
  paidClaimed: number;
  resellerClaimed: number;
  normalClaimed: number;
  wheelClaimed: number;
  paidRevenue: number;
  resellerRevenue: number;
}

interface DailyData {
  date: string;
  claims: number;
  revenue: number;
}

interface TopUpBreakdown {
  bank: { count: number; total: number };
  truewallet: { count: number; total: number };
  voucher: { count: number; total: number };
  giftcode: { count: number; total: number };
  admin: { count: number; total: number };
  other: { count: number; total: number };
}

const ProductClaimCard = ({ ps }: { ps: ProductStat }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-foreground">{ps.productName}</h4>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline">
          {expanded ? "ซ่อนตัวเลือก ▲" : `ดูตัวเลือก (${ps.durations.filter(d => d.claimed > 0).length}) ▼`}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">กดฟรี</p>
          <p className="text-xl font-bold text-emerald-400">{ps.freeClaimed}</p>
          <p className="text-[10px] text-muted-foreground">ชิ้น</p>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ซื้อราคาปกติ</p>
          <p className="text-xl font-bold text-blue-400">{ps.normalClaimed}</p>
          <p className="text-[10px] text-muted-foreground">฿{ps.paidRevenue.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ซื้อแบบตัวแทน</p>
          <p className="text-xl font-bold text-purple-400">{ps.resellerClaimed}</p>
          <p className="text-[10px] text-muted-foreground">฿{ps.resellerRevenue.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ซื้อรวม (มีรายได้)</p>
          <p className="text-xl font-bold text-amber-400">{ps.paidClaimed}</p>
          <p className="text-[10px] text-muted-foreground">฿{(ps.paidRevenue + ps.resellerRevenue).toLocaleString()}</p>
        </div>
      </div>
      {expanded && ps.durations.filter(d => d.claimed > 0).length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          <p className="text-[10px] font-semibold text-muted-foreground">📋 แยกตามตัวเลือก</p>
          {ps.durations.filter(d => d.claimed > 0).map((d) => (
            <div key={d.durationId} className="p-3 rounded-lg bg-muted/20 border border-border">
              <p className="text-xs font-semibold text-foreground mb-2">{d.label} <span className="text-muted-foreground font-normal">— กดทั้งหมด {d.claimed} ชิ้น</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                <div className="text-center p-2 rounded-lg bg-emerald-500/5">
                  <p className="text-[9px] text-muted-foreground">ฟรี</p>
                  <p className="text-sm font-bold text-emerald-400">{d.freeClaimed}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-500/5">
                  <p className="text-[9px] text-muted-foreground">ปกติ</p>
                  <p className="text-sm font-bold text-blue-400">{d.normalClaimed}</p>
                  <p className="text-[9px] text-muted-foreground">฿{d.paidRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-purple-500/5">
                  <p className="text-[9px] text-muted-foreground">ตัวแทน</p>
                  <p className="text-sm font-bold text-purple-400">{d.resellerClaimed}</p>
                  <p className="text-[9px] text-muted-foreground">฿{d.resellerRevenue.toLocaleString()}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-fuchsia-500/5">
                  <p className="text-[9px] text-muted-foreground">วงล้อ</p>
                  <p className="text-sm font-bold text-fuchsia-400">{d.wheelClaimed}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-amber-500/5">
                  <p className="text-[9px] text-muted-foreground">รวมรายได้</p>
                  <p className="text-sm font-bold text-amber-400">฿{(d.paidRevenue + d.resellerRevenue).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DashboardPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const { settings, updateSettings } = useSiteSettings();
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalClaimedKeys, setTotalClaimedKeys] = useState(0);
  const [totalAvailableKeys, setTotalAvailableKeys] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayClaims, setTodayClaims] = useState(0);
  const [revenueTrend, setRevenueTrend] = useState(0); // percent change
  const [roleBreakdown, setRoleBreakdown] = useState<Record<string, number>>({});
  const [recentClaims, setRecentClaims] = useState<any[]>([]);
  const [productStats, setProductStats] = useState<ProductStat[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<{ product: string; duration: string; available: number }[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<7 | 14 | 30>(7);
  const [dailyProductClaims, setDailyProductClaims] = useState<DailyProductClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [thunderInfo, setThunderInfo] = useState<any>(null);
  const [thunderLoading, setThunderLoading] = useState(false);
  const [thunderHistory, setThunderHistory] = useState<{ date: string; used: number; remaining: number }[]>([]);
  const [topUpBreakdown, setTopUpBreakdown] = useState<TopUpBreakdown>({
    bank: { count: 0, total: 0 }, truewallet: { count: 0, total: 0 },
    voucher: { count: 0, total: 0 }, giftcode: { count: 0, total: 0 },
    admin: { count: 0, total: 0 }, other: { count: 0, total: 0 },
  });

  const [showTopUp, toggleTopUp, setTopUpOpen] = useCollapsible("dash-topup", true);
  const [showDailyClaims, toggleDailyClaims, setDailyClaimsOpen] = useCollapsible("dash-dailyclaims", true);
  const [showProductBreakdown, toggleProductBreakdown, setProductBreakdownOpen] = useCollapsible("dash-productbreakdown", true);

  const [showPurchaseAnalytics, togglePurchaseAnalytics, setPurchaseAnalyticsOpen] = useCollapsible("dash-purchase-analytics", true);
  const [showLowStock, toggleLowStock, setLowStockOpen] = useCollapsible("dash-lowstock", true);
  const [showRevenue, toggleRevenue, setRevenueOpen] = useCollapsible("dash-revenue", true);
  const [showCharts, toggleCharts, setChartsOpen] = useCollapsible("dash-charts", true);
  const [showStockDetail, toggleStockDetail, setStockOpen] = useCollapsible("dash-stockdetail", true);
  const [showRoles, toggleRoles, setRolesOpen] = useCollapsible("dash-roles", true);
  const [showRecent, toggleRecent, setRecentOpen] = useCollapsible("dash-recent", true);
  const [showThunder, toggleThunder, setThunderOpen] = useCollapsible("dash-thunder", true);
  const [showWheel, toggleWheel] = useCollapsible("dash-wheel", true);
  const [showSettings, toggleSettings, setSettingsOpen] = useCollapsible("dash-settings", false);

  const collapseAll = () => { setPurchaseAnalyticsOpen(false); setLowStockOpen(false); setRevenueOpen(false); setChartsOpen(false); setStockOpen(false); setRolesOpen(false); setRecentOpen(false); setTopUpOpen(false); setProductBreakdownOpen(false); setDailyClaimsOpen(false); setThunderOpen(false); setSettingsOpen(false); };
  const expandAll = () => { setPurchaseAnalyticsOpen(true); setLowStockOpen(true); setRevenueOpen(true); setChartsOpen(true); setStockOpen(true); setRolesOpen(true); setRecentOpen(true); setTopUpOpen(true); setProductBreakdownOpen(true); setDailyClaimsOpen(true); setThunderOpen(true); setSettingsOpen(true); };

  const handleRefreshData = () => {
    invalidateCache(); // ล้างแคชทั้งหมด (รวม index-*, store-*, dash-*)
    setLoading(true);
    loadStats();
    loadThunderInfo();
    toast.success("รีเฟรชข้อมูลทั้งหมดแล้ว");
  };

  const handleResetCollapsible = () => {
    const keys = ["dash-topup", "dash-dailyclaims", "dash-productbreakdown", "dash-purchase-analytics", "dash-lowstock", "dash-revenue", "dash-charts", "dash-stockdetail", "dash-roles", "dash-recent", "dash-thunder", "dash-settings"];
    keys.forEach(k => localStorage.removeItem(`collapsible-${k}`));
    expandAll();
    toast.success("รีเซ็ตการแสดงผลแล้ว");
  };

  const canSeeRecentKeys = hasPermission("hightxcrew");

  const sendThunderLowQuotaWebhook = async (remaining: number, max: number, used: number) => {
    // Only send once per day
    const today = toThaiDateKey();
    const sentKey = `thunder-low-quota-sent-${today}`;
    if (localStorage.getItem(sentKey)) return;
    try {
      const { sendWebhook } = await import("@/lib/webhookSender");
      await sendWebhook(settings, "lowStock", [{
        title: '⚡ โควต้า Thunder API เหลือน้อย!',
        color: 0xff3333,
        fields: [
          { name: '📊 ใช้ไป', value: `${used.toLocaleString()} / ${max.toLocaleString()}`, inline: true },
          { name: '⚠️ คงเหลือ', value: `${remaining.toLocaleString()} ครั้ง`, inline: true },
          { name: '📈 เปอร์เซ็นต์', value: `${((used / max) * 100).toFixed(1)}%`, inline: true },
        ],
        footer: { text: settings.brandName || 'HightXClient' },
        timestamp: new Date().toISOString(),
      }]);
      localStorage.setItem(sentKey, '1');
    } catch (e) {
      console.error('Failed to send Thunder quota webhook:', e);
    }
  };

  const saveThunderSnapshot = async (used: number, remaining: number | null) => {
    const today = toThaiDateKey();
    try {
      await setDoc(doc(db, 'thunderUsage', today), {
        date: today,
        used,
        remaining: remaining ?? 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to save Thunder snapshot:', e);
    }
  };

  const loadThunderHistory = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'thunderUsage'), orderBy('date', 'desc'), firestoreLimit(30)));
      const history = snap.docs.map(d => d.data() as { date: string; used: number; remaining: number }).reverse();
      setThunderHistory(history);
    } catch (e) {
      console.error('Failed to load Thunder history:', e);
    }
  };

  const loadThunderInfo = async () => {
    // skip when Thunder isn't the active slip provider
    if ((settings.slipProvider || 'thunder') !== 'thunder') { setThunderInfo(null); return; }
    setThunderLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('thunder-info', {
        body: {}, // SECURITY: API key is server-side only (Deno.env.THUNDER_API_KEY)
      });
      if (error) throw error;
      if (data?.success) {
        setThunderInfo(data.data);
        const appQuota = data.data?.application?.quota;
        if (appQuota) {
          const used = appQuota.used ?? 0;
          const max = appQuota.max;
          const remaining = appQuota.remaining;
          // Save daily snapshot
          await saveThunderSnapshot(used, remaining);
          // Discord alert if low
          if (remaining !== null && remaining !== undefined && remaining < (settings.thunderQuotaThreshold || 100) && max) {
            await sendThunderLowQuotaWebhook(remaining, max, used);
          }
        }
        await loadThunderHistory();
      } else {
        setThunderInfo(null);
      }
    } catch (err) {
      console.error('Failed to load Thunder info:', err);
    } finally {
      setThunderLoading(false);
    }
  };

  // Auto-refresh every 30 seconds
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    if (user) { loadStats(); loadThunderInfo(); }
  }, [user, profile]);

  useEffect(() => {
    if (!autoRefreshEnabled || !user) return;
    const interval = setInterval(() => {
      invalidateCache();
      loadStats();
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, user]);

  const loadStats = async () => {
    try {
      const [usersSnap, keysSnap, txSnap, topUpSnap] = await Promise.all([
        cachedQuery("dash-users", () => getDocs(collection(db, "users")), 5 * 60 * 1000),
        cachedQuery("dash-keys", () => getDocs(collection(db, "keys")), 2 * 60 * 1000),
        cachedQuery("dash-tx", () => getDocs(collection(db, "walletTransactions")).catch(() => ({ docs: [] as any[] })), 5 * 60 * 1000),
        cachedQuery("dash-topup", () => getDocs(query(collection(db, "topUpHistory"), where("status", "==", "success"))).catch(() => ({ docs: [] as any[] })), 5 * 60 * 1000),
      ]);

      // Users
      const usersData = usersSnap.docs.map((d) => d.data());
      const rb: Record<string, number> = {};
      usersData.forEach((u) => { rb[u.role || "user"] = (rb[u.role || "user"] || 0) + 1; });
      setTotalUsers(usersData.length);
      setRoleBreakdown(rb);

      // Keys
      const allKeys = keysSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const claimedKeys = allKeys.filter((k: any) => k.claimed);
      const availableKeysArr = allKeys.filter((k: any) => !k.claimed);
      setTotalClaimedKeys(claimedKeys.length);
      setTotalAvailableKeys(availableKeysArr.length);

      // Calculate revenue from successful top-ups only (actual money received on website)
      const dailyMap: Record<string, { claims: number; revenue: number }> = {};

      // Initialize daily map for past N days using Thai timezone
      const now = thaiNow();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = toThaiDateKey(d);
        dailyMap[key] = { claims: 0, revenue: 0 };
      }

      // Count claims from keys
      const products = settings.products || [];
      claimedKeys.forEach((k: any) => {
        const claimedDate = k.claimedAt?.toDate?.() || (k.claimedAt ? new Date(k.claimedAt) : null);
        if (claimedDate) {
          const dateKey = toThaiDateKey(claimedDate);
          if (dailyMap[dateKey]) {
            dailyMap[dateKey].claims += 1;
          }
        }
      });

      // Daily product claims breakdown (grouped by product + duration)
      const dpMap: Record<string, Record<string, DailyProductClaim>> = {};
      claimedKeys.forEach((k: any) => {
        const claimedDate = k.claimedAt?.toDate?.() || (k.claimedAt ? new Date(k.claimedAt) : null);
        if (!claimedDate) return;
        const dateKey = toThaiDateKey(claimedDate);
        const pid = k.productId || "unknown";
        const did = k.durationId || "unknown";
        const pName = products.find((p) => p.id === pid)?.name || pid;
        const dLabel = products.find((p) => p.id === pid)?.durations.find((d) => d.id === did)?.label || did;
        const mapKey = `${pid}__${did}`;
        if (!dpMap[dateKey]) dpMap[dateKey] = {};
        if (!dpMap[dateKey][mapKey]) dpMap[dateKey][mapKey] = { date: dateKey, productName: pName, productId: pid, durationId: did, durationLabel: dLabel, free: 0, normal: 0, reseller: 0, wheel: 0, total: 0, revenue: 0 };
        const entry = dpMap[dateKey][mapKey];
        const bucket = classifyClaim(k);
        const kPrice = Number(k.price) || 0;
        if (bucket === "wheel") entry.wheel++;
        else if (bucket === "free") entry.free++;
        else if (bucket === "reseller") { entry.reseller++; entry.revenue += kPrice; }
        else { entry.normal++; entry.revenue += kPrice; }
        entry.total++;
      });
      setDailyProductClaims(Object.values(dpMap).flatMap((prods) => Object.values(prods)));

      // Revenue = only from successful top-ups on the website (actual money in)
      let totalRev = 0;
      const topUpDocs = topUpSnap.docs.map((d) => d.data());
      topUpDocs.forEach((tu: any) => {
        const amount = tu.amount || 0;
        totalRev += amount;
        const tuDate = tu.createdAt?.toDate?.() || (tu.createdAt ? new Date(tu.createdAt) : null);
        if (tuDate) {
          const dateKey = toThaiDateKey(tuDate);
          if (dailyMap[dateKey]) {
            dailyMap[dateKey].revenue += amount;
          }
        }
      });

      setTotalRevenue(totalRev);

      // Today stats
      const todayKey = toThaiDateKey();
      setTodayClaims(dailyMap[todayKey]?.claims || 0);
      setTodayRevenue(dailyMap[todayKey]?.revenue || 0);

      // Calculate trend (compare last 7 days vs previous 7 days)
      const sortedDays = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0]));
      const last7 = sortedDays.slice(-7).reduce((sum, [, v]) => sum + v.revenue, 0);
      const prev7 = sortedDays.slice(-14, -7).reduce((sum, [, v]) => sum + v.revenue, 0);
      const trend = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : (last7 > 0 ? 100 : 0);
      setRevenueTrend(Math.round(trend));

      // Set daily data
      setDailyData(
        Object.entries(dailyMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, v]) => ({ date, ...v }))
      );

      // Recent claims
      const recent = claimedKeys
        .sort((a: any, b: any) => {
          const da = a.claimedAt?.toDate?.() || new Date(a.claimedAt || 0);
          const db2 = b.claimedAt?.toDate?.() || new Date(b.claimedAt || 0);
          return db2.getTime() - da.getTime();
        })
        .slice(0, 10)
        .map((k: any) => ({
          userEmail: k.claimedByEmail || "Unknown",
          userName: k.claimedByName || "",
          productName: getProductName(k.productId),
          durationLabel: getDurationLabel(k.productId, k.durationId),
          key: k.key || "N/A",
          claimedAt: k.claimedAt?.toDate?.()
            ? k.claimedAt.toDate().toLocaleString("th-TH")
            : "ไม่ทราบ",
        }));
      setRecentClaims(recent);

      // Product stats
      const stats: ProductStat[] = [];
      const alerts: { product: string; duration: string; available: number }[] = [];

      for (const product of products) {
        if (!product.name) continue;
        const pStat: ProductStat = {
          productName: product.name,
          productId: product.id,
          durations: [],
          totalClaimed: 0,
          totalAvailable: 0,
          freeClaimed: 0,
          paidClaimed: 0,
          resellerClaimed: 0,
          normalClaimed: 0,
          wheelClaimed: 0,
          paidRevenue: 0,
          resellerRevenue: 0,
        };

        for (const dur of product.durations) {
          const productKeys = allKeys.filter((k: any) => k.productId === product.id && k.durationId === dur.id);
          const claimedProductKeys = productKeys.filter((k: any) => k.claimed);
          const claimed = claimedProductKeys.length;
          const available = productKeys.length - claimed;

          // Breakdown by classifier (per duration)
          let durFree = 0, durNormal = 0, durReseller = 0, durWheel = 0, durPaidRev = 0, durResellerRev = 0;
          claimedProductKeys.forEach((k: any) => {
            const bucket = classifyClaim(k);
            const kPrice = Number(k.price) || 0;
            if (bucket === "wheel") {
              pStat.wheelClaimed++;
              durWheel++;
            } else if (bucket === "free") {
              pStat.freeClaimed++;
              durFree++;
            } else if (bucket === "reseller") {
              pStat.paidClaimed++;
              pStat.resellerClaimed++;
              pStat.resellerRevenue += kPrice;
              durReseller++;
              durResellerRev += kPrice;
            } else {
              pStat.paidClaimed++;
              pStat.normalClaimed++;
              pStat.paidRevenue += kPrice;
              durNormal++;
              durPaidRev += kPrice;
            }
          });

          pStat.durations.push({ label: dur.label, durationId: dur.id, claimed, available, freeClaimed: durFree, normalClaimed: durNormal, resellerClaimed: durReseller, wheelClaimed: durWheel, paidRevenue: durPaidRev, resellerRevenue: durResellerRev });
          pStat.totalClaimed += claimed;
          pStat.totalAvailable += available;

          if (available <= (settings.lowStockThreshold || 5)) {
            alerts.push({ product: product.name, duration: dur.label, available });
          }
        }

        stats.push(pStat);
      }

      setProductStats(stats);
      setLowStockAlerts(alerts);

      // Top-up breakdown
      const tuBreakdown: TopUpBreakdown = {
        bank: { count: 0, total: 0 }, truewallet: { count: 0, total: 0 },
        voucher: { count: 0, total: 0 }, giftcode: { count: 0, total: 0 },
        admin: { count: 0, total: 0 }, other: { count: 0, total: 0 },
      };
      topUpSnap.docs.forEach((d) => {
        const data = d.data();
        const method = data.method || "";
        const amount = data.amount || 0;
        if (method === "truewallet") { tuBreakdown.truewallet.count++; tuBreakdown.truewallet.total += amount; }
        else if (method === "voucher") { tuBreakdown.voucher.count++; tuBreakdown.voucher.total += amount; }
        else if (method === "giftcode") { tuBreakdown.giftcode.count++; tuBreakdown.giftcode.total += amount; }
        else if (method === "admin") { tuBreakdown.admin.count++; tuBreakdown.admin.total += amount; }
        else if (amount > 0) { tuBreakdown.bank.count++; tuBreakdown.bank.total += amount; }
        else { tuBreakdown.other.count++; tuBreakdown.other.total += amount; }
      });
      setTopUpBreakdown(tuBreakdown);

      // Low stock webhook — respects per-webhook threshold / product allowlist / only-zero
      if (hasPermission("moderator")) {
        if (settings.lowStockWebhookEnabled) {
          // Recompute filtered alerts using webhook-specific settings
          const webhookThreshold = settings.lowStockWebhookOnlyZero
            ? 0
            : (typeof settings.lowStockWebhookThreshold === "number"
                ? settings.lowStockWebhookThreshold
                : (settings.lowStockThreshold || 5));
          const allowedIds: string[] = Array.isArray(settings.lowStockWebhookProductIds)
            ? settings.lowStockWebhookProductIds
            : [];
          const productNameToId = new Map<string, string>();
          (settings.products || []).forEach((p: any) => productNameToId.set(p.name, p.id));

          const webhookAlerts = alerts.filter((a) => {
            const pid = productNameToId.get(a.product);
            if (allowedIds.length > 0 && (!pid || !allowedIds.includes(pid))) return false;
            if (settings.lowStockWebhookOnlyZero) return a.available === 0;
            return a.available <= webhookThreshold;
          });

          if (webhookAlerts.length > 0) {
            const grouped: Record<string, { duration: string; available: number }[]> = {};
            for (const a of webhookAlerts) {
              if (!grouped[a.product]) grouped[a.product] = [];
              grouped[a.product].push({ duration: a.duration, available: a.available });
            }

            const alertFields = Object.entries(grouped).map(([product, items]) => ({
              name: `📦 ${product}`,
              value: items.map((item) =>
                item.available === 0
                  ? `┗ ${item.duration}: ❌ หมดแล้ว!`
                  : `┗ ${item.duration}: ⚠️ เหลือ ${item.available} คีย์`
              ).join("\n"),
              inline: false,
            }));

            const outOfStock = webhookAlerts.filter((a) => a.available === 0).length;
            const lowStock = webhookAlerts.length - outOfStock;

            try {
              const { sendWebhook } = await import("@/lib/webhookSender");
              await sendWebhook(settings, "lowStock", [{
                title: "⚠️ แจ้งเตือน: คีย์ใกล้หมด!",
                description: `พบ ${webhookAlerts.length} รายการ${outOfStock > 0 ? ` (หมดสต็อก ${outOfStock})` : ""}${lowStock > 0 ? ` (ใกล้หมด ${lowStock})` : ""}`,
                color: outOfStock > 0 ? 0xff4444 : 0xffaa00,
                fields: alertFields,
                timestamp: new Date().toISOString(),
                footer: { text: `${settings.brandName} • Low Stock Alert${settings.lowStockWebhookOnlyZero ? " (เฉพาะหมด)" : ` (≤${webhookThreshold})`}` },
              }]);
            } catch (err) {
              console.error("Low stock webhook failed:", err);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (pid: string) => {
    const products = settings.products || [];
    return products.find((p) => p.id === pid)?.name || pid || "ไม่ระบุ";
  };

  const getDurationLabel = (pid: string, did: string) => {
    const products = settings.products || [];
    const p = products.find((p) => p.id === pid);
    return p?.durations.find((d) => d.id === did)?.label || did || "ไม่ระบุ";
  };

  const sendDailySummaryFromDashboard = async () => {
    setSendingSummary(true);
    try {
      const todayKey = toThaiDateKey();
      const todayData = dailyData.find((d) => d.date === todayKey);
      const last7Revenue = dailyData.slice(-7).reduce((s, d) => s + d.revenue, 0);
      const last7Claims = dailyData.slice(-7).reduce((s, d) => s + d.claims, 0);

      // Product breakdown from productStats
      const breakdown = productStats
        .filter((p) => p.totalClaimed > 0)
        .sort((a, b) => b.totalClaimed - a.totalClaimed)
        .map((p) => `• ${p.productName}: ${p.totalClaimed} ครั้ง (เหลือ ${p.totalAvailable})`)
        .join("\n");

      const fields = [
        { name: "📊 กดคีย์วันนี้", value: `**${todayData?.claims || 0}** ครั้ง`, inline: true },
        { name: "💰 รายได้วันนี้", value: `**฿${(todayData?.revenue || 0).toLocaleString()}**`, inline: true },
        { name: "📦 คีย์คงเหลือ", value: `**${totalAvailableKeys}** คีย์`, inline: true },
        { name: "📈 รายได้ 7 วัน", value: `**฿${last7Revenue.toLocaleString()}**`, inline: true },
        { name: "🔑 กดคีย์ 7 วัน", value: `**${last7Claims}** ครั้ง`, inline: true },
        { name: "👥 ผู้ใช้ทั้งหมด", value: `**${totalUsers}** คน`, inline: true },
      ];

      if (breakdown) {
        fields.push({ name: "📋 สินค้าทั้งหมด", value: breakdown, inline: false });
      }

      if (revenueTrend !== 0) {
        fields.push({
          name: "📉 แนวโน้ม (vs 7 วันก่อน)",
          value: revenueTrend > 0 ? `📈 เพิ่มขึ้น **${revenueTrend}%**` : `📉 ลดลง **${Math.abs(revenueTrend)}%**`,
          inline: false,
        });
      }

      const { sendWebhook } = await import("@/lib/webhookSender");
      await sendWebhook(settings, "dailySummary", [{
        title: `📊 สรุปรายวัน - ${new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        color: 0x00cc66,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: `${settings.brandName} • Daily Summary` },
      }]);

      await updateSettings({ lastDailySummaryDate: todayKey });
      toast.success("ส่งสรุปรายวันไปยัง Discord สำเร็จ!");
    } catch (err) {
      console.error("Daily summary failed:", err);
      toast.error("ส่งสรุปไม่สำเร็จ");
    } finally {
      setSendingSummary(false);
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const summaryData = [
        ["รายงานสรุป Dashboard", "", `วันที่ส่งออก: ${new Date().toLocaleDateString("th-TH")}`],
        [],
        ["ตัวชี้วัด", "ค่า"],
        ["ผู้ใช้ทั้งหมด", totalUsers],
        ["คีย์ที่ถูกกด", totalClaimedKeys],
        ["คีย์คงเหลือ", totalAvailableKeys],
        ["รายได้วันนี้ (฿)", todayRevenue],
        ["รายได้รวมทั้งหมด (฿)", totalRevenue],
        ["กดวันนี้ (ครั้ง)", todayClaims],
        ["แนวโน้ม 7 วัน (%)", revenueTrend],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 25 }, { wch: 18 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "สรุปภาพรวม");

      const dailyRows: any[][] = [["วันที่", "รายได้ (฿)", "กดคีย์ (ครั้ง)"]];
      dailyData.forEach(d => dailyRows.push([d.date, d.revenue, d.claims]));
      const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
      wsDaily["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsDaily, "รายได้รายวัน");

      const productRows: any[][] = [["สินค้า", "กดแล้ว", "คงเหลือ", "กดฟรี", "ซื้อปกติ", "ตัวแทน", "รายได้ปกติ (฿)", "รายได้ตัวแทน (฿)"]];
      productStats.forEach(p => productRows.push([p.productName, p.totalClaimed, p.totalAvailable, p.freeClaimed, p.normalClaimed, p.resellerClaimed, p.paidRevenue, p.resellerRevenue]));
      const wsProduct = XLSX.utils.aoa_to_sheet(productRows);
      wsProduct["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsProduct, "สินค้า");

      const topUpRows: any[][] = [
        ["ช่องทาง", "จำนวนครั้ง", "ยอดรวม (฿)"],
        ["สลิปธนาคาร", topUpBreakdown.bank.count, topUpBreakdown.bank.total],
        ["TrueWallet", topUpBreakdown.truewallet.count, topUpBreakdown.truewallet.total],
        ["ซองอั่งเปา", topUpBreakdown.voucher.count, topUpBreakdown.voucher.total],
        ["Gift Code", topUpBreakdown.giftcode.count, topUpBreakdown.giftcode.total],
        ["Admin", topUpBreakdown.admin.count, topUpBreakdown.admin.total],
      ];
      const wsTopUp = XLSX.utils.aoa_to_sheet(topUpRows);
      wsTopUp["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsTopUp, "เติมเงิน");

      const roleRows: any[][] = [["ยศ", "จำนวน (คน)"]];
      Object.entries(roleBreakdown).forEach(([role, count]) => {
        roleRows.push([ROLE_LABELS[role as UserRole] || role, count]);
      });
      const wsRoles = XLSX.utils.aoa_to_sheet(roleRows);
      wsRoles["!cols"] = [{ wch: 18 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsRoles, "ยศผู้ใช้");

      if (canSeeRecentKeys && recentClaims.length > 0) {
        const recentRows: any[][] = [["ผู้ใช้", "อีเมล", "สินค้า", "ระยะเวลา", "วันที่กด"]];
        recentClaims.forEach(c => recentRows.push([c.userName, c.userEmail, c.productName, c.durationLabel, c.claimedAt]));
        const wsRecent = XLSX.utils.aoa_to_sheet(recentRows);
        wsRecent["!cols"] = [{ wch: 18 }, { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];
        XLSX.utils.book_append_sheet(wb, wsRecent, "คีย์ล่าสุด");
      }

      const fileName = `Dashboard_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("ส่งออกรายงาน Excel สำเร็จ!");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("ส่งออกไม่สำเร็จ");
    }
  };

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user) return <RedirectToLogin />;
  if (!hasPermission("hightxcrew")) return <Navigate to="/" replace />;

  // Filter daily data by period
  const filteredDaily = dailyData.slice(-trendPeriod);

  const lineChartData = {
    labels: filteredDaily.map((d) => {
      const dt = new Date(d.date);
      return `${dt.getDate()}/${dt.getMonth() + 1}`;
    }),
    datasets: [
      {
        label: "รายได้ (฿)",
        data: filteredDaily.map((d) => d.revenue),
        borderColor: "rgba(129, 140, 248, 1)",
        backgroundColor: "rgba(129, 140, 248, 0.12)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "rgba(129, 140, 248, 1)",
        pointBorderColor: "rgba(129, 140, 248, 0.5)",
        borderWidth: 2.5,
      },
      {
        label: "กดคีย์ (ครั้ง)",
        data: filteredDaily.map((d) => d.claims),
        borderColor: "rgba(52, 211, 153, 1)",
        backgroundColor: "rgba(52, 211, 153, 0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "rgba(52, 211, 153, 1)",
        pointBorderColor: "rgba(52, 211, 153, 0.5)",
        borderWidth: 2.5,
        yAxisID: "y1",
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { labels: { color: "rgba(224,224,255,0.7)" } },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            if (ctx.datasetIndex === 0) return `รายได้: ฿${ctx.raw.toLocaleString()}`;
            return `กดคีย์: ${ctx.raw} ครั้ง`;
          },
        },
      },
    },
    scales: {
      y: {
        type: "linear" as const,
        position: "left" as const,
        ticks: { color: "rgba(224,224,255,0.7)", callback: (v: any) => `฿${v.toLocaleString()}` },
        grid: { color: "rgba(255,255,255,0.05)" },
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        ticks: { color: "rgba(100,255,150,0.7)" },
        grid: { display: false },
      },
      x: {
        ticks: { color: "rgba(224,224,255,0.7)", maxRotation: 45, minRotation: 0 },
        grid: { display: false },
      },
    },
  };

  const barChartData = {
    labels: productStats.map((p) => p.productName),
    datasets: [
      { label: "กดแล้ว", data: productStats.map((p) => p.totalClaimed), backgroundColor: "hsla(270, 60%, 55%, 0.7)", borderRadius: 6 },
      { label: "คงเหลือ", data: productStats.map((p) => p.totalAvailable), backgroundColor: "hsla(145, 80%, 50%, 0.7)", borderRadius: 6 },
    ],
  };

  const doughnutData = {
    labels: productStats.map((p) => p.productName),
    datasets: [{
      data: productStats.map((p) => p.totalClaimed),
      backgroundColor: ["hsla(234, 85%, 65%, 0.8)", "hsla(270, 60%, 55%, 0.8)", "hsla(300, 70%, 70%, 0.8)", "hsla(350, 80%, 60%, 0.8)", "hsla(145, 80%, 50%, 0.8)", "hsla(45, 90%, 60%, 0.8)"],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { labels: { color: "rgba(224,224,255,0.7)" } } },
    scales: {
      y: { ticks: { color: "rgba(224,224,255,0.7)" }, grid: { color: "rgba(255,255,255,0.05)" } },
      x: { ticks: { color: "rgba(224,224,255,0.7)" }, grid: { display: false } },
    },
  };

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 py-3">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Dashboard" }]}
        title="Dashboard"
        subtitle="ภาพรวมระบบทั้งหมด"
        icon={TrendingUp}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={sendDailySummaryFromDashboard}
            disabled={sendingSummary}
            className="btn-glass px-3 py-1.5 text-[11px] flex items-center gap-2"
          >
            <Send size={14} /> {sendingSummary ? "กำลังส่ง..." : "ส่งสรุปไป Discord"}
          </button>
          <button
            onClick={exportToExcel}
            disabled={loading}
            className="btn-glass px-3 py-1.5 text-[11px] flex items-center gap-2"
          >
            <Download size={14} /> Export Excel
          </button>
          <div className="flex items-center gap-2">
            <button onClick={collapseAll} className="btn-glass px-3 py-1.5 text-[11px] flex items-center gap-1.5">
              <Minimize2 size={12} /> ย่อทั้งหมด
            </button>
            <button onClick={expandAll} className="btn-glass px-3 py-1.5 text-[11px] flex items-center gap-1.5">
              <Maximize2 size={12} /> ขยายทั้งหมด
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">กำลังโหลดข้อมูล...</p></div>
        ) : (
          <>
            {/* Low Stock Alerts */}
            {lowStockAlerts.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                <button onClick={toggleLowStock} className="w-full flex items-center justify-between">
                  <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                    <AlertTriangle size={16} /> แจ้งเตือน: คีย์ใกล้หมด! ({lowStockAlerts.length})
                  </h3>
                  <span className="text-destructive text-xs">{showLowStock ? "ซ่อน ▲" : "แสดง ▼"}</span>
                </button>
                {showLowStock && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {lowStockAlerts.map((a, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                        <span className="text-sm text-foreground">{a.product} - {a.duration}</span>
                        <span className={`font-bold text-sm ${a.available === 0 ? "text-destructive" : "text-yellow-400"}`}>
                          {a.available === 0 ? "หมดแล้ว!" : `เหลือ ${a.available}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Suspense fallback={<div className="py-4 text-center text-muted-foreground text-sm">กำลังโหลด...</div>}>
              <DashboardSummaryCards
                totalUsers={totalUsers}
                totalClaimedKeys={totalClaimedKeys}
                totalAvailableKeys={totalAvailableKeys}
                roleBreakdown={roleBreakdown}
                todayRevenue={todayRevenue}
                todayClaims={todayClaims}
                totalRevenue={totalRevenue}
                revenueTrend={revenueTrend}
              />
            </Suspense>

            {/* Today Sales Summary */}
            <div className="mb-3">
              <CollapsibleSection title="ยอดขายสินค้าวันนี้" icon={<ShoppingCart size={18} />} isOpen={showPurchaseAnalytics} onToggle={togglePurchaseAnalytics} glass>
                <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                  <TodaySalesSummary dailyProductClaims={dailyProductClaims} />
                </Suspense>
              </CollapsibleSection>
            </div>

            {/* Purchase Analytics */}
            <div className="mb-3">
              <CollapsibleSection title="ข้อมูลการซื้อสินค้า (เติมเงิน)" icon={<BarChart3 size={18} />} isOpen={showCharts} onToggle={toggleCharts} glass>
                <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                  <PurchaseAnalytics dailyData={dailyData} productStats={productStats} dailyProductClaims={dailyProductClaims} />
                </Suspense>
              </CollapsibleSection>
            </div>

            {/* Top-Up Breakdown */}
            <div className="mb-3">
              <CollapsibleSection title="สรุปยอดเติมเงินแยกช่องทาง" icon={<Wallet size={18} />} isOpen={showTopUp} onToggle={toggleTopUp} glass>
                <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                  <DashboardTopUpBreakdown topUpBreakdown={topUpBreakdown} />
                </Suspense>
              </CollapsibleSection>
            </div>

            {/* Provider Quota — show only when Thunder is the active slip provider */}
            {(settings.slipProvider || 'thunder') === 'thunder' && (
              <div className="mb-3">
                <CollapsibleSection title="โควต้า Thunder API" icon={<Zap size={18} />} isOpen={showThunder} onToggle={toggleThunder} glass>
                  <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                    <DashboardThunderQuota
                      thunderInfo={thunderInfo}
                      thunderLoading={thunderLoading}
                      thunderHistory={thunderHistory}
                      threshold={settings.thunderQuotaThreshold || 100}
                      onRefresh={loadThunderInfo}
                    />
                  </Suspense>
                </CollapsibleSection>
              </div>
            )}
            {(settings.slipProvider || 'thunder') !== 'thunder' && (
              <div className="mb-3 glass-card text-center text-sm text-muted-foreground py-3">
                กำลังใช้ผู้ให้บริการตรวจสลิป: <strong className="text-foreground">{(settings.slipProvider || 'thunder').toUpperCase()}</strong> — ระบบนี้ไม่รองรับการแสดงโควต้า
              </div>
            )}
            <div className="mb-3">
              <CollapsibleSection title="กิจกรรมวงล้อ (Wheel)" icon={<RotateCcw size={18} />} isOpen={showWheel} onToggle={toggleWheel} glass>
                <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                  <DashboardWheelActivity />
                </Suspense>
              </CollapsibleSection>
            </div>
            <div className="mb-3">
              <CollapsibleSection title="สรุปการกดคีย์รายวันแยกประเภท" icon={<ListChecks size={18} />} isOpen={showDailyClaims} onToggle={toggleDailyClaims} glass>
                <Suspense fallback={<p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>}>
                  <DailyClaimBreakdown
                    data={dailyProductClaims}
                    productNames={productStats.map((p) => p.productName)}
                  />
                </Suspense>
              </CollapsibleSection>
            </div>

            {/* Product Claim Breakdown */}
            <div className="mb-3">
              <CollapsibleSection title="สรุปการกดคีย์แยกประเภท" icon={<BarChart3 size={18} />} isOpen={showProductBreakdown} onToggle={toggleProductBreakdown} glass>
                <div className="space-y-3">
                  {productStats.filter(p => p.totalClaimed > 0).map((ps) => (
                    <ProductClaimCard key={ps.productId} ps={ps} />
                  ))}
                  {productStats.filter(p => p.totalClaimed > 0).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีข้อมูลการกดคีย์</p>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-xs text-muted-foreground">กดฟรีรวม</p>
                    <p className="text-lg font-bold text-emerald-400">{productStats.reduce((s, p) => s + p.freeClaimed, 0)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                    <p className="text-xs text-muted-foreground">ซื้อปกติรวม</p>
                    <p className="text-lg font-bold text-blue-400">{productStats.reduce((s, p) => s + p.normalClaimed, 0)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
                    <p className="text-xs text-muted-foreground">ซื้อตัวแทนรวม</p>
                    <p className="text-lg font-bold text-purple-400">{productStats.reduce((s, p) => s + p.resellerClaimed, 0)}</p>
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Revenue Trend Chart */}
            <div className="mb-3">
              <CollapsibleSection title="กราฟแนวโน้มรายได้ & การกดคีย์" icon={<TrendingUp size={18} />} isOpen={showRevenue} onToggle={toggleRevenue}>
                <div className="glass-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-foreground">แนวโน้มรายวัน</h3>
                    <div className="flex gap-1">
                      {([7, 14, 30] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => setTrendPeriod(p)}
                          className={`px-3 py-1 text-xs rounded-lg transition-all ${trendPeriod === p ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                        >
                          {p} วัน
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[220px]">
                    <Line data={lineChartData} options={lineChartOptions} />
                  </div>
                </div>
              </CollapsibleSection>
            </div>

            {/* Charts */}
            {productStats.length > 0 && (
              <div className="mb-3">
                <CollapsibleSection title="กราฟสถิติสินค้า" icon={<TrendingUp size={18} />} isOpen={showCharts} onToggle={toggleCharts}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-card">
                      <h3 className="text-base font-bold text-foreground mb-4">สถิติคีย์แยกตามสินค้า</h3>
                      <Bar data={barChartData} options={chartOptions} />
                    </div>
                    <div className="glass-card">
                      <h3 className="text-base font-bold text-foreground mb-4">สัดส่วนการกดคีย์</h3>
                      <div className="max-w-[280px] mx-auto">
                        <Doughnut data={doughnutData} options={{ responsive: true, plugins: { legend: { labels: { color: "rgba(224,224,255,0.7)" } } } }} />
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Stock Details */}
            {productStats.length > 0 && (
              <div className="mb-3">
                <CollapsibleSection title="รายละเอียดสต็อก" icon={<Package size={18} />} isOpen={showStockDetail} onToggle={toggleStockDetail} glass>
                  <div className="space-y-4">
                    {productStats.map((ps) => (
                      <div key={ps.productId} className="p-4 rounded-xl bg-muted/30 border border-border">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-foreground">{ps.productName}</h3>
                          <div className="flex gap-3 text-xs">
                            <span className="text-emerald-400">เหลือ {ps.totalAvailable}</span>
                            <span className="text-muted-foreground">กดแล้ว {ps.totalClaimed}</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {ps.durations.map((d) => (
                            <div key={d.durationId} className="p-3 rounded-lg bg-muted/20 border border-border text-center">
                              <p className="text-xs font-semibold text-foreground">{d.label}</p>
                              <p className={`text-lg font-extrabold mt-1 ${d.available <= (settings.lowStockThreshold || 5) ? (d.available === 0 ? "text-destructive" : "text-yellow-400") : "text-emerald-400"}`}>
                                {d.available}
                              </p>
                              <p className="text-[10px] text-muted-foreground">กด {d.claimed}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              </div>
            )}

            {/* Role + Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <CollapsibleSection title="สัดส่วนยศผู้ใช้" icon={<Shield size={18} />} isOpen={showRoles} onToggle={toggleRoles} glass>
                <div className="space-y-3">
                  {Object.entries(roleBreakdown).map(([role, count]) => {
                    const pct = totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0;
                    return (
                      <div key={role}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-foreground">{ROLE_LABELS[role as UserRole] || role}</span>
                          <span className="text-xs text-muted-foreground">{count} คน ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-muted/50">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleSection>

              <div className="relative">
                <CollapsibleSection
                  title="คีย์ที่ถูกกดล่าสุด"
                  icon={<Clock size={18} />}
                  isOpen={showRecent}
                  onToggle={toggleRecent}
                  glass
                  headerRight={
                    hasPermission("admin") ? (
                      <Link to="/all-claims" className="btn-glass px-3 py-1.5 text-[10px] flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        ดูทั้งหมด →
                      </Link>
                    ) : undefined
                  }
                >
                  {!canSeeRecentKeys && (
                    <div className="absolute inset-0 rounded-2xl bg-background/60 backdrop-blur-md flex flex-col items-center justify-center z-10">
                      <Lock size={32} className="text-muted-foreground mb-3" />
                      <p className="text-sm font-semibold text-muted-foreground">ต้องมียศ HightXCrew ขึ้นไป</p>
                      <p className="text-xs text-muted-foreground mt-1">เพื่อดูคีย์ที่ถูกกดล่าสุด</p>
                    </div>
                  )}

                  <div className={`space-y-2 max-h-[220px] overflow-y-auto ${!canSeeRecentKeys ? "blur-md select-none pointer-events-none" : ""}`}>
                    {recentClaims.length > 0 ? recentClaims.map((claim, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-xl bg-muted/30 border border-border">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{claim.userEmail}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge-primary text-[10px]">{claim.productName}</span>
                            <span className="text-[10px] text-muted-foreground">{claim.durationLabel}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{claim.claimedAt}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีคีย์ที่ถูกกด</p>
                    )}
                  </div>
                </CollapsibleSection>
              </div>
            </div>

            {/* Dashboard Settings & Reset */}
            <div className="mt-3">
              <CollapsibleSection title="ตั้งค่า & รีเซ็ต Dashboard" icon={<Settings size={18} />} isOpen={showSettings} onToggle={toggleSettings} glass>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <button
                      onClick={handleRefreshData}
                      className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <RefreshCw size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">รีเฟรชข้อมูล</p>
                        <p className="text-[10px] text-muted-foreground">ล้างแคชและโหลดข้อมูลใหม่ทั้งหมด</p>
                      </div>
                    </button>

                    <button
                      onClick={handleResetCollapsible}
                      className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                        <RotateCcw size={18} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">รีเซ็ตการแสดงผล</p>
                        <p className="text-[10px] text-muted-foreground">คืนค่าการย่อ/ขยายเป็นค่าเริ่มต้น</p>
                      </div>
                    </button>

                    <button
                      onClick={expandAll}
                      className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Maximize2 size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">ขยายทั้งหมด</p>
                        <p className="text-[10px] text-muted-foreground">เปิดทุกส่วนของ Dashboard</p>
                      </div>
                    </button>
                    {/* Auto-refresh toggle */}
                    <button
                      onClick={() => setAutoRefreshEnabled(prev => !prev)}
                      className={`flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                        autoRefreshEnabled 
                          ? "bg-primary/10 border-primary/20 hover:bg-primary/20" 
                          : "bg-muted/10 border-border hover:bg-muted/20"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${autoRefreshEnabled ? "bg-primary/20" : "bg-muted/30"}`}>
                        <RefreshCw size={18} className={autoRefreshEnabled ? "text-primary animate-spin" : "text-muted-foreground"} style={autoRefreshEnabled ? { animationDuration: '3s' } : {}} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Auto-refresh {autoRefreshEnabled ? "เปิด" : "ปิด"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {autoRefreshEnabled ? `รีเฟรชทุก 30 วินาที • ล่าสุด ${lastRefresh.toLocaleTimeString("th-TH")}` : "คลิกเพื่อเปิด"}
                        </p>
                      </div>
                    </button>
                  </div>

                  <div className="p-4 rounded-xl bg-muted/20 border border-border">
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Settings size={14} /> ข้อมูลระบบ
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">เขตเวลา</p>
                        <p className="font-semibold text-foreground">Asia/Bangkok (UTC+7)</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">วันที่ปัจจุบัน (ไทย)</p>
                        <p className="font-semibold text-foreground">{toThaiDateKey()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">แจ้งเตือนสต็อกต่ำ</p>
                        <p className="font-semibold text-foreground">≤ {settings.lowStockThreshold || 5} คีย์</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">แจ้งเตือนโควต้า Thunder</p>
                        <p className="font-semibold text-foreground">≤ {settings.thunderQuotaThreshold || 100} ครั้ง</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default DashboardPage;
