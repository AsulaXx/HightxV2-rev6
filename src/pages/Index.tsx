import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { X, ExternalLink, ArrowRight, ChevronRight, Volume2, LogIn, Megaphone, Star, Package, Wallet, Navigation, Users, BoxesIcon, ShoppingCart, Wrench, RefreshCw, ShoppingBag } from "lucide-react";
import logo from "@/assets/logo.png";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as fbLimit, getCountFromServer, where } from "firebase/firestore";
import { cachedQuery, invalidateCache } from "@/lib/firestoreCache";
import TypingText from "@/components/TypingText";
import Reveal, { RevealGroup } from "@/components/Reveal";
import { useMouseParallax } from "@/hooks/useMouseParallax";
import HomeV2Hero from "@/components/v2/HomeV2Hero";

interface Announcement {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  pinned: boolean;
  createdByName: string;
  createdAt: any;
}

const Index = () => {
  const { settings } = useSiteSettings();
  const { user, hasPermission } = useAuth();
  const { layout, colsToStyle, spacingClass, gapClass, radiusClass, maxWidthClass, imageRatioClass, cardPaddingClass } = useLayoutConfig();
  const heroRef = useMouseParallax<HTMLElement>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(false);
  const [popupAnnouncement, setPopupAnnouncement] = useState<Announcement | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [productStock, setProductStock] = useState<Record<string, number>>({});
  const [siteStats, setSiteStats] = useState({ users: 0, stock: 0, sales: 0 });
  const [statsRefreshing, setStatsRefreshing] = useState(false);

  const loadStats = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        invalidateCache("index-stats");
        invalidateCache("index-product-stock");
      }
      const safeCount = async (ref: any) => {
        try {
          const snap = await getCountFromServer(ref);
          return snap.data().count;
        } catch (e) {
          console.warn("Count query failed:", e);
          return 0;
        }
      };

      const [users, stock, sales] = await Promise.all([
        cachedQuery("index-stats-users", () => safeCount(collection(db, "users")), 3 * 60 * 1000),
        cachedQuery("index-stats-stock", () => safeCount(query(collection(db, "keys"), where("claimed", "==", false))), 3 * 60 * 1000),
        cachedQuery("index-stats-sales", () => safeCount(query(collection(db, "keys"), where("claimed", "==", true))), 3 * 60 * 1000),
      ]);

      setSiteStats({ users, stock, sales });

      const products = settings.products || [];
      if (products.length > 0) {
        const pStock = await cachedQuery("index-product-stock", async () => {
          // Edge function (service account) — Firestore rules block /keys list-reads for non-staff.
          const { fetchKeyCounts } = await import("@/lib/keyCounts");
          const all = await fetchKeyCounts();
          const counts: Record<string, number> = {};
          Object.entries(all).forEach(([k, v]) => {
            const pid = k.split("_")[0];
            if (pid) counts[pid] = (counts[pid] || 0) + v;
          });
          return counts;
        }, 3 * 60 * 1000);
        setProductStock(pStock);
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, [settings.products]);

  const handleRefreshStats = useCallback(async () => {
    setStatsRefreshing(true);
    await loadStats(true);
    setStatsRefreshing(false);
  }, [loadStats]);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await cachedQuery("index-announcements", async () => {
          const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), fbLimit(5));
          const snap = await getDocs(q);
          return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
        }, 5 * 60 * 1000);
        setAnnouncements(loaded);
        if (loaded.length > 0 && settings.ticker?.popupEnabled !== false) {
          const latest = loaded[0];
          const dismissedId = localStorage.getItem("dismissed-announcement");
          if (latest.id !== dismissedId) {
            setPopupAnnouncement(latest);
            setShowAnnouncementPopup(true);
          }
        }
      } catch (err) {
        console.error("Failed to load announcements:", err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    invalidateCache("index-stats-sales");
    loadStats();
  }, [loadStats]);

  const formatDate = (ts: any) => {
    if (!ts) return "";
    const date = ts.toDate?.() || new Date(ts);
    return date.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
  };

  // Lock body scroll when popup is open
  useEffect(() => {
    if (showAnnouncementPopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showAnnouncementPopup]);

  const dismissPopup = () => {
    setShowAnnouncementPopup(false);
    if (popupAnnouncement) localStorage.setItem("hx-dismissed-announcement", popupAnnouncement.id);
  };

  const socialLinks = settings.socialLinks?.filter(l => l.showOnHome !== false) || [];
  const enabledProducts = (settings.products || []).filter(p => p.enabled && p.name);

  const fade = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } }
  };
  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
  };
  // Below-the-fold sections animate on scroll into view
  const sectionInView = {
    variants: stagger,
    initial: "hidden" as const,
    whileInView: "show" as const,
    viewport: { once: true, margin: "-60px" },
  };
  const cardHover = {
    whileHover: { y: -4, transition: { type: "spring" as const, stiffness: 380, damping: 22 } },
    whileTap: { scale: 0.98 },
  };

  return (
    <div className="relative z-10">
      {/* Announcement Popup */}
      <AnimatePresence>
        {showAnnouncementPopup && popupAnnouncement && (
          <div className="fixed inset-0 z-[100]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/60 backdrop-blur-md"
              onClick={dismissPopup}
            />

            <div className="absolute inset-0 overflow-y-auto p-4" onClick={dismissPopup}>
              <div className="min-h-full flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 24 }}
                  transition={{ type: "spring", damping: 24, stiffness: 260 }}
                  className="glass-card relative w-[calc(100vw-2rem)] max-w-[min(28rem,90vw)] sm:max-w-md lg:max-w-lg !rounded-2xl max-h-[calc(100dvh-2rem)] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/40 bg-background/80 px-5 py-4 backdrop-blur-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Megaphone size={14} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground">ประกาศล่าสุด</h3>
                        <p className="text-[10px] text-muted-foreground truncate">{popupAnnouncement.createdByName} • {formatDate(popupAnnouncement.createdAt)}</p>
                      </div>
                    </div>
                    <button onClick={dismissPopup} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>

                  <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-4 sm:px-5 pb-5 pt-4">
                    <h4 className="text-sm font-bold text-foreground mb-2">{popupAnnouncement.title}</h4>
                    {popupAnnouncement.imageUrl && <img src={popupAnnouncement.imageUrl} alt={popupAnnouncement.title} className="w-full max-h-40 object-cover rounded-xl mb-3" />}
                    <p className="text-xs text-muted-foreground whitespace-pre-line mb-4 leading-relaxed">{popupAnnouncement.content}</p>
                    <Link to="/announcements" onClick={dismissPopup} className="btn-gradient px-4 py-2 text-xs inline-flex items-center gap-1.5">ดูทั้งหมด <ArrowRight size={12} /></Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticker is now a global component in App.tsx */}

      {/* V2 Awang-style: full-bleed hero + welcome + 4 stat cards */}
      {settings.uiVersion === "v2" && (
        <HomeV2Hero
          stats={siteStats}
          productsCount={(settings.products || []).filter(p => p.enabled).length}
        />
      )}

      {/* V1 Hero Banner with Logo + Typing Text + 3D Parallax */}
      {settings.uiVersion !== "v2" && (<>
      {/* Hero Banner with Logo + Typing Text + 3D Parallax */}
      {settings.heroBanner?.enabled !== false && (
        <motion.section
          ref={heroRef as any}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`parallax-scene relative ${maxWidthClass()} mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-4 sm:pb-6`}
        >
          {/* Aurora backdrop that also parallaxes */}
          <div
            className="parallax-layer absolute inset-0 aurora-bg -z-10 rounded-[3rem] blur-2xl opacity-70"
            style={{ ["--depth" as any]: 10 }}
            aria-hidden
          />
          <div className={`flex flex-col items-${settings.heroBanner?.textAlign || "center"} gap-4`}>
            {/* Logo */}
            {settings.heroBanner?.showLogo !== false && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", damping: 20 }}
                className="parallax-layer float-soft"
                style={{ ["--depth" as any]: 28 }}
              >
                <img
                  src={settings.logoUrl || logo}
                  alt={settings.brandName}
                  style={{ height: `${settings.heroBanner?.logoSize || settings.logoSize || 48}px` }}
                  className="object-contain drop-shadow-[0_10px_30px_hsl(var(--primary)/0.4)]"
                />
              </motion.div>
            )}

            {/* Typing Text */}
            {(settings.heroBanner?.textLines || []).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`parallax-layer text-${settings.heroBanner?.textAlign || "center"} w-full`}
                style={{ ["--depth" as any]: 16 }}
              >
                {(() => {
                  const isGradient = settings.heroBanner?.textColorMode === "gradient";
                  const hasCustomColor = !isGradient && !!settings.heroBanner?.textColor;
                  const gradientStyle = isGradient ? {
                    background: `linear-gradient(${settings.heroBanner?.textGradientDirection || "to right"}, ${settings.heroBanner?.textGradientFrom || "#6366f1"}, ${settings.heroBanner?.textGradientTo || "#ec4899"})`,
                    WebkitBackgroundClip: "text" as const,
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text" as const,
                  } : {};
                  const baseStyle = {
                    fontFamily: settings.heroBanner?.fontPreset || "Inter",
                    fontSize: `${settings.heroBanner?.fontSize || 24}px`,
                    ...(isGradient ? gradientStyle : hasCustomColor ? { color: settings.heroBanner.textColor } : {}),
                  };
                  const textClass = (isGradient || hasCustomColor) ? "" : "text-foreground";

                  return settings.heroBanner?.typingEnabled ? (
                    <div style={baseStyle} className={`font-bold ${textClass} min-h-[1.5em]`}>
                      <TypingText
                        lines={settings.heroBanner.textLines}
                        speed={settings.heroBanner.typingSpeed || 80}
                        delay={settings.heroBanner.typingDelay || 1500}
                        loop={settings.heroBanner.typingLoop !== false}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(settings.heroBanner?.textLines || []).map((line, i) => (
                        <p key={i} style={baseStyle} className={`font-bold ${textClass}`}>{line}</p>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </div>
        </motion.section>
      )}

      {/* Stats Bar */}
      {(settings.homeSectionVisibility?.stats !== false) && (
      <section className={`${maxWidthClass()} mx-auto px-4 sm:px-6 ${spacingClass()}`}>
        <RevealGroup step={90} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {[
            { icon: Users, label: "ผู้ใช้งาน", value: siteStats.users.toLocaleString(), unit: "คน" },
            { icon: ShoppingBag, label: "สินค้า", value: ((settings.products || []).filter(p => p.enabled !== false).length).toLocaleString(), unit: "รายการ" },
            { icon: BoxesIcon, label: "สต็อก", value: siteStats.stock.toLocaleString(), unit: "ชิ้น" },
            { icon: ShoppingCart, label: "ยอดขาย", value: siteStats.sales.toLocaleString(), unit: "ชิ้น" },
          ].map((stat) => (
            <Reveal key={stat.label} className={`glass-card glass-card-hover flex items-center gap-2.5 sm:gap-3 !p-3 sm:!p-4 ${radiusClass()}`}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-muted/50 border border-border/30 flex items-center justify-center shrink-0">
                <stat.icon size={16} className="text-muted-foreground sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground/60 leading-tight">{stat.label}</p>
                <p className="text-sm sm:text-base font-bold text-foreground leading-tight">{stat.value} <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{stat.unit}</span></p>
              </div>
            </Reveal>
          ))}
        </RevealGroup>
      </section>
      )}
      </>)}




      {(settings.homeSectionVisibility?.quicknav !== false) && (settings.quickNavItems || []).filter(n => n.enabled).length > 0 && (
        <motion.section {...sectionInView} className={`${maxWidthClass()} mx-auto px-4 sm:px-6 ${spacingClass()}`}>
          <motion.div variants={fade} className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
              <Navigation size={14} className="text-primary sm:w-4 sm:h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">{settings.homeSectionTitles?.quicknav || "ลิงก์ด่วน"}</h2>
              {(settings.homeSectionSubtitles?.quicknav || "ทางลัด") && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">{settings.homeSectionSubtitles?.quicknav || "ทางลัด"}</p>}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3" />
          </motion.div>

          <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.categoryCols)}>
            {(settings.quickNavItems || []).filter(n => n.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((nav) => {
              const isExternal = nav.url.startsWith("http");
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal 
                ? { href: nav.url, target: "_blank", rel: "noopener noreferrer" } 
                : { to: nav.url };
              return (
                <motion.div key={nav.id} variants={fade} {...cardHover}>
                  <Wrapper {...wrapperProps as any} className={`group relative block overflow-hidden ${radiusClass()}`}>
                    {/* shine sweep */}
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 rotate-12 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-[380%] transition-all duration-700 ease-out z-10" />
                    {nav.bannerUrl ? (
                      <img src={nav.bannerUrl} alt={nav.name} className="w-full h-auto object-contain group-hover:scale-[1.03] transition-transform duration-500" />
                    ) : (
                      <div className={`aspect-[4/3] bg-gradient-to-br ${nav.gradient || 'from-primary/20 to-accent/20'} flex items-center justify-center p-4 relative overflow-hidden border border-border/30`}>
                        {nav.imageUrl ? (
                          <img src={nav.imageUrl} alt={nav.name} className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-lg" />
                        ) : (
                          <span className="text-3xl sm:text-5xl">{nav.icon}</span>
                        )}
                      </div>
                    )}
                  </Wrapper>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}


      {(settings.homeSectionVisibility?.categories !== false) && (settings.categories || []).filter(c => c.enabled).length > 0 && (
        <motion.section {...sectionInView} className={`${maxWidthClass()} mx-auto px-4 sm:px-6 ${spacingClass()}`}>
          <motion.div variants={fade} className="text-center mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">{settings.homeSectionTitles?.categories || "หมวดหมู่สินค้า"}</h2>
            {settings.homeSectionSubtitles?.categories && <p className="text-xs sm:text-sm text-muted-foreground/60 mt-1">{settings.homeSectionSubtitles.categories}</p>}
          </motion.div>

          {(settings.categoryDisplayMode || "card") === "banner" ? (
            <div className={
              (settings.categoryBannerLayout || "vertical") === "horizontal"
                ? `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${settings.categoryBannerColumns || 2} ${gapClass()}`
                : `flex flex-col ${gapClass()}`
            }>
              {(settings.categories || []).filter(c => c.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((cat) => {
                return (
                  <motion.div key={cat.id} variants={fade} {...cardHover}>
                    <Link
                      to={`/store/${cat.id}`}
                      className={`group block relative overflow-hidden border border-border/30 hover:border-primary/20 transition-all duration-300 ${radiusClass()}`}
                    >
                      {cat.bannerUrl ? (
                        <img src={cat.bannerUrl} alt={cat.name} className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-500" />
                      ) : (
                        <div className={`w-full aspect-[16/9] bg-gradient-to-r ${cat.gradient || 'from-primary/20 to-accent/20'} flex items-center gap-3 sm:gap-4 px-3 sm:px-6`}>
                          {cat.imageUrl ? (
                            <motion.img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 sm:w-16 sm:h-16 object-contain drop-shadow-lg" whileHover={{ scale: 1.1 }} />
                          ) : (
                            <span className="text-2xl sm:text-4xl">{cat.icon}</span>
                          )}
                          <div>
                            <h3 className="text-[11px] sm:text-base font-bold text-foreground group-hover:text-primary transition-colors">{cat.name}</h3>
                            <p className="text-[9px] sm:text-xs text-muted-foreground/50">{productCounts[cat.id] || 0} สินค้า</p>
                          </div>
                        </div>
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.categoryCols)}>
              {(settings.categories || []).filter(c => c.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((cat) => (
                <motion.div key={cat.id} variants={fade}>
                  <Link
                    to={`/store/${cat.id}`}
                    className={`group glass-card-hover !p-0 overflow-hidden block ${radiusClass()}`}
                  >
                    {cat.bannerUrl ? (
                      <img src={cat.bannerUrl} alt={cat.name} className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-500" />
                    ) : cat.imageUrl ? (
                      <div className={`aspect-[16/9] sm:aspect-[4/3] bg-gradient-to-br ${cat.gradient || 'from-primary/20 to-accent/20'} flex items-center justify-center p-4 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
                        <motion.img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-20 h-20 sm:w-20 sm:h-20 object-contain drop-shadow-lg relative z-10"
                          whileHover={{ scale: 1.15, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        />
                      </div>
                    ) : (
                      <div className={`aspect-[16/9] sm:aspect-[4/3] bg-gradient-to-br ${cat.gradient || 'from-primary/20 to-accent/20'} flex items-center justify-center p-4 relative overflow-hidden`}>
                        <span className="text-4xl sm:text-5xl relative z-10">{cat.icon}</span>
                      </div>
                    )}
                    <div className={cardPaddingClass()}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs sm:text-sm">{cat.icon}</span>
                        <h3 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">{cat.name}</h3>
                      </div>
                      {cat.description ? (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground/50 line-clamp-1">{cat.description}</p>
                      ) : (
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground/50 line-clamp-1">{productCounts[cat.id] || 0} สินค้า</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      )}

      {/* Featured Products */}
      {(settings.homeSectionVisibility?.featured !== false) && enabledProducts.length > 0 && (
        <motion.section variants={stagger} initial="hidden" animate="show" className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pb-8 sm:pb-12`}>
          <motion.div variants={fade} className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
                <Star size={14} className="text-primary sm:w-4 sm:h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">{settings.homeSectionTitles?.featured || "สินค้าแนะนำ"}</h2>
                {settings.homeSectionSubtitles?.featured && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">{settings.homeSectionSubtitles.featured}</p>}
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3 hidden sm:block" />
            </div>
            <Link to="/store" className="text-[10px] sm:text-[11px] text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1 shrink-0">
              ดูทั้งหมด <ChevronRight size={12} />
            </Link>
          </motion.div>
          <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.featuredCols)}>
            {enabledProducts.slice(0, settings.featuredCount || 8).map((product) => (
              <motion.div key={product.id} variants={fade}>
                <Link to="/store" className={`group glass-card-hover !p-0 overflow-hidden block ${radiusClass()}`}>
                  {layout.showProductImage && product.imageUrl ? (
                    <div className={`${imageRatioClass()} overflow-hidden`}>
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : !layout.showProductImage ? null : (
                    <div className={`${imageRatioClass()} bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center`}>
                      <Package size={20} className="text-primary/30 sm:w-6 sm:h-6" />
                    </div>
                  )}
                  <div className={cardPaddingClass()}>
                    <h3 className="text-[11px] sm:text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">{product.name}</h3>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground/50 mt-0.5 line-clamp-1 min-h-[1.25em]">{product.description || "\u00A0"}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 flex-wrap">
                      <span className="text-[9px] sm:text-[10px] text-primary font-medium bg-primary/8 px-2 py-0.5 rounded-full">
                        {product.durations.length} ตัวเลือก
                      </span>
                      <span className={`text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-full ${(productStock[product.id] || 0) > 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                        สต็อก: {productStock[product.id] || 0}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Services Section */}
      {(settings.homeSectionVisibility?.services !== false) && (settings.serviceItems || []).filter(s => s.enabled).length > 0 && (
        <motion.section variants={stagger} initial="hidden" animate="show" className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pb-8 sm:pb-12`}>
          <motion.div variants={fade} className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
              <Wrench size={14} className="text-primary sm:w-4 sm:h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">{settings.homeSectionTitles?.services || "บริการอื่นๆ"}</h2>
              {settings.homeSectionSubtitles?.services && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">{settings.homeSectionSubtitles.services}</p>}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3" />
          </motion.div>
          <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.categoryCols)}>
            {(settings.serviceItems || []).filter(s => s.enabled).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((service) => {
              const isExternal = service.url?.startsWith("http");
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal
                ? { href: service.url, target: "_blank", rel: "noopener noreferrer" }
                : { to: service.url || "#" };
              return (
                <motion.div key={service.id} variants={fade}>
                  <Wrapper {...wrapperProps as any} className={`group glass-card-hover !p-0 overflow-hidden block ${radiusClass()}`}>
                    {service.bannerUrl ? (
                      <img src={service.bannerUrl} alt={service.name} className="w-full h-auto object-contain group-hover:scale-[1.02] transition-transform duration-500" />
                    ) : (
                      <div className={`aspect-[4/3] bg-gradient-to-br ${service.gradient || 'from-primary/20 to-accent/20'} flex items-center justify-center p-4 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
                        {service.imageUrl ? (
                          <motion.img src={service.imageUrl} alt={service.name} className="w-14 h-14 sm:w-20 sm:h-20 object-contain drop-shadow-lg relative z-10" whileHover={{ scale: 1.15, rotate: 5 }} transition={{ type: "spring", stiffness: 300 }} />
                        ) : (
                          <span className="text-3xl sm:text-5xl relative z-10">{service.icon || "🔧"}</span>
                        )}
                      </div>
                    )}
                    <div className={cardPaddingClass()}>
                      <h3 className="text-[11px] sm:text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">{service.name}</h3>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground/50 mt-0.5 line-clamp-1 min-h-[1.25em]">{service.description || "\u00A0"}</p>
                    </div>
                  </Wrapper>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Social Links */}
      {(settings.homeSectionVisibility?.social !== false) && socialLinks.length > 0 && (
        <motion.section variants={stagger} initial="hidden" animate="show" className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pb-8 sm:pb-12`}>
          <motion.div variants={fade} className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
              <ExternalLink size={14} className="text-primary sm:w-4 sm:h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">{settings.homeSectionTitles?.social || "ช่องทางติดต่อ"}</h2>
              {settings.homeSectionSubtitles?.social && <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">{settings.homeSectionSubtitles.social}</p>}
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3" />
          </motion.div>
          <motion.div variants={fade} className="flex flex-wrap gap-2 sm:gap-2.5">
            {socialLinks.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                className={`group glass-card-hover flex items-center gap-2 sm:gap-2.5 !p-2.5 sm:!p-3 ${radiusClass()}`}>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                  {link.iconUrl ? (
                    <img src={link.iconUrl} alt={link.label} className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded" />
                  ) : (
                    <ExternalLink size={13} className="text-primary sm:w-[15px] sm:h-[15px]" />
                  )}
                </div>
                <span className="font-semibold text-foreground text-[11px] sm:text-xs group-hover:text-primary transition-colors duration-300">{link.label}</span>
                <ChevronRight size={11} className="text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 sm:w-3 sm:h-3" />
              </a>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* Login CTA */}
      {!user && (
        <section className={`${maxWidthClass()} mx-auto px-4 sm:px-6 pb-10 sm:pb-14`}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="glass-card text-center py-8 sm:py-12 px-4 sm:px-6 !rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 pointer-events-none" />
              <div className="relative">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4 animate-float-bounce">
                  <LogIn size={18} className="text-primary sm:w-[22px] sm:h-[22px]" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-foreground mb-2">เข้าสู่ระบบ</h3>
                <p className="text-muted-foreground/60 text-[11px] sm:text-xs mb-4 sm:mb-5 max-w-sm mx-auto">เข้าสู่ระบบเพื่อใช้งาน</p>
                <Link to="/login" className="btn-gradient btn-magnetic inline-flex items-center gap-2 px-6 sm:px-8 py-2.5 sm:py-3 text-xs">เข้าสู่ระบบ <ArrowRight size={14} /></Link>
              </div>
            </div>
          </motion.div>
        </section>
      )}
    </div>
  );
};

export default Index;
