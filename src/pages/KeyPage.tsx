import RedirectToLogin from "@/components/RedirectToLogin";
import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import { Key, Copy, RefreshCw, KeyRound } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { useEffect, useCallback } from "react";

const KeyPage = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const [loading, setLoading] = useState(false);
  const [myKeys, setMyKeys] = useState<any[]>([]);
  const [availableCount, setAvailableCount] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [claimedSnap, availableSnap] = await Promise.all([
        getDocs(query(collection(db, "keys"), where("claimedBy", "==", user.uid), where("claimed", "==", true))),
        getDocs(query(collection(db, "keys"), where("claimed", "==", false))),
      ]);
      setMyKeys(claimedSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAvailableCount(availableSnap.size);
    } catch (err) { console.error("Failed to load keys:", err); }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user && settings.keySystemEnabled) loadData(); }, [user, settings.keySystemEnabled, loadData]);

  if (!user || !profile) return <RedirectToLogin />;
  if (!settings.keySystemEnabled) return <Navigate to="/" replace />;

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success("คัดลอกคีย์สำเร็จ!"); };

  return (
    <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Key size={20} className="text-primary" /> กดคีย์สินค้า
        </h1>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "คีย์ว่าง", value: availableCount ?? "..." },
            { label: "คีย์ของคุณ", value: myKeys.length },
            { label: "สิทธิ์สูงสุด", value: settings.maxKeysPerUser },
          ].map((s) => (
            <div key={s.label} className="stat-card text-center">
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <button onClick={loadData} disabled={loading} className="btn-glass w-full py-2.5 text-xs flex items-center justify-center gap-1.5 mb-4">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> รีเฟรช
        </button>

        {myKeys.length > 0 && (
          <div className="glass-card space-y-2 !rounded-2xl">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5"><KeyRound size={14} className="text-primary" /> คีย์ของคุณ</h2>
            {myKeys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
                <div>
                  <code className="text-xs font-mono text-primary">{k.key || "N/A"}</code>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{settings.products?.find((p) => p.id === k.productId)?.name || k.productId}</p>
                </div>
                <button onClick={() => copyKey(k.key)} className="btn-glass px-2 py-1.5 text-[10px] flex items-center gap-0.5"><Copy size={10} /> คัดลอก</button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default KeyPage;
