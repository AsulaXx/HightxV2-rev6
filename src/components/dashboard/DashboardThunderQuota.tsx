import { AlertTriangle, RefreshCw } from "lucide-react";
import { Bar } from "react-chartjs-2";

interface Props {
  thunderInfo: any;
  thunderLoading: boolean;
  thunderHistory: { date: string; used: number; remaining: number }[];
  threshold: number;
  onRefresh: () => void;
}

const DashboardThunderQuota = ({ thunderInfo, thunderLoading, thunderHistory, threshold, onRefresh }: Props) => {
  if (thunderLoading) return <p className="text-sm text-muted-foreground text-center py-4">กำลังโหลด...</p>;

  if (!thunderInfo) return (
    <div className="text-center py-4">
      <p className="text-sm text-muted-foreground mb-2">ไม่สามารถโหลดข้อมูลได้</p>
      <p className="text-xs text-muted-foreground mb-3">ตรวจสอบว่าตั้งค่า Thunder API Key แล้ว</p>
      <button onClick={onRefresh} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5 mx-auto">
        <RefreshCw size={12} /> ลองใหม่
      </button>
    </div>
  );

  const appQuota = thunderInfo.application?.quota;
  const branch = thunderInfo.branch;
  const product = thunderInfo.product;
  const used = appQuota?.used ?? 0;
  const max = appQuota?.max;
  const remaining = appQuota?.remaining;
  const totalUsed = appQuota?.totalUsed ?? 0;
  const pct = max ? Math.min((used / max) * 100, 100) : 0;
  const isLow = remaining !== null && remaining !== undefined && remaining < threshold;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "ใช้ไปแล้ว (รอบนี้)", value: used.toLocaleString(), className: "text-foreground" },
          { label: "คงเหลือ", value: remaining !== null && remaining !== undefined ? remaining.toLocaleString() : '∞', className: isLow ? 'text-destructive' : 'text-emerald-500' },
          { label: "โควต้าทั้งหมด", value: max !== null && max !== undefined ? max.toLocaleString() : '∞', className: "text-foreground" },
          { label: "ใช้ทั้งหมด (สะสม)", value: totalUsed.toLocaleString(), className: "text-foreground" },
        ].map((item) => (
          <div key={item.label} className="glass-card text-center p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
            <p className={`text-lg font-bold ${item.className}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {max && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>การใช้งาน</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-destructive' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {thunderInfo.application?.name && <span>📱 App: <strong className="text-foreground">{thunderInfo.application.name}</strong></span>}
        {branch?.name && <span>🔀 Branch: <strong className="text-foreground">{branch.name}</strong> {branch.isActive ? '✅' : '❌'}</span>}
        {product?.name && <span>📦 Plan: <strong className="text-foreground">{product.name}</strong></span>}
      </div>

      {isLow && (
        <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-xl px-3 py-2">
          <AlertTriangle size={14} />
          <span>โควต้าเหลือน้อย! เหลือ {remaining} ครั้ง กรุณาเติมโควต้าเร็วๆ นี้</span>
        </div>
      )}

      {thunderHistory.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">📊 อัตราการใช้โควต้ารายวัน</h4>
          <div className="h-48">
            <Bar
              data={{
                labels: thunderHistory.map(h => { const d = new Date(h.date); return `${d.getDate()}/${d.getMonth() + 1}`; }),
                datasets: [
                  { label: 'ใช้ไป (สะสม)', data: thunderHistory.map(h => h.used), backgroundColor: 'hsla(234, 85%, 65%, 0.7)', borderRadius: 4 },
                  { label: 'คงเหลือ', data: thunderHistory.map(h => h.remaining), backgroundColor: 'hsla(142, 76%, 36%, 0.7)', borderRadius: 4 },
                ],
              }}
              options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, color: 'hsl(var(--muted-foreground))' } } },
                scales: {
                  x: { ticks: { font: { size: 9 }, color: 'hsl(var(--muted-foreground))' }, grid: { display: false } },
                  y: { ticks: { font: { size: 9 }, color: 'hsl(var(--muted-foreground))' }, grid: { color: 'hsla(var(--muted-foreground), 0.1)' } },
                },
              }}
            />
          </div>
        </div>
      )}

      <button onClick={onRefresh} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5 mx-auto">
        <RefreshCw size={12} /> รีเฟรช
      </button>
    </div>
  );
};

export default DashboardThunderQuota;
