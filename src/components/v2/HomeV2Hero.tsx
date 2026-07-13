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
  const sceneRef = useRef<HTMLDivElement>(null);
  const hero = settings.heroBanner || ({} as any);

  const imageEnabled = hero.imageEnabled !== false;
  const heroImg = hero.imageUrl || settings.heroImageUrl || settings.logoUrl || logo;
  const logoImg = settings.logoUrl || logo;
  const heroAutoFitLegacy = hero.imageAutoFit === true;
  const heroHeightPref = hero.imageHeight ?? 320;
  const heroFit = hero.imageFit || "cover";
  const heroRadius = hero.imageRadius ?? 20;
  const posX = typeof hero.imagePositionX === "number" ? hero.imagePositionX : 50;
  const posY = typeof hero.imagePositionY === "number" ? hero.imagePositionY : 50;
  const objectPosition = `${posX}% ${posY}%`;
  const mobileMode: "banner" | "logo" = hero.mobileMode || "logo";
  const forceLogoMode = hero.forceLogoMode === true;
  const brand = settings.brandName || "SHOP";
  const subtitle =
    settings.subtitle ||
    "แหล่งรวมสินค้าและบริการที่คุณต้องการ พร้อมทีมงานดูแลและให้คำแนะนำตลอด 24 ชั่วโมง";

  const [containerW, setContainerW] = useState<number>(0);
  const [logoFallback, setLogoFallback] = useState(false);

  useEffect(() => {
    if (!sceneRef.current) return;
    const el = sceneRef.current;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setContainerW(w);
    });
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setLogoFallback(false);
    const img = new Image();
    img.onerror = () => setLogoFallback(true);
    img.src = heroImg;
  }, [heroImg]);

  const isMobile = containerW > 0 && containerW < 640;
  const isTablet = containerW >= 640 && containerW < 1024;
  const isDesktop = containerW >= 1024;
  const autoFitDesktop = hero.imageAutoFitDesktop ?? heroAutoFitLegacy;
  const autoFitTablet = hero.imageAutoFitTablet ?? heroAutoFitLegacy;
  const autoFitMobile = hero.imageAutoFitMobile ?? heroAutoFitLegacy;
  const heroAutoFit = isMobile ? autoFitMobile : isTablet ? autoFitTablet : isDesktop ? autoFitDesktop : autoFitDesktop;
  const useLogoMode = forceLogoMode || logoFallback || (isMobile && mobileMode === "logo");

  const mobileH = 180;
  const finalHeight = heroAutoFit ? undefined : (isMobile ? mobileH : heroHeightPref);
  const finalFit: React.CSSProperties["objectFit"] = heroAutoFit
    ? "contain"
    : useLogoMode
    ? "contain"
    : (heroFit as any);
  const displayedImg = useLogoMode ? logoImg : heroImg;





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

  const pos = settings.statsPosition || "top";
  const isSide = pos === "left" || pos === "right";

  const SideStatsColumn = () => (
    <aside aria-label="สถิติผู้ใช้งาน" className="hidden lg:flex flex-col gap-3 w-56 shrink-0 self-stretch">
      {statCards.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, x: pos === "left" ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + i * 0.06, duration: 0.4 }}
          className="glass-card v2-stat-3d relative overflow-hidden !p-4 flex-1"
        >
          <s.icon className="pointer-events-none absolute -right-3 -bottom-3 text-primary/10" size={72} strokeWidth={1.5} aria-hidden />
          <div className="relative flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/15 text-primary">
              <s.icon size={12} />
            </span>
            {s.label}
          </div>
          <div className="relative mt-2 flex items-baseline gap-1.5">
            <span className="v2-stat-num text-2xl lg:text-3xl">{s.value.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">{s.unit}</span>
          </div>
          <div className="relative mt-2 v2-underline" />
        </motion.div>
      ))}
    </aside>
  );

  return (
    <div className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pt-6 sm:pt-8`}>
      {imageEnabled && (
        <div className={`flex flex-col ${isSide ? "lg:flex-row" : ""} gap-4 lg:gap-5 items-stretch`}>
          {isSide && pos === "left" && <SideStatsColumn />}
          <div ref={sceneRef} className="v2-hero-scene flex-1 min-w-0" onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
            <motion.div
              ref={heroRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="v2-hero-3d relative w-full overflow-hidden border border-primary/25"
              style={{
                height: heroAutoFit ? "auto" : `${finalHeight}px`,
                borderRadius: `${heroRadius}px`,
                boxShadow: "0 30px 80px -30px hsl(var(--primary) / 0.55), 0 0 0 1px hsl(var(--primary) / 0.15)",
                background: useLogoMode
                  ? "radial-gradient(120% 100% at 50% 0%, hsl(var(--primary) / 0.22), transparent 60%), linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)"
                  : undefined,
              }}
            >
              <img
                src={displayedImg}
                alt={`${brand} banner`}
                className={
                  heroAutoFit
                    ? "v2-hero-img relative w-full h-auto block"
                    : useLogoMode
                    ? "v2-hero-img absolute inset-0 m-auto block max-w-[46%] max-h-[70%] drop-shadow-[0_10px_30px_hsl(var(--primary)/0.45)]"
                    : "v2-hero-img absolute inset-0 w-full h-full block"
                }
                style={{ objectFit: finalFit, objectPosition: useLogoMode ? "center" : objectPosition }}
              />
              <div className="v2-hero-shine pointer-events-none absolute inset-0" aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/85 to-transparent" />
              <div className="v2-hero-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
            </motion.div>
          </div>
          {isSide && pos === "right" && <SideStatsColumn />}
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

      {/* Stat cards — bottom grid (hidden on lg+ when moved beside hero) */}
      <div className={`mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${isSide ? "lg:hidden" : ""}`}>
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
            <s.icon className="pointer-events-none absolute -right-3 -bottom-3 text-primary/10" size={92} strokeWidth={1.5} aria-hidden />
            <div className="relative flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/15 text-primary">
                <s.icon size={12} />
              </span>
              {s.label}
            </div>
            <div className="relative mt-3 flex items-baseline gap-1.5">
              <span className="v2-stat-num text-2xl sm:text-3xl lg:text-4xl">{s.value.toLocaleString()}</span>
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
