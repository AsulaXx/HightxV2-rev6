import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity, Clock, Shield, Database, Zap, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/errorLogger";

interface ServiceStatus {
  name: string;
  status: "operational" | "degraded" | "down";
  latencyMs: number;
  message?: string;
}

interface HealthResponse {
  overall: "operational" | "degraded" | "down";
  services: ServiceStatus[];
  checkedAt: string;
}

const statusColors = {
  operational: "text-emerald-400",
  degraded: "text-yellow-400",
  down: "text-red-400",
};

const statusDots = {
  operational: "bg-emerald-400",
  degraded: "bg-yellow-400",
  down: "bg-red-400",
};

const statusLabels = {
  operational: "ปกติ",
  degraded: "ช้า",
  down: "ขัดข้อง",
};

const serviceIcons: Record<string, typeof Activity> = {
  "Firebase Auth": Shield,
  "Firestore": Database,
  "Thunder API": Zap,
  "Edge Functions": Wifi,
};

const AdminStatusWidget = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("health-check");
      if (error) throw error;
      setHealth(data as HealthResponse);
    } catch (err) {
      logError("AdminStatusWidget.fetchHealth", err, "warn");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const OverallIcon = health
    ? health.overall === "operational" ? CheckCircle : health.overall === "degraded" ? AlertTriangle : XCircle
    : Activity;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Activity size={14} className="text-primary" />
          สถานะระบบ
        </h3>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors disabled:opacity-50"
          title="ตรวจสอบอีกครั้ง"
        >
          <RefreshCw size={12} className={loading ? "animate-spin text-muted-foreground" : "text-muted-foreground"} />
        </button>
      </div>

      {/* Overall */}
      <div className="flex items-center gap-2">
        <OverallIcon size={16} className={health ? statusColors[health.overall] : "text-muted-foreground"} />
        <span className={`text-xs font-medium ${health ? statusColors[health.overall] : "text-muted-foreground"}`}>
          {loading ? "กำลังตรวจสอบ..." : health?.overall === "operational" ? "ระบบทั้งหมดปกติ" : health?.overall === "degraded" ? "บางระบบตอบสนองช้า" : "พบปัญหา"}
        </span>
      </div>

      {/* Services */}
      <div className="space-y-1.5">
        {(health?.services ?? []).map((s) => {
          const Icon = serviceIcons[s.name] || Activity;
          return (
            <div key={s.name} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${statusDots[s.status]} animate-pulse`} />
                <Icon size={12} className="text-muted-foreground" />
                <span className="text-[11px] text-foreground">{s.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {s.message && (
                  <span className="text-[10px] text-yellow-400 max-w-[100px] truncate" title={s.message}>
                    {s.message}
                  </span>
                )}
                <span className="text-[10px] font-mono text-muted-foreground">
                  {s.latencyMs > 0 ? `${s.latencyMs}ms` : "—"}
                </span>
                <span className={`text-[10px] font-medium ${statusColors[s.status]}`}>
                  {statusLabels[s.status]}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {health?.checkedAt && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 pt-1 border-t border-border/30">
          <Clock size={10} />
          ตรวจสอบล่าสุด: {new Date(health.checkedAt).toLocaleTimeString("th-TH")}
        </div>
      )}
    </div>
  );
};

export default AdminStatusWidget;
