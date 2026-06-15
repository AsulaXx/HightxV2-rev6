import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Archive, Search, Copy, Package, Clock, User, CalendarDays } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { toast } from "sonner";

interface ArchivedKey {
  id: string;
  key: string;
  productId: string;
  durationId: string;
  claimedBy: string;
  claimedByName?: string;
  claimedByEmail?: string;
  claimedAt: { seconds: number } | null;
  archivedAt: { seconds: number } | null;
  claimNote?: string;
}

const ArchivedKeysPage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const isAdmin = hasPermission("admin");

  const [keys, setKeys] = useState<ArchivedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user || !isAdmin) return;
    const loadArchived = async () => {
      try {
        const q = query(collection(db, "archivedKeys"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as ArchivedKey))
          .sort((a, b) => (b.claimedAt?.seconds || 0) - (a.claimedAt?.seconds || 0));
        setKeys(data);
      } catch (err) {
        console.error("Failed to load archived keys:", err);
        toast.error("โหลดคีย์ Archive ล้มเหลว");
      }
      setLoading(false);
    };
    loadArchived();
  }, [user, isAdmin]);

  if (!user) return <RedirectToLogin />;
  if (!isAdmin) return <Navigate to="/hub" replace />;

  const getProductName = (productId: string) => {
    const product = (settings.products || []).find((p) => p.id === productId);
    return product?.name || "สินค้า";
  };

  const getDurationLabel = (productId: string, durationId: string) => {
    const product = (settings.products || []).find((p) => p.id === productId);
    const duration = product?.durations.find((d) => d.id === durationId);
    return duration?.label || "-";
  };

  const formatDate = (timestamp: { seconds: number } | null) => {
    if (!timestamp) return "-";
    return new Date(timestamp.seconds * 1000).toLocaleString("th-TH");
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("คัดลอกคีย์สำเร็จ!");
  };

  const filteredKeys = keys.filter((k) => {
    if (filterProduct && k.productId !== filterProduct) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !k.key.toLowerCase().includes(q) &&
        !getProductName(k.productId).toLowerCase().includes(q) &&
        !(k.claimedByEmail || "").toLowerCase().includes(q) &&
        !(k.claimedByName || "").toLowerCase().includes(q)
      )
        return false;
    }
    if (dateFrom && k.claimedAt) {
      const d = new Date(k.claimedAt.seconds * 1000);
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      if (d < from) return false;
    }
    if (dateTo && k.claimedAt) {
      const d = new Date(k.claimedAt.seconds * 1000);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (d > to) return false;
    }
    return true;
  });

  const products = settings.products || [];

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "คีย์ Archive" }]}
        title="คีย์ Archive"
        subtitle={`${keys.length} คีย์ทั้งหมด`}
        icon={Archive}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass w-full pl-9 pr-4 py-2.5 text-sm"
              placeholder="ค้นหาคีย์, ชื่อสินค้า, ผู้ใช้..."
            />
          </div>
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="input-glass px-3 py-2.5 text-sm"
          >
            <option value="">ทุกสินค้า</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1">
            <CalendarDays size={14} className="text-muted-foreground shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-glass w-full px-3 py-2 text-sm" />
          </div>
          <span className="text-muted-foreground text-sm self-center hidden sm:block">ถึง</span>
          <div className="flex items-center gap-2 flex-1">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-glass w-full px-3 py-2 text-sm" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="btn-glass px-3 py-2 text-xs">ล้าง</button>
          )}
        </div>

        {/* Stats */}
        <div className="rounded-xl border border-border bg-card p-3 mb-4 flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">แสดง</span>
          <span className="font-bold text-primary">{filteredKeys.length}</span>
          <span className="text-muted-foreground">/ {keys.length} รายการ</span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card text-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <div className="rounded-xl border border-border bg-card text-center py-16">
            <Archive size={36} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {keys.length === 0 ? "ยังไม่มีคีย์ Archive" : "ไม่พบผลลัพธ์"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredKeys.map((k, i) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="p-3.5 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="badge-primary flex items-center gap-0.5">
                        <Package size={8} /> {getProductName(k.productId)}
                      </span>
                      <span className="badge-date flex items-center gap-0.5">
                        <Clock size={8} /> {getDurationLabel(k.productId, k.durationId)}
                      </span>
                    </div>
                    <code className="text-xs font-mono block truncate text-primary">{k.key}</code>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <User size={9} /> {k.claimedByName || k.claimedByEmail || k.claimedBy}
                      </span>
                      <span>กดเมื่อ: {formatDate(k.claimedAt)}</span>
                      <span className="text-primary/60">Archive: {formatDate(k.archivedAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyKey(k.key)}
                    className="btn-glass px-2.5 py-1.5 text-[10px] flex items-center gap-1 shrink-0"
                  >
                    <Copy size={10} /> คัดลอก
                  </button>
                </div>
                {k.claimNote && (
                  <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/15 text-[10px] text-foreground">
                    <span className="font-medium text-primary">📝</span> {k.claimNote}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ArchivedKeysPage;
