import { useMemo, useState } from "react";
import { Banknote, Gift, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, toThaiDateKey, thaiNow } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DailyProductClaim {
  date: string;
  productName: string;
  productId: string;
  durationId?: string;
  durationLabel?: string;
  free: number;
  normal: number;
  reseller: number;
  wheel: number;
  total: number;
  revenue: number;
}

interface Props {
  dailyProductClaims: DailyProductClaim[];
}

type Period = "today" | "yesterday" | "week" | "month" | "all" | "custom";

const TodaySalesSummary = ({ dailyProductClaims }: Props) => {
  const [period, setPeriod] = useState<Period>("today");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredData = useMemo(() => {
    const now = thaiNow();
    const todayKey = toThaiDateKey();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = toThaiDateKey(yesterday);

    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek + 1);
    const weekStartKey = toThaiDateKey(weekStart);

    const monthStartKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    return dailyProductClaims.filter((d) => {
      if (period === "today") return d.date === todayKey;
      if (period === "yesterday") return d.date === yesterdayKey;
      if (period === "week") return d.date >= weekStartKey && d.date <= todayKey;
      if (period === "month") return d.date >= monthStartKey && d.date <= todayKey;
      if (period === "custom") {
        const pad = (n: number) => String(n).padStart(2, "0");
        const toLocalKey = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        const fromKey = dateFrom ? toLocalKey(dateFrom) : "";
        const toKey = dateTo ? toLocalKey(dateTo) : todayKey;
        if (!fromKey) return true;
        return d.date >= fromKey && d.date <= toKey;
      }
      return true;
    });
  }, [dailyProductClaims, period, dateFrom, dateTo]);

  // Aggregate by product+duration across filtered days
  const aggregated = useMemo(() => {
    const map: Record<string, DailyProductClaim> = {};
    filteredData.forEach((d) => {
      const key = `${d.productId}__${d.durationId || ""}`;
      if (!map[key]) {
        map[key] = { ...d, free: 0, normal: 0, reseller: 0, wheel: 0, total: 0, revenue: 0 };
      }
      const m = map[key];
      m.free += d.free;
      m.normal += d.normal;
      m.reseller += d.reseller;
      m.wheel += (d.wheel || 0);
      m.total += d.total;
      m.revenue += d.revenue;
    });
    return Object.values(map);
  }, [filteredData]);

  // Group aggregated by product for display
  const productGroups = useMemo(() => {
    const map: Record<string, { name: string; items: DailyProductClaim[]; total: number; revenue: number }> = {};
    aggregated.forEach((d) => {
      if (!map[d.productId]) map[d.productId] = { name: d.productName, items: [], total: 0, revenue: 0 };
      map[d.productId].items.push(d);
      map[d.productId].total += d.total;
      map[d.productId].revenue += d.revenue;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue || b.total - a.total);
  }, [aggregated]);

  const totalRevenue = aggregated.reduce((s, d) => s + d.revenue, 0);
  const totalClaims = aggregated.reduce((s, d) => s + d.total, 0);
  const totalFree = aggregated.reduce((s, d) => s + d.free, 0);
  const totalPaid = aggregated.reduce((s, d) => s + d.normal + d.reseller, 0);
  const totalWheel = aggregated.reduce((s, d) => s + (d.wheel || 0), 0);

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "วันนี้" },
    { key: "yesterday", label: "เมื่อวาน" },
    { key: "week", label: "อาทิตย์นี้" },
    { key: "month", label: "เดือนนี้" },
    { key: "all", label: "ทั้งหมด" },
    { key: "custom", label: "กำหนดเอง" },
  ];

  const periodLabel = period === "custom"
    ? (dateFrom ? format(dateFrom, "dd/MM/yy") : "?") + " - " + (dateTo ? format(dateTo, "dd/MM/yy") : "?")
    : periods.find((p) => p.key === period)?.label || "วันนี้";

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              period === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range picker */}
      {period === "custom" && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border bg-muted/30 hover:bg-muted/50 transition-colors",
                dateFrom ? "text-foreground" : "text-muted-foreground"
              )}>
                <CalendarIcon size={12} />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "วันเริ่มต้น"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">ถึง</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border bg-muted/30 hover:bg-muted/50 transition-colors",
                dateTo ? "text-foreground" : "text-muted-foreground"
              )}>
                <CalendarIcon size={12} />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "วันสิ้นสุด"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center" title="ผลรวมราคาคีย์ที่ขายออก (THB) — ไม่รวมยอดเติมเงินและไม่รวมรางวัลวงล้อ">
          <p className="text-[10px] text-muted-foreground mb-0.5">มูลค่าคีย์ขายได้{periodLabel}</p>
          <p className="text-lg font-bold text-primary">฿{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center" title="คีย์ทั้งหมดที่ออกจากสต็อก (รวมฟรี/ซื้อ/วงล้อ)">
          <p className="text-[10px] text-muted-foreground mb-0.5">กดทั้งหมด</p>
          <p className="text-lg font-bold text-blue-400">{totalClaims}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center" title="คีย์ที่ขายได้ (ปกติ + ตัวแทน)">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Banknote size={10} /> ซื้อ</p>
          <p className="text-lg font-bold text-amber-400">{totalPaid}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center" title="คีย์ที่ HightXCrew+ กดฟรีพร้อมหลักฐาน หรือสินค้าราคา 0">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1"><Gift size={10} /> ฟรี</p>
          <p className="text-lg font-bold text-emerald-400">{totalFree}</p>
        </div>
        <div className="p-3 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-center" title="คีย์ที่ผู้ใช้ได้รับเป็นรางวัลจากการหมุนวงล้อ">
          <p className="text-[10px] text-muted-foreground mb-0.5 flex items-center justify-center gap-1">🎰 วงล้อ</p>
          <p className="text-lg font-bold text-fuchsia-400">{totalWheel}</p>
        </div>
      </div>

      {/* Per product breakdown */}
      {productGroups.length > 0 ? (
        <div className="space-y-2">
          {productGroups.map((pg) => (
            <div key={pg.name} className="rounded-xl bg-muted/20 border border-border overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <p className="text-sm font-semibold text-foreground truncate">{pg.name}</p>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-sm font-bold text-foreground">{pg.total} ชิ้น</p>
                  {pg.revenue > 0 && <p className="text-xs font-semibold text-primary">฿{pg.revenue.toLocaleString()}</p>}
                </div>
              </div>
              {pg.items.length > 0 && (
                <div className="border-t border-border px-3 pb-2 pt-1.5 space-y-1">
                  {pg.items
                    .sort((a, b) => b.total - a.total)
                    .map((pd, idx) => (
                      <div key={pd.durationId || idx} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{pd.durationLabel || pd.durationId || "ไม่ระบุ"}</span>
                          {pd.normal > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">ปกติ {pd.normal}</span>}
                          {pd.reseller > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">ตัวแทน {pd.reseller}</span>}
                          {pd.free > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ฟรี {pd.free}</span>}
                          {(pd.wheel || 0) > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-400">วงล้อ {pd.wheel}</span>}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span className="text-xs font-semibold text-foreground">{pd.total}</span>
                          {pd.revenue > 0 && <span className="text-[10px] text-primary ml-1.5">฿{pd.revenue.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">ไม่มียอดขายในช่วงนี้</p>
      )}
    </div>
  );
};

export default TodaySalesSummary;
