import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, Wallet, Users, Package, Boxes, ShoppingCart } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import logo from "@/assets/logo.png";

interface Props {
  stats: { users: number; stock: number; sales: number };
  productsCount: number;
}


/**
 * V2 hero — full-bleed banner with 3D tilt, parallax shine, and floating stat cards.
 */
const HomeV2Hero = ({ stats, productsCount }: Props) => {
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();
  const heroRef = useRef<HTMLDivElement>(null);
  const hero = settings.heroBanner || ({} as any);

  const imageEnabled = hero.imageEnabled !== false;
  const heroImg = hero.imageUrl || settings.heroImageUrl || settings.logoUrl || logo;
  const heroAutoFit = hero.imageAutoFit === true;
  const heroHeight = hero.imageHeight ?? 320;
  const heroFit = hero.imageFit || "cover";
  const heroRadius = hero.imageRadius ?? 20;
  const brand = settings.brandName || "SHOP";
  const subtitle =
    settings.subtitle ||
    "แหล่งรวมสินค้าและบริการที่คุณต้องการ พร้อมทีมงานดูแลและให้คำแนะนำตลอด 24 ชั่วโมง";

  // 3D tilt on mouse move
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  };
  const onMouseLeave = () => {
    const el = heroRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const statCards = [
    { icon: Users, label: "ผู้ใช้งาน", value: stats.users, unit: "คน" },
    { icon: Package, label: "สินค้า", value: productsCount, unit: "รายการ" },
    { icon: Boxes, label: "คลังสินค้า", value: stats.stock, unit: "ชิ้น" },
    { icon: ShoppingCart, label: "ขายแล้ว", value: stats.sales, unit: "ชิ้น" },
  ];

  return (
    <div className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pt-6 sm:pt-8`}>
      {imageEnabled && (
        <div className="v2-hero-scene" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
          <motion.div
            ref={heroRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="v2-hero-3d relative w-full overflow-hidden border border-primary/25"
            style={{
              height: heroAutoFit ? "auto" : `${heroHeight}px`,
              borderRadius: `${heroRadius}px`,
              boxShadow: "0 30px 80px -30px hsl(var(--primary) / 0.55), 0 0 0 1px hsl(var(--primary) / 0.15)",
            }}
          >
            <img
              src={heroImg}
              alt={`${brand} banner`}
              className={heroAutoFit ? "v2-hero-img relative w-full h-auto block" : "v2-hero-img absolute inset-0 w-full h-full block"}
              style={{ objectFit: heroAutoFit ? "contain" : heroFit }}
            />
            {/* Parallax shine sweep */}
            <div className="v2-hero-shine pointer-events-none absolute inset-0" aria-hidden />
            {/* Vignette */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/85 to-transparent" />
            {/* Grid overlay for depth */}
            <div className="v2-hero-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          </motion.div>
        </div>
      )}

      {/* Welcome row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border border-primary/30 bg-primary/10 text-primary mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
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
          <Link to="/store" className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <ShoppingBag size={15} /> ดูสินค้าทั้งหมด
          </Link>
          <Link to="/topup" className="btn-glass inline-flex items-center gap-2 px-5 py-2.5 text-sm">
            <Wallet size={15} /> เติมเงิน
          </Link>
        </div>
      </motion.div>

      {/* Stat cards — 3D hover lift */}
      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
            whileHover={{ y: -4, rotateX: 4, rotateY: -4 }}
            style={{ transformStyle: "preserve-3d", perspective: 800 }}
            className="glass-card v2-stat-3d relative overflow-hidden !p-4 sm:!p-5"
          >
            <s.icon
              className="pointer-events-none absolute -right-3 -bottom-3 text-primary/10"
              size={92}
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="relative flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/15 text-primary">
                <s.icon size={12} />
              </span>
              {s.label}
            </div>
            <div className="relative mt-3 flex items-baseline gap-1.5">
              <span className="v2-stat-num text-2xl sm:text-3xl lg:text-4xl">
                {s.value.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">{s.unit}</span>
            </div>
            <div className="relative mt-2 v2-underline" />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HomeV2Hero;
