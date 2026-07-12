import { motion } from "framer-motion";
import { Coins, Layers, ShoppingBag, ChevronDown, Cog, Ban, PackageX, Star } from "lucide-react";
import type { LayoutConfig } from "@/contexts/SiteSettingsContext";

type Variant = NonNullable<LayoutConfig["productCardVariant"]>;
type Status = "available" | "updating" | "closed" | "oos";

const RATIO_CLASS: Record<string, string> = {
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "3:2": "aspect-[3/2]",
  "16:9": "aspect-video",
};

const RADIUS_CLASS: Record<string, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
};

const statusTint = (s: Status) => {
  if (s === "updating") return { wash: "from-amber-500/25 via-amber-500/5 to-transparent", chip: "bg-amber-500/15 border-amber-400/40 text-amber-300", dot: "bg-amber-400", Icon: Cog, label: "กำลังอัพเดท", anim: "animate-spin-slow" };
  if (s === "closed") return { wash: "from-red-500/25 via-red-500/5 to-transparent", chip: "bg-red-500/15 border-red-400/40 text-red-300", dot: "bg-red-400", Icon: Ban, label: "ปิดการขาย", anim: "" };
  if (s === "oos") return { wash: "from-slate-500/25 via-slate-500/5 to-transparent", chip: "bg-slate-500/20 border-slate-300/30 text-slate-200", dot: "bg-slate-300", Icon: PackageX, label: "สินค้าหมด", anim: "" };
  return null;
};

interface Props {
  variant: Variant;
  layout: LayoutConfig;
  status?: Status;
  mockName?: string;
  mockDesc?: string;
  mockPrice?: string;
}

/**
 * Visual preview of a store product card, mirroring StorePage variants.
 * Purely presentational — no data fetching, safe to render in admin.
 */
