import { useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus, ShoppingCart, TrendingUp, CalendarDays, Calendar, BarChart3, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart as RePieChart, Pie, Cell } from "recharts";
import { toThaiDateKey, thaiNow } from "@/lib/utils";

interface DailyData {
  date: string;
  claims: number;
  revenue: number;
}

interface ProductStatItem {
  productName: string;
  productId: string;
  paidRevenue: number;
  resellerRevenue: number;
  totalClaimed: number;
}

interface DailyProductClaim {
  date: string;
  productName: string;
  productId: string;
  free?: number;
  normal?: number;
  reseller?: number;
  revenue: number;
  total: number;
}

interface Props {
  dailyData: DailyData[];
  productStats?: ProductStatItem[];
  dailyProductClaims?: DailyProductClaim[];
}

const PurchaseAnalytics = ({ dailyData, productStats = [], dailyProductClaims = [] }: Props) => {
  const stats = useMemo(() => {
    const now = thaiNow();
    const todayKey = toThaiDateKey();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toThaiDateKey(yesterday);

    // Current week (Mon-Sun)
    const dayOfWeek = now.getDay() || 7; // Sun=7
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    const weekStartKey = toThaiDateKey(weekStart);

    // Current month
    const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const todayData = dailyData.find((d) => d.date === todayKey) || { claims: 0, revenue: 0 };
    const yesterdayData = dailyData.find((d) => d.date === yesterdayKey) || { claims: 0, revenue: 0 };

    const weekData = dailyData.filter((d) => d.date >= weekStartKey && d.date <= todayKey);
    const monthData = dailyData.filter((d) => d.date >= monthStartKey && d.date <= todayKey);
    const allData = dailyData;

    const weekClaims = weekData.reduce((s, d) => s + d.claims, 0);
    const weekRevenue = weekData.reduce((s, d) => s + d.revenue, 0);
    const monthClaims = monthData.reduce((s, d) => s + d.claims, 0);
    const monthRevenue = monthData.reduce((s, d) => s + d.revenue, 0);
    const totalClaims = allData.reduce((s, d) => s + d.claims, 0);
    const totalRevenue = allData.reduce((s, d) => s + d.revenue, 0);

    // Last 7 days vs previous 7 days
    const last7 = dailyData.filter((d) => {
      const diff = (now.getTime() - new Date(d.date).getTime()) / 86400000;
      return diff >= 0 && diff < 7;
    });
    const prev7 = dailyData.filter((d) => {
      const diff = (now.getTime() - new Date(d.date).getTime()) / 86400000;
      return diff >= 7 && diff < 14;
    });

    const last7Claims = last7.reduce((s, d) => s + d.claims, 0);
    const last7Revenue = last7.reduce((s, d) => s + d.revenue, 0);
    const prev7Claims = prev7.reduce((s, d) => s + d.claims, 0);
    const prev7Revenue = prev7.reduce((s, d) => s + d.revenue, 0);

    const avg7Claims = last7.length > 0 ? last7Claims / last7.length : 0;
    const avg7Revenue = last7.length > 0 ? last7Revenue / last7.length : 0;

    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      today: todayData,
      yesterday: yesterdayData,
      claimChangeVsYesterday: pctChange(todayData.claims, yesterdayData.claims),
      revenueChangeVsYesterday: pctChange(todayData.revenue, yesterdayData.revenue),
      week: { claims: weekClaims, revenue: weekRevenue },
      month: { claims: monthClaims, revenue: monthRevenue },
      total: { claims: totalClaims, revenue: totalRevenue },
      last7: { claims: last7Claims, revenue: last7Revenue },
      prev7: { claims: prev7Claims, revenue: prev7Revenue },
      avg7: { claims: avg7Claims, revenue: avg7Revenue },
      claimChange7d: pctChange(last7Claims, prev7Claims),
      revenueChange7d: pctChange(last7Revenue, prev7Revenue),
    };
  }, [dailyData]);

  const [chartMode, setChartMode] = useState<"daily" | "monthly">("daily");
  const [doughnutPeriod, setDoughnutPeriod] = useState<"today" | "week" | "month" | "all">("all");
  const [doughnutMode, setDoughnutMode] = useState<"revenue" | "count">("revenue");
  const [doughnutType, setDoughnutType] = useState<"all" | "paid" | "free" | "normal" | "reseller">("all");

  const chartData = useMemo(() => {
    if (chartMode === "daily") {
      // Last 14 days
      const days: { label: string; claims: number; revenue: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = thaiNow();
        d.setDate(d.getDate() - i);
        const key = toThaiDateKey(d);
        const found = dailyData.find((dd) => dd.date === key);
        days.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          claims: found?.claims || 0,
          revenue: found?.revenue || 0,
        });
      }
      return days;
    } else {
      // Monthly aggregation
      const monthMap: Record<string, { claims: number; revenue: number }> = {};
      dailyData.forEach((d) => {
        const monthKey = d.date.substring(0, 7); // YYYY-MM
        if (!monthMap[monthKey]) monthMap[monthKey] = { claims: 0, revenue: 0 };
        monthMap[monthKey].claims += d.claims;
        monthMap[monthKey].revenue += d.revenue;
      });
      return Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, val]) => {
          const [y, m] = key.split("-");
          return { label: `${m}/${y.slice(2)}`, ...val };
        });
    }
  }, [dailyData, chartMode]);

  const ChangeIndicator = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    if (value === 0) return <span className="text-muted-foreground flex items-center gap-0.5 text-xs"><Minus size={12} /> 0{suffix}</span>;
    if (value > 0) return <span className="text-emerald-400 flex items-center gap-0.5 text-xs"><ArrowUpRight size={12} /> +{value}{suffix}</span>;
    return <span className="text-destructive flex items-center gap-0.5 text-xs"><ArrowDownRight size={12} /> {value}{suffix}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Today vs Yesterday Comparison */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <TrendingUp size={13} /> เปรียบเทียบวันนี้ vs เมื่อวาน
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">จำนวน (ชิ้น)</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-foreground">{stats.today.claims}</p>
                <p className="text-[10px] text-muted-foreground">เมื่อวาน: {stats.yesterday.claims}</p>
              </div>
              <ChangeIndicator value={stats.claimChangeVsYesterday} />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">รายได้ (฿)</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-foreground">฿{stats.today.revenue.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">เมื่อวาน: ฿{stats.yesterday.revenue.toLocaleString()}</p>
              </div>
              <ChangeIndicator value={stats.revenueChangeVsYesterday} />
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Average & Comparison */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <CalendarDays size={13} /> เฉลี่ย 7 วัน & เปรียบเทียบ
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">จำนวนเฉลี่ย/วัน</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-foreground">{Math.round(stats.avg7.claims)}</p>
                <p className="text-[10px] text-muted-foreground">รวม 7 วัน: {stats.last7.claims}</p>
              </div>
              <ChangeIndicator value={stats.claimChange7d} />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <p className="text-[10px] text-muted-foreground mb-1">รายได้เฉลี่ย/วัน</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xl font-bold text-foreground">฿{Math.round(stats.avg7.revenue).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">รวม 7 วัน: ฿{stats.last7.revenue.toLocaleString()}</p>
              </div>
              <ChangeIndicator value={stats.revenueChange7d} />
            </div>
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
          <Calendar size={13} /> สรุปข้อมูล (Summary)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "วันนี้", claims: stats.today.claims, revenue: stats.today.revenue, color: "bg-primary/10 border-primary/20" },
            { label: "อาทิตย์นี้", claims: stats.week.claims, revenue: stats.week.revenue, color: "bg-blue-500/10 border-blue-500/20" },
            { label: "เดือนนี้", claims: stats.month.claims, revenue: stats.month.revenue, color: "bg-purple-500/10 border-purple-500/20" },
            { label: "ทั้งหมด", claims: stats.total.claims, revenue: stats.total.revenue, color: "bg-amber-500/10 border-amber-500/20" },
          ].map((period) => (
            <div key={period.label} className={`p-3 rounded-xl border text-center ${period.color}`}>
              <p className="text-[10px] text-muted-foreground mb-1">{period.label}</p>
              <p className="text-lg font-bold text-foreground">{period.claims} <span className="text-[10px] font-normal text-muted-foreground">ชิ้น</span></p>
              <p className="text-xs font-semibold text-primary">฿{period.revenue.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bar Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <BarChart3 size={13} /> กราฟเปรียบเทียบรายได้
          </h4>
          <div className="flex gap-1">
            {(["daily", "monthly"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors ${
                  chartMode === mode
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                }`}
              >
                {mode === "daily" ? "รายวัน" : "รายเดือน"}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 11,
                }}
                formatter={(value: number, name: string) => [
                  name === "revenue" ? `฿${value.toLocaleString()}` : value,
                  name === "revenue" ? "รายได้" : "จำนวน",
                ]}
              />
              <Legend
                formatter={(value) => (value === "revenue" ? "รายได้ (฿)" : "จำนวน (ชิ้น)")}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="claims" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Doughnut Chart - Revenue by Product with Period Filter */}
      {(() => {
        const COLORS = [
          "hsl(234, 85%, 65%)", "hsl(270, 60%, 55%)", "hsl(300, 70%, 70%)",
          "hsl(350, 80%, 60%)", "hsl(145, 80%, 50%)", "hsl(45, 90%, 60%)",
          "hsl(200, 70%, 55%)", "hsl(30, 80%, 55%)",
        ];

        const now = thaiNow();
        const todayKey = toThaiDateKey();
        const dayOfWeek = now.getDay() || 7;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - dayOfWeek + 1);
        const weekStartKey = toThaiDateKey(weekStart);
        const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

        // Filter dailyProductClaims by period
        const filteredClaims = dailyProductClaims.filter((c) => {
          if (doughnutPeriod === "today") return c.date === todayKey;
          if (doughnutPeriod === "week") return c.date >= weekStartKey && c.date <= todayKey;
          if (doughnutPeriod === "month") return c.date >= monthStartKey && c.date <= todayKey;
          return true; // all
        });

        // Aggregate by product with type filtering
        const productMap: Record<string, { name: string; revenue: number; count: number; free: number; normal: number; reseller: number }> = {};
        filteredClaims.forEach((c) => {
          if (!productMap[c.productId]) productMap[c.productId] = { name: c.productName, revenue: 0, count: 0, free: 0, normal: 0, reseller: 0 };
          const pm = productMap[c.productId];
          pm.revenue += c.revenue;
          pm.count += c.total || 0;
          pm.free += c.free || 0;
          pm.normal += c.normal || 0;
          pm.reseller += c.reseller || 0;
        });

        // Apply type filter
        let doughnutData = Object.values(productMap).map((d) => {
          let value: number;
          let count: number;
          if (doughnutType === "free") { value = 0; count = d.free; }
          else if (doughnutType === "normal") { value = d.revenue * (d.normal / Math.max(d.normal + d.reseller, 1)); count = d.normal; }
          else if (doughnutType === "reseller") { value = d.revenue * (d.reseller / Math.max(d.normal + d.reseller, 1)); count = d.reseller; }
          else if (doughnutType === "paid") { value = d.revenue; count = d.normal + d.reseller; }
          else { value = d.revenue; count = d.count; }

          return { name: d.name, value: doughnutMode === "count" ? count : value, count };
        }).filter((d) => d.value > 0 || (doughnutMode === "count" && d.count > 0))
          .sort((a, b) => b.value - a.value);

        // Fallback to productStats
        if (doughnutData.length === 0 && doughnutPeriod === "all" && doughnutType === "all" && productStats.length > 0) {
          doughnutData = productStats
            .map((p) => ({
              name: p.productName,
              value: doughnutMode === "count" ? p.totalClaimed : p.paidRevenue + p.resellerRevenue,
              count: p.totalClaimed,
            }))
            .filter((d) => d.value > 0)
            .sort((a, b) => b.value - a.value);
        }

        const total = doughnutData.reduce((s, d) => s + d.value, 0);
        const totalCount = doughnutData.reduce((s, d) => s + d.count, 0);

        const periodLabels = [
          { key: "today" as const, label: "วันนี้" },
          { key: "week" as const, label: "อาทิตย์นี้" },
          { key: "month" as const, label: "เดือนนี้" },
          { key: "all" as const, label: "ทั้งหมด" },
        ];

        return (
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <PieChart size={13} /> สัดส่วน{doughnutMode === "revenue" ? "รายได้" : "จำนวน"}แยกตามสินค้า
              </h4>
              <div className="flex gap-1 flex-wrap">
                {periodLabels.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setDoughnutPeriod(p.key)}
                    className={`px-2.5 py-1 text-[10px] rounded-lg border transition-colors ${
                      doughnutPeriod === p.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Type & Mode Filters */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex gap-1">
                {([
                  { key: "all" as const, label: "ทั้งหมด" },
                  { key: "paid" as const, label: "ซื้อ" },
                  { key: "normal" as const, label: "ปกติ" },
                  { key: "reseller" as const, label: "ตัวแทน" },
                  { key: "free" as const, label: "ฟรี" },
                ]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDoughnutType(t.key)}
                    className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${
                      doughnutType === t.key
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {([
                  { key: "revenue" as const, label: "฿ รายได้" },
                  { key: "count" as const, label: "# จำนวน" },
                ]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setDoughnutMode(m.key)}
                    className={`px-2 py-1 text-[10px] rounded-lg border transition-colors ${
                      doughnutMode === m.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/20 text-muted-foreground border-border hover:bg-muted/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border">
              {doughnutData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูลรายได้ในช่วงนี้</p>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={200} className="max-w-[220px]">
                    <RePieChart>
                      <Pie
                        data={doughnutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {doughnutData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const item = doughnutData[props?.payload?.index ?? 0];
                          if (doughnutMode === "count") {
                            return [`${value.toLocaleString()} ชิ้น`, "จำนวน"];
                          }
                          return [`฿${value.toLocaleString()} (${item?.count || 0} ชิ้น)`, "รายได้"];
                        }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 w-full">
                    {doughnutData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-foreground truncate max-w-[120px]">{d.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{d.count} ชิ้น</span>
                          <span className="text-muted-foreground">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                          <span className="font-semibold text-foreground">
                            {doughnutMode === "count" ? `${d.value.toLocaleString()} ชิ้น` : `฿${d.value.toLocaleString()}`}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1.5 border-t border-border flex justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">รวมทั้งหมด ({totalCount} ชิ้น)</span>
                      <span className="text-primary">{doughnutMode === "count" ? `${total.toLocaleString()} ชิ้น` : `฿${total.toLocaleString()}`}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PurchaseAnalytics;
