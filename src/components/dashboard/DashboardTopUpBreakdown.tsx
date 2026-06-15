import { Banknote, Smartphone, Gift, CreditCard, Shield } from "lucide-react";
import { Doughnut } from "react-chartjs-2";

interface TopUpBreakdown {
  bank: { count: number; total: number };
  truewallet: { count: number; total: number };
  voucher: { count: number; total: number };
  giftcode: { count: number; total: number };
  admin: { count: number; total: number };
  other: { count: number; total: number };
}

interface Props {
  topUpBreakdown: TopUpBreakdown;
}

const channels = [
  { label: "สลิปธนาคาร", icon: Banknote, key: "bank" as const, color: "from-emerald-500 to-green-400" },
  { label: "TrueWallet", icon: Smartphone, key: "truewallet" as const, color: "from-orange-500 to-amber-400" },
  { label: "ซองอั่งเปา", icon: Gift, key: "voucher" as const, color: "from-red-500 to-pink-400" },
  { label: "Gift Code", icon: CreditCard, key: "giftcode" as const, color: "from-blue-500 to-cyan-400" },
  { label: "Admin เติมให้", icon: Shield, key: "admin" as const, color: "from-purple-500 to-violet-400" },
];

const chartColors = ["hsla(145, 80%, 45%, 0.8)", "hsla(30, 95%, 55%, 0.8)", "hsla(350, 80%, 55%, 0.8)", "hsla(210, 85%, 55%, 0.8)", "hsla(270, 60%, 55%, 0.8)"];
const chartLabels = ["สลิปธนาคาร", "TrueWallet", "ซองอั่งเปา", "Gift Code", "Admin"];

const DashboardTopUpBreakdown = ({ topUpBreakdown }: Props) => {
  const grandTotal = channels.reduce((s, ch) => s + topUpBreakdown[ch.key].total, 0);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {channels.map((ch) => (
          <div key={ch.key} className="p-4 rounded-xl bg-muted/30 border border-border text-center">
            <div className={`w-10 h-10 mx-auto rounded-xl bg-gradient-to-br ${ch.color} flex items-center justify-center mb-2`}>
              <ch.icon size={18} className="text-white" />
            </div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{ch.label}</p>
            <p className="text-lg font-bold text-foreground">฿{topUpBreakdown[ch.key].total.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{topUpBreakdown[ch.key].count} รายการ</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {[
          { title: "สัดส่วนยอดเติมเงิน (฿)", data: channels.map(ch => topUpBreakdown[ch.key].total) },
          { title: "สัดส่วนจำนวนรายการ", data: channels.map(ch => topUpBreakdown[ch.key].count) },
        ].map((chart) => (
          <div key={chart.title} className="p-4 rounded-xl bg-muted/20 border border-border">
            <h4 className="text-sm font-bold text-foreground mb-3 text-center">{chart.title}</h4>
            <div className="max-w-[240px] mx-auto">
              <Doughnut
                data={{
                  labels: chartLabels,
                  datasets: [{ data: chart.data, backgroundColor: chartColors, borderWidth: 0 }],
                }}
                options={{ responsive: true, plugins: { legend: { position: "bottom", labels: { color: "rgba(224,224,255,0.7)", font: { size: 11 } } } } }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">ยอดเติมเงินรวมทั้งหมด</span>
        <span className="text-lg font-bold text-primary">฿{grandTotal.toLocaleString()}</span>
      </div>
    </>
  );
};

export default DashboardTopUpBreakdown;
