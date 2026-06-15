import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import * as XLSX from "xlsx";
import { BarChart3, Download, Search, FileSpreadsheet, Trophy, ClipboardList } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ProductData {
  totalQuantity: number;
  totalAmount: number;
  price: number;
  lastDate: string;
}

const AnalyticsPage = () => {
  const [orderData, setOrderData] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [excludeNames, setExcludeNames] = useState("");
  const [excludeProducts, setExcludeProducts] = useState("");
  const [includeProducts, setIncludeProducts] = useState("");
  const [applyPromotion, setApplyPromotion] = useState(false);
  const [results, setResults] = useState<Record<string, ProductData> | null>(null);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("summary");

  const parseThaiDate = (dateStr: string): Date | null => {
    const months: Record<string, number> = {
      มกราคม: 0, กุมภาพันธ์: 1, มีนาคม: 2, เมษายน: 3,
      พฤษภาคม: 4, มิถุนายน: 5, กรกฎาคม: 6, สิงหาคม: 7,
      กันยายน: 8, ตุลาคม: 9, พฤศจิกายน: 10, ธันวาคม: 11,
    };
    const match = dateStr.match(/(\d+)\s+(\S+)\s+(\d+)/);
    if (!match) return null;
    return new Date(parseInt(match[3]) - 543, months[match[2]] ?? 0, parseInt(match[1]));
  };

  const processOrders = () => {
    setError("");
    setResults(null);

    if (!orderData.trim()) {
      setError("กรุณากรอกข้อมูลรายการสั่งซื้อ");
      return;
    }

    try {
      const lines = orderData.split("\n");
      const productSummary: Record<string, ProductData> = {};
      const excludeNamesList = excludeNames ? excludeNames.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean) : [];
      const excludeProductsList = excludeProducts ? excludeProducts.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean) : [];
      const includeProductsList = includeProducts ? includeProducts.split(",").map((n) => n.trim().toLowerCase()).filter(Boolean) : [];

      let currentProduct: string | null = null;
      let currentPrice: number | null = null;
      let currentDate: string | null = null;
      let currentTime: string | null = null;
      let skipCurrentOrder = false;
      let waitingForCustomerName = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line === "ชื่อ") { waitingForCustomerName = true; continue; }
        if (waitingForCustomerName) {
          waitingForCustomerName = false;
          skipCurrentOrder = excludeNamesList.includes(line.toLowerCase());
          continue;
        }
        if (skipCurrentOrder) continue;

        const dateTimeMatch = line.match(/(\d+)\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s+(\d+)\s+เวลา\s+(\d+:\d+)/);
        if (dateTimeMatch) {
          currentDate = `${dateTimeMatch[1]} ${dateTimeMatch[2]} ${dateTimeMatch[3]}`;
          currentTime = dateTimeMatch[4];
          continue;
        }

        const priceMatch = line.match(/^([\d,.]+)฿+$/);
        if (priceMatch) { currentPrice = parseFloat(priceMatch[1].replace(/,/g, '')); continue; }

        if (line === "สิ่งที่ได้") {
          if (currentProduct && currentPrice) {
            const shouldExclude = excludeProductsList.includes(currentProduct.toLowerCase());
            const shouldInclude = includeProductsList.length === 0 || includeProductsList.includes(currentProduct.toLowerCase());
            if (!shouldExclude && shouldInclude) {
              if (!productSummary[currentProduct]) {
                productSummary[currentProduct] = { totalQuantity: 0, totalAmount: 0, price: currentPrice, lastDate: "ไม่ระบุ" };
              }
              productSummary[currentProduct].totalQuantity += 1;
              productSummary[currentProduct].totalAmount += currentPrice;
              if (currentDate && currentTime) {
                productSummary[currentProduct].lastDate = `${currentDate} เวลา ${currentTime}`;
              } else if (currentDate) {
                productSummary[currentProduct].lastDate = currentDate;
              }
            }
            currentProduct = null;
            currentPrice = null;
          }
          continue;
        }

        if (["IOS", "ANDROID", "PC", "ราคา"].includes(line)) continue;
        if (line.includes("Key:") || line.includes("👤") || line.includes("🔑")) continue;

        currentProduct = line;
      }

      // Filter by date range
      let filtered = productSummary;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        filtered = {};
        for (const [product, info] of Object.entries(productSummary)) {
          const d = parseThaiDate(info.lastDate);
          if (!d) { filtered[product] = info; continue; }
          if ((!start || d >= start) && (!end || d <= end)) filtered[product] = info;
        }
      }

      if (Object.keys(filtered).length === 0) {
        setError("ไม่พบข้อมูลที่ตรงกับเงื่อนไข");
        return;
      }

      setResults(filtered);
    } catch {
      setError("เกิดข้อผิดพลาดในการประมวลผลข้อมูล");
    }
  };

  const getFinalAmount = (data: ProductData) => {
    if (applyPromotion && data.totalQuantity >= 10) {
      const free = Math.floor(data.totalQuantity / 10);
      return (data.totalQuantity - free) * data.price;
    }
    return data.totalAmount;
  };

  const grandTotal = results
    ? Object.values(results).reduce((sum, d) => sum + getFinalAmount(d), 0)
    : 0;

  const filteredEntries = results
    ? Object.entries(results).filter(([name]) => name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const topProducts = results
    ? Object.entries(results)
        .map(([name, d]) => ({ name, ...d, finalAmount: getFinalAmount(d) }))
        .sort((a, b) => b.finalAmount - a.finalAmount)
        .slice(0, 5)
    : [];

  const chartData = results
    ? {
        labels: Object.keys(results),
        datasets: [
          {
            label: "ยอดขาย (฿)",
            data: Object.values(results).map((d) => getFinalAmount(d)),
            backgroundColor: "hsla(234, 85%, 65%, 0.6)",
            borderColor: "hsl(234, 85%, 65%)",
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      }
    : null;

  const exportCSV = () => {
    if (!results) return;
    let csv = "ชื่อสินค้า,จำนวน,ราคาต่อชิ้น,ยอดรวม,วันที่ล่าสุด\n";
    for (const [name, d] of Object.entries(results)) {
      csv += `"${name}",${d.totalQuantity},${d.price},${getFinalAmount(d)},"${d.lastDate}"\n`;
    }
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sales_report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportExcel = () => {
    if (!results) return;
    const data = [["ชื่อสินค้า", "จำนวน", "ราคาต่อชิ้น", "ยอดรวม", "วันที่ล่าสุด"]];
    for (const [name, d] of Object.entries(results)) {
      data.push([name, String(d.totalQuantity), String(d.price), String(getFinalAmount(d)), d.lastDate]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `sales_report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Tools", path: "/hub" }, { label: "วิเคราะห์ยอดขาย" }]}
        title="วิเคราะห์ยอดขาย"
        subtitle="วิเคราะห์ข้อมูลการขายพร้อมกราฟ"
        icon={BarChart3}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Input Section */}
        <div className="glass-card mb-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><ClipboardList size={14} /> วางข้อมูลรายการสั่งซื้อที่นี่</label>
            <textarea
              value={orderData}
              onChange={(e) => setOrderData(e.target.value)}
              className="input-glass w-full px-5 py-4 text-sm min-h-[200px] resize-y font-mono"
              placeholder="วางข้อมูลรายการสั่งซื้อของคุณที่นี่..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">📅 ช่วงวันที่</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-glass px-5 py-4 text-sm" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-glass px-5 py-4 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">🚫 ชื่อลูกค้าที่ต้องการละเว้น</label>
            <input type="text" value={excludeNames} onChange={(e) => setExcludeNames(e.target.value)} className="input-glass w-full px-5 py-4 text-sm" placeholder="เช่น Asula, John, Mary" />
            <small className="text-muted-foreground text-xs mt-1 block">คั่นด้วยเครื่องหมายจุลภาค (,)</small>
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">❌ สินค้าที่ต้องการละเว้น</label>
            <input type="text" value={excludeProducts} onChange={(e) => setExcludeProducts(e.target.value)} className="input-glass w-full px-5 py-4 text-sm" placeholder="เช่น BR MODS 1 DAY" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">✅ นับเฉพาะสินค้าที่กำหนด</label>
            <input type="text" value={includeProducts} onChange={(e) => setIncludeProducts(e.target.value)} className="input-glass w-full px-5 py-4 text-sm" placeholder="เช่น FLUORITE IOS 1 วัน" />
            <small className="text-muted-foreground text-xs mt-1 block">ถ้าเว้นว่างจะนับทุกสินค้า</small>
          </div>

          <label className="flex items-center cursor-pointer select-none p-4 rounded-2xl bg-muted/30 border border-border">
            <div
              className={`toggle-slider ${applyPromotion ? "toggle-active" : ""}`}
              onClick={() => setApplyPromotion(!applyPromotion)}
            />
            <span className="text-sm font-medium text-foreground">🎁 โปร 10 แถม 1</span>
          </label>

          <button onClick={processOrders} className="btn-gradient w-full py-5 text-lg flex items-center justify-center gap-2">
            <BarChart3 size={20} />
            วิเคราะห์ข้อมูล
          </button>

          {error && (
            <div className="bg-destructive/15 text-destructive border border-destructive/30 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
              {[
                { label: "ยอดขายรวม", value: `${grandTotal.toLocaleString()} ฿` },
                { label: "จำนวนสินค้า", value: Object.keys(results).length },
                { label: "รายการทั้งหมด", value: Object.values(results).reduce((s, d) => s + d.totalQuantity, 0) },
                { label: "ราคาเฉลี่ย/รายการ", value: `${Math.round(grandTotal / Math.max(1, Object.values(results).reduce((s, d) => s + d.totalQuantity, 0))).toLocaleString()} ฿` },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-2">{stat.label}</div>
                  <div className="text-2xl md:text-xl font-bold text-foreground">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Chart */}
            {chartData && (
              <div className="glass-card mb-6">
                <h2 className="text-lg font-bold text-foreground mb-6">📈 กราฟยอดขายตามสินค้า</h2>
                <div className="max-h-[400px]">
                  <Bar
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: { display: false },
                      },
                      scales: {
                        y: {
                          ticks: { color: "rgba(224,224,255,0.7)" },
                          grid: { color: "rgba(255,255,255,0.05)" },
                        },
                        x: {
                          ticks: { color: "rgba(224,224,255,0.7)", maxRotation: 45, minRotation: 45 },
                          grid: { display: false },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            )}

            {/* Top 5 */}
            <div className="glass-card mb-6">
              <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                <Trophy size={20} className="text-primary" /> สินค้าขายดี Top 5
              </h2>
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border transition-all hover:bg-muted/50">
                    <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center font-extrabold text-lg shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{p.name}</div>
                      <div className="text-muted-foreground text-xs">{p.totalQuantity} ชิ้น × {p.price.toLocaleString()} ฿</div>
                    </div>
                    <div className="text-primary font-bold text-lg">{p.finalAmount.toLocaleString()} ฿</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="glass-card">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><ClipboardList size={18} /> รายละเอียดทั้งหมด</h2>
                <div className="flex gap-2">
                  <button onClick={exportCSV} className="btn-glass px-4 py-2 text-sm flex items-center gap-2">
                    <Download size={14} /> CSV
                  </button>
                  <button onClick={exportExcel} className="btn-glass px-4 py-2 text-sm flex items-center gap-2">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                </div>
              </div>

              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-glass w-full pl-11 pr-5 py-3 text-sm"
                  placeholder="ค้นหาสินค้า..."
                />
              </div>

              <div className="table-glass">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-bold bg-primary/10">ชื่อสินค้า</th>
                      <th className="text-center p-4 text-xs uppercase tracking-wider text-muted-foreground font-bold bg-primary/10">จำนวน</th>
                      <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-bold bg-primary/10">ราคา/ชิ้น</th>
                      <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-foreground font-bold bg-primary/10">ยอดรวม</th>
                      <th className="text-center p-4 text-xs uppercase tracking-wider text-muted-foreground font-bold bg-primary/10">ล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(([name, data]) => (
                      <tr key={name} className="border-t border-border/50 hover:bg-primary/5 transition-colors">
                        <td className="p-4 font-semibold text-sm">{name}</td>
                        <td className="p-4 text-center"><span className="badge-primary">{data.totalQuantity}</span></td>
                        <td className="p-4 text-right text-sm">{data.price.toLocaleString()} ฿</td>
                        <td className="p-4 text-right font-bold text-sm">{getFinalAmount(data).toLocaleString()} ฿</td>
                        <td className="p-4 text-center"><span className="badge-date">{data.lastDate}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="total-summary-card mt-6">
                <span className="text-xs font-semibold uppercase tracking-widest block mb-2">ยอดรวมทั้งหมด</span>
                <div className="text-4xl md:text-5xl font-extrabold">{grandTotal.toLocaleString()} ฿</div>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default AnalyticsPage;