const AdminCardPreview = ({
  variant,
  layout,
  status = "available",
  mockName = "ตัวอย่างสินค้า Premium",
  mockDesc = "คำอธิบายสินค้าสั้นๆ สำหรับดูตัวอย่างการแสดงผลของการ์ด",
  mockPrice = "49 - 199",
}: Props) => {
  const radius = RADIUS_CLASS[layout.cardRadius] || "rounded-2xl";
  const ratio = RATIO_CLASS[layout.productImageRatio] || "aspect-[3/2]";
  const showImage = layout.showProductImage !== false;
  const imgFit = layout.productImageFit === "contain" ? "object-contain p-2" : "object-cover";
  const useRatio = layout.productImageDisplay === "ratio";
  const padding = layout.cardStyle === "compact" ? "p-2.5" : layout.cardStyle === "spacious" ? "p-5" : "p-3.5";
  const tint = statusTint(status);

  const Badge = () => (
    <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-primary/30 text-primary flex items-center gap-1 shadow-sm">
      <Layers size={9} />
      <span className="text-[9px] font-semibold leading-none">3</span>
    </div>
  );

  const StatusOverlay = () => tint && (
    <>
      <div className={`absolute inset-0 bg-gradient-to-tr ${tint.wash} pointer-events-none`} />
      <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay" style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 8px)" }} />
      <div className={`absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md border ${tint.chip} shadow-sm`}>
        <span className="relative flex w-1.5 h-1.5">
          <span className={`absolute inline-flex h-full w-full rounded-full ${tint.dot} opacity-70 animate-ping`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${tint.dot}`} />
        </span>
        <tint.Icon size={11} strokeWidth={2.4} className={`shrink-0 ${tint.anim}`} />
        <span className="text-[9px] font-semibold tracking-wide uppercase truncate">{tint.label}</span>
      </div>
    </>
  );

  const Info = ({ compact = false }: { compact?: boolean }) => (
    <div className={`flex-1 min-w-0 ${padding} flex flex-col gap-1.5 ${compact ? "" : "justify-between"}`}>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2">{mockName}</h3>
        <div className="flex items-center gap-0.5 mt-0.5">
          {[1,2,3,4,5].map(i => <Star key={i} size={10} className="fill-amber-400 text-amber-400" />)}
          <span className="text-[9px] text-muted-foreground ml-1">(12)</span>
        </div>
        {!compact && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{mockDesc}</p>}
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/25">
          <Coins size={10} className="text-primary" />
          <span className="text-[11px] font-bold text-primary">
            {mockPrice}<span className="ml-1 text-[9px] font-medium text-primary/70">เครดิต</span>
          </span>
        </div>
      </div>
      {!compact && (
        <button className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-primary rounded-lg border border-primary/30 hover:bg-primary/90 hover:text-primary-foreground hover:border-primary transition-colors">
          สั่งซื้อสินค้า
          <ChevronDown size={12} className="-rotate-90" />
        </button>
      )}
    </div>
  );

  // ═══════════════ SPLIT ═══════════════
  if (variant === "split") {
    return (
      <motion.div
        initial={false}
        whileHover={{ y: -3, scale: 1.015 }}
        transition={{ type: "spring", stiffness: 400, damping: 14 }}
        className={`glass-card-hover overflow-hidden !p-0 group ${radius} cursor-pointer relative flex flex-row`}
      >
        {showImage ? (
          <div className="relative shrink-0 w-[38%] max-w-[160px] min-w-[110px] bg-gradient-to-br from-primary/10 via-muted/10 to-accent/10 overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400"
              alt="preview"
              className={`w-full h-full ${imgFit} transition-transform duration-500 group-hover:scale-110 ${status !== "available" ? "grayscale-[35%] opacity-80" : ""}`}
            />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/60 to-transparent pointer-events-none" />
            <Badge />
            <StatusOverlay />
          </div>
        ) : (
          <div className="relative shrink-0 w-[30%] max-w-[130px] min-w-[90px] bg-gradient-to-br from-primary/25 via-primary/10 to-accent/25 flex items-center justify-center">
            <ShoppingBag size={26} className="text-primary/70" />
          </div>
        )}
        <Info />
      </motion.div>
    );
  }

  // ═══════════════ POSTER ═══════════════
  if (variant === "poster") {
    return (
      <motion.div
        initial={false}
        whileHover={{ y: -3, scale: 1.015 }}
        transition={{ type: "spring", stiffness: 400, damping: 14 }}
        className={`glass-card-hover overflow-hidden !p-0 group ${radius} cursor-pointer relative`}
      >
        {showImage && (
          <div className={`overflow-hidden relative bg-muted/20 ${useRatio ? ratio : "h-32 sm:h-36"}`}>
            <img
              src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600"
              alt="preview"
              className={`w-full h-full ${imgFit} transition-transform duration-500 group-hover:scale-105 ${status !== "available" ? "grayscale-[35%] opacity-80" : ""}`}
            />
            <div className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-primary/30 text-primary flex items-center gap-1 shadow-sm">
              <Layers size={9} />
              <span className="text-[9px] font-semibold leading-none">3</span>
            </div>
            <StatusOverlay />
          </div>
        )}
        <Info />
      </motion.div>
    );
  }

  // ═══════════════ COMPACT ═══════════════
  return (
    <motion.div
      initial={false}
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 400, damping: 14 }}
      className={`glass-card-hover overflow-hidden !p-2.5 group ${radius} cursor-pointer relative flex items-center gap-3`}
    >
      {showImage && (
        <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-primary/15 to-accent/10">
          <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200" alt="preview" className={`w-full h-full ${imgFit} ${status !== "available" ? "grayscale-[35%] opacity-80" : ""}`} />
          {tint && <div className={`absolute inset-0 bg-gradient-to-tr ${tint.wash}`} />}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-xs font-bold text-foreground truncate">{mockName}</h3>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
            <Coins size={9} className="text-primary" />
            <span className="text-[10px] font-bold text-primary">{mockPrice}</span>
          </div>
          {tint && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${tint.chip} text-[9px] font-semibold uppercase`}>
              <tint.Icon size={9} className={tint.anim} />
              {tint.label}
            </span>
          )}
        </div>
      </div>
      <ChevronDown size={14} className="text-muted-foreground -rotate-90 shrink-0" />
    </motion.div>
  );
};

export default AdminCardPreview;
