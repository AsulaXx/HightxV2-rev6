import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Wrench, XCircle, Activity } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { useSiteSettings, Product } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { useMemo, useState } from "react";
import { ArrowUpDown, Search, X } from "lucide-react";

type SortKey = "severity-desc" | "severity-asc" | "name-asc" | "name-desc";
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "severity-desc", label: "ความรุนแรงมาก → น้อย / Severity (high → low)" },
  { value: "severity-asc",  label: "ความรุนแรงน้อย → มาก / Severity (low → high)" },
  { value: "name-asc",      label: "ชื่อสินค้า A → Z / Name (A → Z)" },
  { value: "name-desc",     label: "ชื่อสินค้า Z → A / Name (Z → A)" },
];

type StatusKey = NonNullable<Product["publicStatus"]>;

const STATUS_META: Record<StatusKey, {
  th: string;
  en: string;
  desc_th: string;
  desc_en: string;
  icon: typeof CheckCircle2;
  color: string;       // text + icon
  ring: string;        // border
  bg: string;          // background
  dot: string;         // pulsing dot
  order: number;
}> = {
  safe: {
    th: "ปลอดภัย", en: "Safe",
    desc_th: "ใช้งานได้ตามปกติ", desc_en: "Operational",
    icon: CheckCircle2,
    color: "text-emerald-400",
    ring: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    order: 0,
  },
  risky: {
    th: "เล่นด้วยความเสี่ยง", en: "Use at your own risk",
    desc_th: "อาจมีปัญหา โปรดใช้งานอย่างระมัดระวัง",
    desc_en: "May have issues, use with caution",
    icon: AlertTriangle,
    color: "text-orange-400",
    ring: "border-orange-500/30",
    bg: "bg-orange-500/10",
    dot: "bg-orange-400",
    order: 1,
  },
  updating: {
    th: "กำลังอัปเดท", en: "Updating",
    desc_th: "อยู่ระหว่างปรับปรุง โปรดรอ",
    desc_en: "Currently being updated, please wait",
    icon: Wrench,
    color: "text-yellow-400",
    ring: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    dot: "bg-yellow-400",
    order: 2,
  },
  closed: {
    th: "ปิดการขาย", en: "Closed",
    desc_th: "หยุดให้บริการชั่วคราว",
    desc_en: "Temporarily unavailable",
    icon: XCircle,
    color: "text-red-400",
    ring: "border-red-500/30",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
    order: 3,
  },
};

const STATUS_ORDER: StatusKey[] = ["safe", "risky", "updating", "closed"];

