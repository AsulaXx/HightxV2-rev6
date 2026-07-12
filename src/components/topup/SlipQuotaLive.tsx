import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

interface QuotaData {
  used: number;
  max: number | null;
  remaining: number | null;
}

/**
 * Realtime slip quota display — polls the `thunder-info` edge function
 * every 15s. Visible to everyone (no role gate) so users know whether
 * slip verification is available before uploading.
 */
const SlipQuotaLive = () => {
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const { data, error: err } = await supabase.functions.invoke("thunder-info", { body: {} });
      if (err) throw err;
      if (data?.success && data.data?.application?.quota) {
        const q = data.data.application.quota;
        setQuota({ used: q.used ?? 0, max: q.max ?? null, remaining: q.remaining ?? null });
        setError(null);
      } else {
        setError(data?.error?.message || "ไม่พบข้อมูลโควต้า");
      }
    } catch (e: any) {
      setError(e?.message || "โหลดโควต้าไม่สำเร็จ");
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
    }
  };

  useEffect(() => {
    load();
    timerRef.current = window.setInterval(load, 15_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = quota?.max ? Math.min((quota.used / quota.max) * 100, 100) : 0;
  const barColor = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-emerald-500";
  const remainingColor = pct > 85 ? "text-red-400" : pct > 60 ? "text-yellow-400" : "text-emerald-400";

  return (
    <div className="glass-card !p-4 !rounded-2xl border border-primary/20">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center shrink-0">
          <Zap size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">โควต้าตรวจสลิป</p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              Realtime
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            อัปเดตทุก 15 วินาที {lastUpdate && `• ${lastUpdate.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-8 h-8 rounded-lg bg-muted/30 hover:bg-muted/50 flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label="รีเฟรช"
        >
          <RefreshCw size={13} className={`text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && !quota ? (
        <p className="text-xs text-muted-foreground text-center py-2">{error}</p>
      ) : loading && !quota ? (
        <p className="text-xs text-muted-foreground text-center py-2">กำลังโหลดโควต้า...</p>
      ) : quota ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-[9px] text-muted-foreground mb-0.5">ใช้ไป</p>
              <p className="text-sm font-bold text-foreground">{quota.used.toLocaleString()}</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-[9px] text-muted-foreground mb-0.5">คงเหลือ</p>
              <p className={`text-sm font-bold ${remainingColor}`}>
                {quota.remaining !== null ? quota.remaining.toLocaleString() : "∞"}
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/20">
              <p className="text-[9px] text-muted-foreground mb-0.5">ทั้งหมด</p>
              <p className="text-sm font-bold text-foreground">
                {quota.max !== null ? quota.max.toLocaleString() : "∞"}
              </p>
            </div>
          </div>
          {quota.max && (
            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>การใช้งาน</span>
                <span>{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default SlipQuotaLive;
