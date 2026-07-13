import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShoppingBag, Wallet, Users, Package, Boxes, ShoppingCart } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import logo from "@/assets/logo.png";

interface Props {
  stats: { users: number; stock: number; sales: number };
  productsCount: number;
}

/**
 * V2 (Awang-style) hero + welcome + stats block.
 * Rendered on the homepage when settings.uiVersion === "v2".
 */
const HomeV2Hero = ({ stats, productsCount }: Props) => {
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();

  const heroImg = settings.heroImageUrl || settings.logoUrl || logo;
  const brand = settings.brandName || "SHOP";
  const subtitle =
    settings.subtitle ||
    "แหล่งรวมสินค้าและบริการที่คุณต้องการ พร้อมทีมงานดูแลและให้คำแนะนำตลอด 24 ชั่วโมง";

  const statCards = [
    { icon: Users, label: "ผู้ใช้งาน", value: stats.users, unit: "คน" },
    { icon: Package, label: "สินค้า", value: productsCount, unit: "รายการ" },
    { icon: Boxes, label: "คลังสินค้า", value: stats.stock, unit: "ชิ้น" },
    { icon: ShoppingCart, label: "ขายแล้ว", value: stats.sales, unit: "ชิ้น" },
  ];

  return (
    <div className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pt-6 sm:pt-8`}>
      {/* Full-bleed hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full overflow-hidden rounded-2xl border border-primary/20"
        style={{ boxShadow: "0 20px 60px -20px hsl(265 90% 40% / 0.5)" }}
      >
        <img
          src={heroImg}
          alt={`${brand} banner`}
          className="w-full h-auto object-cover block"
          style={{ aspectRatio: heroImg === logo ? "16/6" : undefined }}
        />
        {/* Subtle bottom vignette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
      </motion.div>

      {/* Welcome row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border border-primary/30 bg-primary/10 text-primary-glow mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-glow shadow-[0_0_8px_hsl(var(--primary-glow))]" />
            {brand.toUpperCase()}
          </span>
          <h1 className="text-2xl sm:text-3xl lg:text-[32px] font-bold tracking-tight text-foreground leading-tight">
            ยินดีต้อนรับสู่ร้าน <span className="gradient-text">{brand}</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            to="/store"
            className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <ShoppingBag size={15} /> ดูสินค้าทั้งหมด
          </Link>
          <Link
            to="/topup"
            className="btn-glass inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Wallet size={15} /> เติมเงิน
          </Link>
        </div>
      </motion.div>

      {/* Stat cards — 4 cards awang-style */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
            className="glass-card relative overflow-hidden !p-4 sm:!p-5"
          >
            {/* Watermark icon */}
            <s.icon
              className="pointer-events-none absolute -right-3 -bottom-3 text-primary/10"
              size={92}
              strokeWidth={1.5}
              aria-hidden
            />
            {/* Label row */}
            <div className="relative flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/15 text-primary-glow">
                <s.icon size={12} />
              </span>
              {s.label}
            </div>
            {/* Big number */}
            <div className="relative mt-3 flex items-baseline gap-1.5">
              <span className="v2-stat-num text-2xl sm:text-3xl lg:text-4xl">
                {s.value.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">{s.unit}</span>
            </div>
            {/* Underline accent */}
            <div className="relative mt-2 v2-underline" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HomeV2Hero;
