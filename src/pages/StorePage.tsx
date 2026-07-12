import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings, roleHasPermission, Product, ProductDuration } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { useWallet } from "@/hooks/useWallet";
import { useCart } from "@/contexts/CartContext";
import { Navigate, Link, useSearchParams, useNavigate, useParams } from "react-router-dom";
import { ShoppingBag, Clock, History, ShoppingCart, Plus, Package, PackageX, Search, Timer, ChevronDown as ChevronDownIcon, Cog, Ban, Layers, Coins, ExternalLink } from "lucide-react";
import { StarDisplay, useProductRatings } from "@/components/ProductReview";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import StoreSkeleton from "@/components/StoreSkeleton";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as fbLimit } from "firebase/firestore";
import { toast } from "sonner";
import { cachedQuery, invalidateCache } from "@/lib/firestoreCache";

const StorePage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const { layout, colsToStyle, gapClass, radiusClass, imageRatioClass, cardPaddingClass, maxWidthClass } = useLayoutConfig();
  const { balance: walletBalance } = useWallet();
  const { cart, totalCartItems, getCartCountForProduct, addToCart: cartAddToCart } = useCart();
  const [searchParams] = useSearchParams();
  const { categoryId: paramCategoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const [claimedCount, setClaimedCount] = useState<Record<string, number>>({});
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [lastClaimTimes, setLastClaimTimes] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(paramCategoryId || searchParams.get("category"));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedOptions, setExpandedOptions] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [now, setNow] = useState(Date.now());

  // Sync selected category with URL param so back/forward & deep links work
  useEffect(() => {
    setSelectedCategory(paramCategoryId || searchParams.get("category") || null);
  }, [paramCategoryId, searchParams]);

  // Real-time countdown ticker — only active when there are cooldowns
  const hasCooldowns = Object.keys(lastClaimTimes).length > 0 && (settings.claimCooldownHours > 0 || (settings.products || []).some(p => p.durations.some(d => d.cooldownHours && d.cooldownHours > 0)));
  useEffect(() => {
    if (!hasCooldowns) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasCooldowns]);

  const isFreeClaimRole = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;
  const canFreeClaim = isFreeClaimRole && (profile ? roleHasPermission(settings, profile.role, "store_free_claim") : false);
  const isReseller = profile ? roleHasPermission(settings, profile.role, "store_reseller_price") : false;
  const canAttachClaimExtras = isFreeClaimRole;

  const loadClaimedCounts = useCallback(async () => {
    if (!user) return;
    try {
      const snapshot = await cachedQuery(`store-claimed-${user.uid}`, async () => {
        const q = query(collection(db, "keys"), where("claimed", "==", true), where("claimedBy", "==", user.uid));
        return getDocs(q);
      }, 2 * 60 * 1000);
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        counts[`${data.productId}_${data.durationId}`] = (counts[`${data.productId}_${data.durationId}`] || 0) + 1;
      });
      setClaimedCount(counts);
    } catch (err) { console.error("Failed to load claimed counts:", err); }
  }, [user]);

  const loadAvailableCounts = useCallback(async () => {
    try {
      // Use edge function (service account) — Firestore rules block /keys list-reads for non-staff.
      const { fetchKeyCounts } = await import("@/lib/keyCounts");
      const counts = await fetchKeyCounts();
      setAvailableCounts(counts);
    } catch (err: any) { console.error("Failed to load available counts:", err?.code, err?.message, err); }
  }, []);

  const loadLastClaimTimes = useCallback(async () => {
    if (!user) return;
    try {
      const snapshot = await cachedQuery(`store-lastclaim-${user.uid}`, async () => {
        const q = query(collection(db, "claimHistory"), where("userId", "==", user.uid));
        return getDocs(q);
      }, 2 * 60 * 1000);
      const times: Record<string, number> = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const ck = `${data.productId}_${data.durationId}`;
        const ts = data.claimedAt?.seconds ? data.claimedAt.seconds * 1000 : 0;
        if (ts && (!times[ck] || ts > times[ck])) {
          times[ck] = ts;
        }
      });
      setLastClaimTimes(times);
    } catch (err) { console.error("Failed to load last claim times:", err); }
  }, [user]);

  useEffect(() => {
    if (!settings.keySystemEnabled) { setCountsLoading(false); return; }
    setCountsLoading(true);
    if (user) {
      Promise.all([loadClaimedCounts(), loadAvailableCounts(), loadLastClaimTimes()]).finally(() => setCountsLoading(false));
    } else {
      // Guest mode: only public available counts
      loadAvailableCounts().finally(() => setCountsLoading(false));
    }
  }, [user, settings.keySystemEnabled, loadClaimedCounts, loadAvailableCounts, loadLastClaimTimes]);

  const allCategoriesRaw = settings.categories || [];
  const allEnabledCategories = allCategoriesRaw.filter(c => c.enabled);
  const categoryDisplayMode = settings.categoryDisplayMode || "card";
  const enabledProducts = useMemo(
    () => (settings.products || []).filter((p) => p.enabled && p.name),
    [settings.products]
  );
  const productIdsForRatings = useMemo(() => enabledProducts.map(p => p.id), [enabledProducts]);
  const productRatings = useProductRatings(productIdsForRatings);

  if (!settings.keySystemEnabled) return <Navigate to="/" replace />;

  // Nested-category helpers
  const getChildren = (parentId: string | null) =>
    allEnabledCategories
      .filter(c => (c.parentId ?? null) === parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const getDescendantIds = (id: string): string[] => {
    const result: string[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      allEnabledCategories.forEach(c => {
        if (c.parentId === cur) { result.push(c.id); stack.push(c.id); }
      });
    }
    return result;
  };
  const getCategoryPath = (id: string | null): typeof allEnabledCategories => {
    const path: typeof allEnabledCategories = [];
    let current = id ? allEnabledCategories.find(c => c.id === id) : undefined;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current);
      current = current.parentId ? allEnabledCategories.find(c => c.id === current!.parentId) : undefined;
    }
    return path;
  };

  const selectedCat = selectedCategory ? allEnabledCategories.find(c => c.id === selectedCategory) : null;
  const categoryPath = getCategoryPath(selectedCategory);
  const visibleTopCategories = getChildren(selectedCategory);
  const isProductMode = !!selectedCat?.displayAsProduct;

  // When a category is selected and it has children (and is not in product mode), show only those children — no products yet.
  // Otherwise, show products belonging to the selected category OR any of its descendants (so parent categories aggregate).
  const showProducts = !selectedCategory || isProductMode || visibleTopCategories.length === 0 || !!searchQuery;
  const allowedCategoryIds = selectedCategory
    ? new Set<string>([selectedCategory, ...getDescendantIds(selectedCategory)])
    : null;
  const filteredProducts = enabledProducts.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (allowedCategoryIds && (!p.categoryId || !allowedCategoryIds.has(p.categoryId))) return false;
    return true;
  });

  const handleCategoryClick = (cat: typeof allEnabledCategories[number]) => {
    const hasChildren = getChildren(cat.id).length > 0;
    const mode = cat.subDisplayMode || "drilldown";
    // Accordion: only valid when this category has children & is not product-mode
    if (mode === "accordion" && hasChildren && !cat.displayAsProduct) {
      setExpandedCats(prev => {
        const next = new Set(prev);
        next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
        return next;
      });
      return;
    }
    // Drill-down (or leaf): toggle selected category and update URL
    if (selectedCategory === cat.id) {
      setSelectedCategory(null);
      navigate('/store', { replace: true });
    } else {
      setSelectedCategory(cat.id);
      navigate(`/store/${cat.id}`, { replace: true });
    }
  };

  const getDurationMaxPerUser = (dur: ProductDuration) => dur.maxPerUser && dur.maxPerUser > 0 ? dur.maxPerUser : settings.maxKeysPerUser;

  const isAdminOrOwner = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;

  const getCooldownMs = (dur: ProductDuration) => {
    if (isAdminOrOwner) return 0;
    if (settings.cooldownEnabled === false) return 0;
    if (dur.cooldownEnabled === false) return 0;
    const hours = (dur.cooldownHours && dur.cooldownHours > 0) ? dur.cooldownHours : (settings.claimCooldownHours || 0);
    return hours * 60 * 60 * 1000;
  };

  const getCooldownRemaining = (productId: string, dur: ProductDuration) => {
    const cdMs = getCooldownMs(dur);
    if (cdMs <= 0) return 0;
    const ck = `${productId}_${dur.id}`;
    const lastTime = lastClaimTimes[ck] || 0;
    if (!lastTime) return 0;
    const remaining = (lastTime + cdMs) - now;
    return remaining > 0 ? remaining : 0;
  };

  const formatCooldown = (ms: number) => {
    if (ms <= 0) return "";
    const totalSec = Math.ceil(ms / 1000);
    if (totalSec < 60) return `${totalSec} วินาที`;
    const totalMin = Math.ceil(totalSec / 60);
    if (totalMin < 60) return `${totalMin} นาที`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m > 0 ? `${h} ชม. ${m} น.` : `${h} ชม.`;
  };

  const addToCart = (product: Product, duration: ProductDuration) => {
    // 🔗 Link-mode duration: เปิดลิงก์ทันที ไม่หักเครดิต ไม่บันทึกประวัติ
    if (duration.linkMode && duration.redirectUrl?.trim()) {
      const url = duration.redirectUrl.trim();
      const newTab = duration.redirectOpenInNewTab !== false;
      if (newTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
      return;
    }
    if (!user || !profile) {
      toast.error("กรุณาเข้าสู่ระบบก่อนซื้อสินค้า");
      navigate("/login", { state: { from: { pathname: window.location.pathname } } });
      return;
    }
    const av = product.availability || "available";
    if (av !== "available") {
      toast.error(product.availabilityMessage || (av === "updating" ? "🔧 สินค้านี้กำลังอัพเดท" : "⛔ สินค้าไม่พร้อมขาย"));
      return;
    }
    const ck = `${product.id}_${duration.id}`;
    const used = claimedCount[ck] || 0;
    const avail = availableCounts[ck] || 0;
    const inCart = getCartCountForProduct(product.id, duration.id);
    const maxPU = getDurationMaxPerUser(duration);
    const cdRemaining = getCooldownRemaining(product.id, duration);
    if (cdRemaining > 0) { toast.error(`⏳ ต้องรออีก ${formatCooldown(cdRemaining)} ก่อนกดตัวเลือกนี้ได้อีก`); return; }
    if (maxPU > 0 && used + inCart >= maxPU) { toast.error(`กดคีย์ตัวเลือกนี้ครบจำนวนสูงสุดแล้ว (${maxPU} คีย์/คน)`); return; }
    if (avail <= inCart) { toast.error("คีย์สินค้านี้หมดแล้ว"); return; }
    const maxPC = duration.maxPerClaim && duration.maxPerClaim > 0 ? duration.maxPerClaim : settings.maxKeysPerClaim;
    if (maxPC > 0 && inCart >= maxPC) { toast.error(`เพิ่มได้สูงสุด ${maxPC} คีย์ต่อรอบ`); return; }
    const res = cartAddToCart(product, duration, maxPC, maxPU, availableCounts, claimedCount);
    if (res.ok) {
      toast.success(`เพิ่ม ${product.name} (${duration.label}) ลงตะกร้า`);
    } else if (res.reason === "maxPerClaim") {
      toast.error(`เพิ่มได้สูงสุด ${maxPC} คีย์ต่อรอบ`);
    } else if (res.reason === "maxPerUser") {
      toast.error(`กดคีย์ตัวเลือกนี้ครบจำนวนสูงสุดแล้ว (${maxPU} คีย์/คน)`);
    } else if (res.reason === "outOfStock") {
      toast.error("คีย์สินค้านี้หมดแล้ว");
    }
  };


  const getEffectivePrice = (dur: ProductDuration, product?: Product) => {
    if (canFreeClaim) return 0;
    const disc = settings.discount;
    let basePrice = dur.price || 0;
    if (isReseller && dur.resellerPrice !== undefined && dur.resellerPrice !== null) basePrice = dur.resellerPrice;
    if (disc?.enabled && product) {
      if (isReseller && disc.resellerGlobalPercent > 0) {
        const isApplied = disc.resellerApplyTo === "all" || disc.resellerSelectedProductIds?.includes(product.id);
        if (isApplied) return Math.round(basePrice * (1 - disc.resellerGlobalPercent / 100));
      } else if (!isReseller && disc.globalPercent > 0) {
        const isApplied = disc.applyTo === "all" || disc.selectedProductIds?.includes(product.id);
        if (isApplied) return Math.round(basePrice * (1 - disc.globalPercent / 100));
      }
    }
    return basePrice;
  };

  return (
    <div className={`relative z-10 ${maxWidthClass()} mx-auto px-4 sm:px-6 py-6`}>
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ร้านกดคีย์" }]}
        title="ร้านกดคีย์"
        subtitle=""
        icon={ShoppingBag}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Header with History link */}
        <div className="flex items-center justify-end mb-5">
          <Link to="/history/claims" className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
            <History size={14} /> <span className="text-[11px] font-medium">ประวัติ</span>
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาสินค้า..."
            className="input-glass w-full pl-9 pr-4 py-2.5 text-xs"
          />
        </div>

        {/* Category breadcrumb path (when navigated into a sub-category) */}
        {categoryPath.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mb-4 text-xs">
            <button
              onClick={() => { setSelectedCategory(null); navigate('/store', { replace: true }); }}
              className="text-muted-foreground hover:text-primary transition-colors"
            >ทั้งหมด</button>
            {categoryPath.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1.5">
                <span className="text-muted-foreground/40">/</span>
                {i === categoryPath.length - 1 ? (
                  <span className="text-foreground font-semibold flex items-center gap-1">{c.icon} {c.name}</span>
                ) : (
                  <button
                    onClick={() => { setSelectedCategory(c.id); navigate(`/store/${c.id}`, { replace: true }); }}
                    className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >{c.icon} {c.name}</button>
                )}
              </span>
            ))}
          </div>
        )}

        {/* Categories */}
        {visibleTopCategories.length > 0 && (() => {
          const renderCategoryCard = (cat: typeof visibleTopCategories[number], i: number) => {
            const isExpanded = expandedCats.has(cat.id);
            const childList = getChildren(cat.id);
            const hasChildren = childList.length > 0;
            const mode = cat.subDisplayMode || "drilldown";
            const isAccordion = mode === "accordion" && hasChildren && !cat.displayAsProduct;
            const productCount = enabledProducts.filter(p => p.categoryId === cat.id || getDescendantIds(cat.id).includes(p.categoryId || "")).length;

            const cardCommonProps = {
              key: cat.id,
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
              transition: { delay: i * 0.04 },
              onClick: () => handleCategoryClick(cat),
            } as const;

            const card = categoryDisplayMode === "banner" ? (
              <motion.button
                {...cardCommonProps}
                className={`relative overflow-hidden ${radiusClass()} border transition-all duration-300 ${selectedCategory === cat.id ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/30 hover:border-primary/20'}`}
              >
                {cat.bannerUrl ? (
                  <img src={cat.bannerUrl} alt={cat.name} className="w-full h-auto object-contain" />
                ) : (
                  <div className={`w-full aspect-[16/9] bg-gradient-to-r ${cat.gradient || 'from-primary/20 to-accent/20'} flex items-center gap-3 px-4`}>
                    {cat.imageUrl ? (
                      <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-md" />
                    ) : (
                      <span className="text-2xl sm:text-3xl">{cat.icon}</span>
                    )}
                    <div className="text-left flex-1">
                      <h3 className="text-[11px] sm:text-sm font-bold text-foreground flex items-center gap-1.5">
                        {cat.name}
                        {hasChildren && !cat.displayAsProduct && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{childList.length} หมวดย่อย</span>
                        )}
                      </h3>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground">{productCount} สินค้า</p>
                    </div>
                    {isAccordion && (
                      <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                )}
              </motion.button>
            ) : (
              <motion.button
                {...cardCommonProps}
                className={`category-card text-center !rounded-xl ${selectedCategory === cat.id ? '!border-primary/30 ring-1 ring-primary/15' : ''}`}
              >
                <div className={`aspect-square bg-gradient-to-br ${cat.gradient || 'from-primary/20 to-accent/20'} flex items-center justify-center p-2 relative`}>
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-md" />
                  ) : (
                    <span className="text-2xl sm:text-3xl">{cat.icon}</span>
                  )}
                  {hasChildren && !cat.displayAsProduct && (
                    <span className="absolute top-1 right-1 text-[8px] px-1.5 py-0.5 rounded-full bg-background/80 backdrop-blur-sm text-primary border border-primary/20">{childList.length}</span>
                  )}
                </div>
                <div className="p-2 flex items-center justify-center gap-1">
                  <span className="text-xs">{cat.icon}</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-foreground">{cat.name}</span>
                  {isAccordion && (
                    <ChevronDownIcon className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </div>
              </motion.button>
            );

            return (
              <div key={cat.id} className={isAccordion && isExpanded ? "col-span-full" : undefined}>
                {card}
                {isAccordion && isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pl-3 border-l-2 border-primary/20"
                  >
                    <div className="dynamic-grid gap-2" style={colsToStyle(layout.categoryCols)}>
                      {childList.map((child, ci) => renderCategoryCard(child, ci))}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          };

          return categoryDisplayMode === "banner" ? (
            <div className={
              (settings.categoryBannerLayout || "vertical") === "horizontal"
                ? `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${settings.categoryBannerColumns || 2} ${gapClass()} mb-6`
                : `flex flex-col ${gapClass()} mb-6`
            }>
              {visibleTopCategories.map((cat, i) => renderCategoryCard(cat, i))}
            </div>
          ) : (
            <div className="dynamic-grid gap-2 mb-6" style={colsToStyle(layout.categoryCols)}>
              {visibleTopCategories.map((cat, i) => renderCategoryCard(cat, i))}
            </div>
          );
        })()}

        {/* Products - hidden while drilling through parent categories that have sub-categories */}
        {showProducts && (countsLoading ? (
          <StoreSkeleton cols={3} />
        ) : filteredProducts.length === 0 ? (
          <div className="glass-card text-center py-16 !rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag size={22} className="text-muted-foreground/25" />
            </div>
            <p className="text-muted-foreground text-xs">ไม่พบสินค้า</p>
          </div>
        ) : (
          <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.productCols)}>
            {filteredProducts.map((product, i) => {
              // Find worst cooldown among durations for card-level indicator
              const activeDurations = product.durations.filter(dur => dur.enabled !== false);
              const hasCooldownActive = activeDurations.some(dur => getCooldownRemaining(product.id, dur) > 0);
              const collapseAfter = layout.productOptionsCollapseAfter ?? 4;
              const isExpanded = expandedOptions.has(product.id);
              const shouldCollapse = collapseAfter > 0 && activeDurations.length > collapseAfter;
              const visibleDurations = shouldCollapse && !isExpanded ? activeDurations.slice(0, collapseAfter) : activeDurations;
              const hiddenCount = activeDurations.length - visibleDurations.length;
              const prices = activeDurations.filter(d => !d.linkMode).map(d => getEffectivePrice(d, product)).filter(p => p >= 0);
              const minPrice = prices.length ? Math.min(...prices) : 0;
              const maxPrice = prices.length ? Math.max(...prices) : 0;
              const allFree = prices.length > 0 && maxPrice === 0;
              const priceLabel = !prices.length
                ? null
                : allFree
                  ? "ฟรี"
                  : minPrice === maxPrice
                    ? `${minPrice.toLocaleString()}`
                    : `${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
              const optionCount = activeDurations.length;
              const nonLinkDurations = activeDurations.filter(d => !d.linkMode);
              const hasLink = activeDurations.some(d => d.linkMode);
              const allLinkOnly = activeDurations.length > 0 && nonLinkDurations.length === 0;

              const av = product.availability || "available";
              const isHiddenStatus = av === "hidden";
              const isAvUnavailable = av !== "available" && !isHiddenStatus;
              // นับสต๊อกเฉพาะตัวเลือกที่ไม่ใช่โหมดลิงก์
              const totalAvail = nonLinkDurations.reduce((sum, d) => sum + (availableCounts[`${product.id}_${d.id}`] || 0), 0);
              // ถ้าทุกตัวเลือกเป็นลิงก์อย่างเดียว → ไม่ถือว่า OOS (ลิงก์ใช้ได้เสมอ)
              const isOutOfStock = !isAvUnavailable && !isHiddenStatus && !allLinkOnly && nonLinkDurations.length > 0 && totalAvail <= 0;
              const status: "updating" | "closed" | "oos" | null = isAvUnavailable
                ? (av === "updating" ? "updating" : "closed")
                : (isOutOfStock ? "oos" : null);
              const isUnavailable = status !== null;
              const statusMeta = status === "updating"
                ? { label: "กำลังอัพเดท", Icon: Cog, ring: "ring-amber-500/40", glow: "animate-unavail-glow", iconAnim: "animate-spin-slow", grad: "linear-gradient(135deg, hsl(38 92% 50% / 0.95), hsl(25 95% 53% / 0.95))", ribbon: "linear-gradient(90deg, hsl(38 92% 50% / 0.92), hsl(25 95% 53% / 0.92))", shine: "via-amber-200/30", msg: "กำลังอัพเดทระบบ กรุณารอสักครู่" }
                : status === "closed"
                ? { label: "ปิดการขาย", Icon: Ban, ring: "ring-red-500/40", glow: "animate-unavail-glow-red", iconAnim: "animate-unavail-bob", grad: "linear-gradient(135deg, hsl(0 84% 60% / 0.95), hsl(350 89% 45% / 0.95))", ribbon: "linear-gradient(90deg, hsl(0 84% 60% / 0.92), hsl(350 89% 45% / 0.92))", shine: "via-red-200/30", msg: "ไม่พร้อมขายในขณะนี้" }
                : status === "oos"
                ? { label: "สินค้าหมด", Icon: PackageX, ring: "ring-slate-400/40", glow: "animate-unavail-glow-slate", iconAnim: "animate-unavail-bob", grad: "linear-gradient(135deg, hsl(215 20% 45% / 0.95), hsl(220 15% 30% / 0.95))", ribbon: "linear-gradient(90deg, hsl(215 20% 45% / 0.92), hsl(220 15% 30% / 0.92))", shine: "via-slate-200/30", msg: "สินค้าหมดชั่วคราว" }
                : null;
              const cardVariant = layout.productCardVariant || "split";

              // Shared status tint for minimal overlay
              const tint = statusMeta ? (
                status === "updating" ? { wash: "from-amber-500/25 via-amber-500/5 to-transparent", chip: "bg-amber-500/15 border-amber-400/40 text-amber-300", dot: "bg-amber-400" } :
                status === "closed"  ? { wash: "from-red-500/25 via-red-500/5 to-transparent",    chip: "bg-red-500/15 border-red-400/40 text-red-300",    dot: "bg-red-400" } :
                                        { wash: "from-slate-500/25 via-slate-500/5 to-transparent", chip: "bg-slate-500/20 border-slate-300/30 text-slate-200", dot: "bg-slate-300" }
              ) : null;

              // ═══ POSTER variant: image top, info bottom ═══
              if (cardVariant === "poster") {
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 14, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
                    whileHover={{ y: -4, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 14 } }}
                    whileTap={{ scale: 0.97 }}
                    className={`glass-card-hover overflow-hidden !p-0 group ${radiusClass()} cursor-pointer relative ${isUnavailable && statusMeta ? `ring-1 ${statusMeta.ring}` : ''}`}
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.imageUrl && layout.showProductImage !== false && (
                      <div className={`overflow-hidden relative bg-muted/20 ${layout.productImageDisplay === "ratio" ? imageRatioClass() : "h-32 sm:h-36"}`}>
                        <img src={product.thumbnailUrl || product.imageUrl} alt={product.name} loading="lazy" className={`w-full h-full ${layout.productImageFit === "contain" ? "object-contain p-2" : "object-cover"} group-hover:scale-105 transition-transform duration-700 ${isUnavailable ? 'grayscale-[35%] opacity-80' : ''}`} />
                        {allLinkOnly ? (
                          <div className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded-full bg-sky-500/95 backdrop-blur-sm border border-sky-300/40 text-white flex items-center gap-1 shadow-sm pointer-events-none">
                            <ExternalLink size={9} />
                            <span className="text-[9px] font-bold leading-none tracking-wide">LINK</span>
                          </div>
                        ) : optionCount > 0 && (
                          <div className="absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-primary/30 text-primary flex items-center gap-1 shadow-sm pointer-events-none">
                            {hasLink && <ExternalLink size={9} className="text-sky-400" />}
                            <Layers size={9} />
                            <span className="text-[9px] font-semibold leading-none">{optionCount} ตัวเลือก</span>
                          </div>
                        )}
                        {isUnavailable && statusMeta && tint && (
                          <>
                            <div className={`absolute inset-0 bg-gradient-to-tr ${tint.wash} pointer-events-none`} />
                            <div className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay" style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 8px)" }} />
                            <div className={`absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md border ${tint.chip} shadow-sm`}>
                              <span className="relative flex w-1.5 h-1.5">
                                <span className={`absolute inline-flex h-full w-full rounded-full ${tint.dot} opacity-70 animate-ping`} />
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${tint.dot}`} />
                              </span>
                              <statusMeta.Icon size={11} strokeWidth={2.4} className={`shrink-0 ${statusMeta.iconAnim}`} />
                              <span className="text-[9px] font-semibold tracking-wide uppercase truncate">{statusMeta.label}</span>
                            </div>
                          </>
                        )}
                        {hasCooldownActive && !isUnavailable && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/30 flex items-center gap-1">
                            <Timer size={9} className="text-amber-400" />
                            <span className="text-[9px] font-medium text-amber-400">Cooldown</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className={cardPaddingClass()}>
                      <h3 className="text-xs font-bold text-foreground">{product.name}</h3>
                      {productRatings[product.id] && (
                        <StarDisplay rating={productRatings[product.id].avg} count={productRatings[product.id].count} size={10} />
                      )}
                      {product.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>}
                      {priceLabel && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/25">
                          <Coins size={10} className="text-primary" />
                          <span className="text-[11px] font-bold text-primary">
                            {priceLabel}
                            {!allFree && <span className="ml-1 text-[9px] font-medium text-primary/70">เครดิต</span>}
                          </span>
                        </div>
                      )}
                      <motion.button
                        onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-primary hover:text-primary-foreground rounded-lg border border-primary/30 hover:bg-primary/90 hover:border-primary transition-colors"
                      >
                        สั่งซื้อสินค้า
                        <ChevronDownIcon size={12} className="-rotate-90" />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              }

              // ═══ COMPACT variant: single-row list card ═══
              if (cardVariant === "compact") {
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, type: "spring", stiffness: 320, damping: 22 }}
                    whileHover={{ x: 3, transition: { type: "spring", stiffness: 400, damping: 14 } }}
                    whileTap={{ scale: 0.98 }}
                    className={`glass-card-hover overflow-hidden !p-2.5 group ${radiusClass()} cursor-pointer relative flex items-center gap-3 ${isUnavailable && statusMeta ? `ring-1 ${statusMeta.ring}` : ''}`}
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    {product.imageUrl && layout.showProductImage !== false ? (
                      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-primary/15 to-accent/10">
                        <img src={product.thumbnailUrl || product.imageUrl} alt={product.name} loading="lazy" className={`w-full h-full ${layout.productImageFit === "contain" ? "object-contain p-1" : "object-cover"} ${isUnavailable ? 'grayscale-[35%] opacity-80' : ''}`} />
                        {tint && <div className={`absolute inset-0 bg-gradient-to-tr ${tint.wash}`} />}
                      </div>
                    ) : (
                      <div className="shrink-0 w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
                        <ShoppingBag size={20} className="text-primary/70" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-foreground truncate">{product.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {priceLabel && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                            <Coins size={9} className="text-primary" />
                            <span className="text-[10px] font-bold text-primary">{priceLabel}</span>
                          </div>
                        )}
                        {optionCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground text-[9px] font-medium">
                            <Layers size={9} /> {optionCount}
                          </span>
                        )}
                        {isUnavailable && statusMeta && tint && (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${tint.chip} text-[9px] font-semibold uppercase`}>
                            <statusMeta.Icon size={9} className={statusMeta.iconAnim} />
                            {statusMeta.label}
                          </span>
                        )}
                        {hasCooldownActive && !isUnavailable && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-400 text-[9px] font-medium">
                            <Timer size={9} /> CD
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDownIcon size={14} className="text-muted-foreground -rotate-90 shrink-0" />
                  </motion.div>
                );
              }

              // ═══ SPLIT variant (default) ═══
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 14, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.05, type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
                  whileHover={{ y: -4, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 14 } }}
                  whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 500, damping: 18 } }}
                  className={`glass-card-hover overflow-hidden !p-0 group ${radiusClass()} cursor-pointer relative flex flex-row ${isUnavailable && statusMeta ? `ring-1 ${statusMeta.ring}` : ''}`}
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {/* LEFT: Image side (Split layout) */}
                  {product.imageUrl && layout.showProductImage !== false ? (
                    <div className="relative shrink-0 w-[38%] max-w-[160px] min-w-[110px] bg-gradient-to-br from-primary/10 via-muted/10 to-accent/10 overflow-hidden">
                      <div className="absolute inset-0">
                        <img
                          src={product.thumbnailUrl || product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                          className={`w-full h-full ${layout.productImageFit === "contain" ? "object-contain p-2" : "object-cover"} transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-1 ${isUnavailable ? 'grayscale-[35%] opacity-80' : ''}`}
                        />
                      </div>
                      {/* Right-edge fade into content */}
                      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card/60 to-transparent pointer-events-none" />
                      {allLinkOnly ? (
                        <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-full bg-sky-500/95 backdrop-blur-sm border border-sky-300/40 text-white flex items-center gap-1 shadow-sm pointer-events-none">
                          <ExternalLink size={9} />
                          <span className="text-[9px] font-bold leading-none tracking-wide">LINK</span>
                        </div>
                      ) : optionCount > 0 && (
                        <div className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-primary/30 text-primary flex items-center gap-1 shadow-sm pointer-events-none">
                          {hasLink && <ExternalLink size={9} className="text-sky-400" />}
                          <Layers size={9} />
                          <span className="text-[9px] font-semibold leading-none">{optionCount}</span>
                        </div>
                      )}
                      {isUnavailable && statusMeta && (() => {
                        const tint =
                          status === "updating" ? { wash: "from-amber-500/25 via-amber-500/5 to-transparent", chipBg: "bg-amber-500/15 border-amber-400/40 text-amber-300", dot: "bg-amber-400" } :
                          status === "closed"  ? { wash: "from-red-500/25 via-red-500/5 to-transparent",    chipBg: "bg-red-500/15 border-red-400/40 text-red-300",    dot: "bg-red-400" } :
                                                  { wash: "from-slate-500/25 via-slate-500/5 to-transparent", chipBg: "bg-slate-500/20 border-slate-300/30 text-slate-200", dot: "bg-slate-300" };
                        return (
                          <>
                            {/* Soft color wash — replaces heavy black overlay */}
                            <div className={`absolute inset-0 bg-gradient-to-tr ${tint.wash} pointer-events-none`} />
                            {/* Diagonal hairline pattern for texture */}
                            <div
                              className="absolute inset-0 opacity-[0.12] pointer-events-none mix-blend-overlay"
                              style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 8px)" }}
                            />
                            {/* Shine sweep (kept, subtler) */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                              <div className={`absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent ${statusMeta.shine} to-transparent animate-unavail-shine opacity-60`} />
                            </div>
                            {/* Floating minimal chip */}
                            <div className={`absolute bottom-2 left-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-md border ${tint.chipBg} shadow-sm`}>
                              <span className={`relative flex w-1.5 h-1.5`}>
                                <span className={`absolute inline-flex h-full w-full rounded-full ${tint.dot} opacity-70 animate-ping`} />
                                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${tint.dot}`} />
                              </span>
                              <statusMeta.Icon size={11} strokeWidth={2.4} className={`shrink-0 ${statusMeta.iconAnim}`} />
                              <span className="text-[9px] font-semibold tracking-wide uppercase truncate">{statusMeta.label}</span>
                            </div>
                          </>
                        );
                      })()}
                      {hasCooldownActive && !isUnavailable && (
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-amber-400/30 flex items-center gap-1">
                          <Timer size={9} className="text-amber-400" />
                          <span className="text-[9px] font-medium text-amber-400">CD</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    // No image → decorative gradient block so layout stays split
                    <div className="relative shrink-0 w-[30%] max-w-[130px] min-w-[90px] bg-gradient-to-br from-primary/25 via-primary/10 to-accent/25 flex items-center justify-center">
                      <ShoppingBag size={26} className="text-primary/70" />
                    </div>
                  )}

                  {/* RIGHT: Content side */}
                  <div className="flex-1 min-w-0 p-3.5 flex flex-col justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2">{product.name}</h3>
                      {productRatings[product.id] && (
                        <div className="mt-0.5">
                          <StarDisplay rating={productRatings[product.id].avg} count={productRatings[product.id].count} size={10} />
                        </div>
                      )}
                      {product.description && (
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                      )}
                      {priceLabel && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-primary/15 to-accent/15 border border-primary/25">
                          <Coins size={10} className="text-primary" />
                          <span className="text-[11px] font-bold text-primary">
                            {priceLabel}
                            {!allFree && <span className="ml-1 text-[9px] font-medium text-primary/70">เครดิต</span>}
                          </span>
                        </div>
                      )}
                      {isUnavailable && statusMeta && (
                        <div className={`mt-2 px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 ${status === "updating" ? "bg-amber-500/10 border border-amber-500/30 text-amber-500" : status === "closed" ? "bg-red-500/10 border border-red-500/30 text-red-400" : "bg-slate-500/10 border border-slate-400/30 text-slate-300"}`}>
                          <statusMeta.Icon size={11} className={statusMeta.iconAnim === "animate-spin-slow" ? "animate-spin-slow" : ""} />
                          <span className="truncate">{product.availabilityMessage || statusMeta.msg}</span>
                        </div>
                      )}
                    </div>
                    <motion.button
                      onClick={(e) => { e.stopPropagation(); navigate(`/product/${product.id}`); }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-primary hover:text-primary-foreground rounded-lg border border-primary/30 hover:bg-primary/90 hover:border-primary transition-colors"
                    >
                      สั่งซื้อสินค้า
                      <ChevronDownIcon size={12} className="-rotate-90" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default StorePage;