const ProductStatusPage = () => {
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();

  const products = useMemo(
    () => (settings.products || []).filter(
      (p) => p.enabled !== false && p.showOnStatusPage !== false
    ),
    [settings.products]
  );

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { safe: 0, risky: 0, updating: 0, closed: 0 };
    products.forEach((p) => {
      const s = (p.publicStatus || "safe") as StatusKey;
      c[s] += 1;
    });
    return c;
  }, [products]);

  // Overall: majority status wins (tie-break: worst order)
  const overall: StatusKey = useMemo(() => {
    let best: StatusKey = "safe";
    let bestCount = -1;
    STATUS_ORDER.forEach((k) => {
      const n = counts[k];
      if (n > bestCount || (n === bestCount && STATUS_META[k].order > STATUS_META[best].order)) {
        bestCount = n;
        best = k;
      }
    });
    return best;
  }, [counts]);

  const overallMeta = STATUS_META[overall];

  const [sortKey, setSortKey] = useState<SortKey>("severity-asc");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.publicStatusNote || "").toLowerCase().includes(q)
        )
      : [...products];
    arr.sort((a, b) => {
      const sa = STATUS_META[(a.publicStatus || "safe") as StatusKey].order;
      const sb = STATUS_META[(b.publicStatus || "safe") as StatusKey].order;
      switch (sortKey) {
        case "severity-asc":
          if (sa !== sb) return sa - sb;
          return a.name.localeCompare(b.name);
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "severity-desc":
        default:
          if (sb !== sa) return sb - sa;
          return a.name.localeCompare(b.name);
      }
    });
    return arr;
  }, [products, sortKey, search]);

  return (
    <div className={`${maxWidthClass} mx-auto px-4 sm:px-6 py-8 space-y-6`}>
      <PageBreadcrumb
        items={[{ label: "สถานะสินค้า / Product Status" }]}
        title="สถานะสินค้า / Product Status"
        subtitle="สถานะการใช้งานปัจจุบันของสินค้าทุกรายการ · Real-time status of all products"
        icon={Activity}
      />

      {/* Hero / Overall status */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`glass-card p-6 sm:p-8 border ${overallMeta.ring} ${overallMeta.bg}`}
      >
        <div className="flex items-start gap-4">
          <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center ${overallMeta.bg} border ${overallMeta.ring}`}>
            <overallMeta.icon className={`w-6 h-6 ${overallMeta.color}`} />
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${overallMeta.dot} animate-pulse`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity size={12} /> ภาพรวมระบบ / Overall System
            </div>
            <h1 className={`text-xl sm:text-2xl font-bold ${overallMeta.color} mt-1`}>
              {overallMeta.th} <span className="text-foreground/60 font-normal">/ {overallMeta.en}</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {overallMeta.desc_th} · {overallMeta.desc_en}
            </p>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          {STATUS_ORDER.map((key) => {
            const m = STATUS_META[key];
            return (
              <div key={key} className={`rounded-xl border ${m.ring} ${m.bg} p-3`}>
                <div className="flex items-center gap-2">
                  <m.icon size={14} className={m.color} />
                  <span className="text-[11px] text-muted-foreground">{m.en}</span>
                </div>
                <div className={`text-2xl font-bold ${m.color} leading-tight mt-0.5`}>{counts[key]}</div>
                <div className="text-[10px] text-muted-foreground">{m.th}</div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Legend */}
      <div className="glass-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">คำอธิบายสถานะ / Status Legend</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {STATUS_ORDER.map((key) => {
            const m = STATUS_META[key];
            return (
              <div key={key} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.bg} border ${m.ring} shrink-0`}>
                  <m.icon size={14} className={m.color} />
                </div>
                <div className="text-xs">
                  <div className={`font-semibold ${m.color}`}>{m.th} / {m.en}</div>
                  <div className="text-muted-foreground mt-0.5">{m.desc_th} · {m.desc_en}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product list */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-base font-semibold text-foreground">
            รายการสินค้า / Products <span className="text-xs text-muted-foreground font-normal">({sorted.length})</span>
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาสินค้า / Search…"
                className="input-glass pl-7 pr-7 py-1.5 text-xs w-44 sm:w-56"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="ล้างคำค้นหา"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowUpDown size={12} />
              <span className="hidden sm:inline">เรียงโดย / Sort by:</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="input-glass px-2 py-1.5 text-xs"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            ไม่มีสินค้าแสดงในขณะนี้ / No products available
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((p, i) => {
              const key = (p.publicStatus || "safe") as StatusKey;
              const m = STATUS_META[key];
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${m.ring} ${m.bg} hover:bg-opacity-20 transition-colors`}
                >
                  {p.imageUrl && (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                    {p.publicStatusNote && (
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{p.publicStatusNote}</div>
                    )}
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${m.ring} ${m.bg} shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.dot} animate-pulse`} />
                    <m.icon size={12} className={m.color} />
                    <span className={`text-[11px] font-semibold ${m.color} hidden sm:inline`}>
                      {m.th} / {m.en}
                    </span>
                    <span className={`text-[11px] font-semibold ${m.color} sm:hidden`}>{m.en}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        อัปเดตล่าสุด / Last updated: {new Date().toLocaleString("th-TH")}
      </p>
    </div>
  );
};

export default ProductStatusPage;
