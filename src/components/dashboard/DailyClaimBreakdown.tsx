import { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toThaiDateKey, thaiNow } from "@/lib/utils";

export interface DailyProductClaim {
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
  data: DailyProductClaim[];
  productNames: string[];
}

const DailyClaimBreakdown = ({ data, productNames }: Props) => {
  const [selectedDate, setSelectedDate] = useState(() => toThaiDateKey());

  // Get all unique dates sorted desc
  const allDates = useMemo(() => {
    const set = new Set(data.map((d) => d.date));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [data]);

  const currentIndex = allDates.indexOf(selectedDate);

  const goDay = (dir: -1 | 1) => {
    // -1 = newer, +1 = older (since sorted desc)
    const next = currentIndex + dir;
    if (next >= 0 && next < allDates.length) setSelectedDate(allDates[next]);
  };

  // Filter data for selected date
  const dayData = useMemo(() => {
    return data.filter((d) => d.date === selectedDate);
  }, [data, selectedDate]);

  const dayTotal = dayData.reduce((s, d) => s + d.total, 0);
  const dayRevenue = dayData.reduce((s, d) => s + d.revenue, 0);
  const dayFree = dayData.reduce((s, d) => s + d.free, 0);
  const dayNormal = dayData.reduce((s, d) => s + d.normal, 0);
  const dayReseller = dayData.reduce((s, d) => s + d.reseller, 0);
  const dayWheel = dayData.reduce((s, d) => s + (d.wheel || 0), 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", year: "2-digit" });
  };

  const quickDays = [0, 1, 3, 7, 14, 30];

  const goQuick = (daysAgo: number) => {
    const d = thaiNow();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(toThaiDateKey(d));
  };

  return (
    <div>
      {/* Quick Day Buttons */}
      <div className="flex items-center justify-center gap-1.5 mb-3 flex-wrap">
        {quickDays.map((d) => {
          const target = thaiNow();
          target.setDate(target.getDate() - d);
          const targetStr = toThaiDateKey(target);
          const isActive = selectedDate === targetStr;
          return (
            <button
              key={d}
              onClick={() => goQuick(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
              }`}
            >
              {d === 0 ? "วันนี้" : d === 1 ? "เมื่อวาน" : `${d} วันก่อน`}
            </button>
          );
        })}
      </div>

      {/* Date Selector */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={() => goDay(1)}
          disabled={currentIndex >= allDates.length - 1}
          className="p-2 rounded-lg hover:bg-muted/40 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} className="text-foreground" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/30 border border-border">
          <CalendarDays size={14} className="text-primary" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-sm font-medium text-foreground outline-none"
          />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            ({formatDate(selectedDate)})
          </span>
        </div>
        <button
          onClick={() => goDay(-1)}
          disabled={currentIndex <= 0}
          className="p-2 rounded-lg hover:bg-muted/40 disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={16} className="text-foreground" />
        </button>
      </div>

      {/* Day Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">กดทั้งหมด</p>
          <p className="text-lg font-bold text-primary">{dayTotal}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">กดฟรี</p>
          <p className="text-lg font-bold text-emerald-400">{dayFree}</p>
        </div>
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">ซื้อปกติ</p>
          <p className="text-lg font-bold text-blue-400">{dayNormal}</p>
        </div>
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">ตัวแทน</p>
          <p className="text-lg font-bold text-purple-400">{dayReseller}</p>
        </div>
        <div className="p-3 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-center">
          <p className="text-[10px] text-muted-foreground mb-0.5">วงล้อ</p>
          <p className="text-lg font-bold text-fuchsia-400">{dayWheel}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground mb-0.5">รายได้</p>
          <p className="text-lg font-bold text-amber-400">฿{dayRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Per Product Table */}
      {dayData.length > 0 ? (
        <div className="space-y-2">
          {(() => {
            // Group by product, then show durations inside
            const grouped: Record<string, DailyProductClaim[]> = {};
            dayData.forEach((pd) => {
              if (!grouped[pd.productId]) grouped[pd.productId] = [];
              grouped[pd.productId].push(pd);
            });
            const productTotals = Object.entries(grouped).map(([pid, items]) => ({
              pid,
              name: items[0].productName,
              items: items.sort((a, b) => b.total - a.total),
              total: items.reduce((s, i) => s + i.total, 0),
              revenue: items.reduce((s, i) => s + i.revenue, 0),
            }));
            productTotals.sort((a, b) => b.total - a.total);

            return productTotals.map((pg) => (
              <div key={pg.pid} className="rounded-xl bg-muted/20 border border-border overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <p className="text-sm font-semibold text-foreground truncate">{pg.name}</p>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-foreground">{pg.total} ครั้ง</p>
                    {pg.revenue > 0 && <p className="text-[10px] text-primary">฿{pg.revenue.toLocaleString()}</p>}
                  </div>
                </div>
                {pg.items.length > 0 && (
                  <div className="border-t border-border px-3 pb-2 pt-1.5 space-y-1">
                    {pg.items.map((pd, idx) => (
                      <div key={pd.durationId || idx} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">{pd.durationLabel || pd.durationId || "ไม่ระบุ"}</span>
                          {pd.free > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">ฟรี {pd.free}</span>}
                          {pd.normal > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">ปกติ {pd.normal}</span>}
                          {pd.reseller > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">ตัวแทน {pd.reseller}</span>}
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
            ));
          })()}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-6">ไม่มีข้อมูลการกดคีย์ในวันนี้</p>
      )}
    </div>
  );
};

export default DailyClaimBreakdown;
