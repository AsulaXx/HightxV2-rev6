import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, Clock, Wifi, Database, Shield, Zap } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { firebaseConfig } from "@/lib/config";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number;
  message?: string;
  checkedAt: string;
}

interface HealthResponse {
  overall: "operational" | "degraded" | "down";
  services: ServiceStatus[];
  checkedAt: string;
  error?: string;
}

const statusConfig = {
  operational: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "ปกติ", dot: "bg-emerald-400" },
  degraded: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "ช้า", dot: "bg-yellow-400" },
  down: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "ขัดข้อง", dot: "bg-red-400" },
};

const serviceIcons: Record<string, typeof Activity> = {
  "Firebase Auth": Shield,
  "Firestore": Database,
  "Thunder API": Zap,
  "Edge Functions": Wifi,
};

const StatusPage = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { maxWidthClass } = useLayoutConfig();

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (error) throw error;
      setHealth(data as HealthResponse);
      setLastRefresh(new Date());
    } catch {
      setHealth({ overall: "down", services: [], checkedAt: new Date().toISOString(), error: "ไม่สามารถเชื่อมต่อระบบตรวจสอบได้" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // auto-refresh every 60s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const overallConfig = health ? statusConfig[health.overall] : statusConfig.operational;
  const OverallIcon = overallConfig.icon;

  return (
    <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 py-6`}>
      <PageBreadcrumb items={[{ label: "สถานะระบบ" }]} title="สถานะระบบ" subtitle="ตรวจสอบสถานะบริการทั้งหมดแบบ Real-time" />

      <div className="mt-6 space-y-6">
        {/* Overall Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border ${overallConfig.bg} p-6 sm:p-8 text-center`}
        >
          <div className="flex flex-col items-center gap-3">
            {loading ? (
              <RefreshCw size={32} className="text-muted-foreground animate-spin" />
            ) : (
              <OverallIcon size={40} className={overallConfig.color} />
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              {loading ? "กำลังตรวจสอบ..." : health?.overall === "operational" ? "ระบบทั้งหมดทำงานปกติ" : health?.overall === "degraded" ? "บางระบบตอบสนองช้า" : "พบปัญหาในบางระบบ"}
            </h1>
            {health?.error && (
              <p className="text-sm text-muted-foreground">{health.error}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock size={12} />
              <span>
                ตรวจสอบล่าสุด: {lastRefresh ? lastRefresh.toLocaleTimeString("th-TH") : "—"}
              </span>
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="ml-2 p-1 rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-50"
                title="ตรวจสอบอีกครั้ง"
              >
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Service Cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {(health?.services ?? []).map((service, i) => {
            const config = statusConfig[service.status];
            const ServiceIcon = serviceIcons[service.name] || Activity;
            return (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-card p-4 sm:p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${config.bg} border flex items-center justify-center`}>
                      <ServiceIcon size={18} className={config.color} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{service.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-muted-foreground">
                      {service.latencyMs > 0 ? `${service.latencyMs}ms` : "—"}
                    </span>
                  </div>
                </div>
                {service.message && (
                  <p className="mt-2 text-[11px] text-muted-foreground bg-muted/20 rounded-lg px-2.5 py-1.5">
                    {service.message}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Info */}
        <div className="text-center text-xs text-muted-foreground/60 py-4">
          <p>ระบบตรวจสอบสถานะอัตโนมัติทุก 60 วินาที</p>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
