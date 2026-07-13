import { useState, useEffect, useCallback } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings, roleHasPermission, ProductDuration } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { useWallet } from "@/hooks/useWallet";
import { useCart } from "@/contexts/CartContext";
import { Clock, ArrowLeft, ShoppingCart, ShoppingBag, Package, PackageX, CheckCircle, ChevronDown, ChevronUp, Timer, MessageSquare, Cog, Ban, Share2, LogIn, PlayCircle, ExternalLink } from "lucide-react";
import { ReviewForm, ReviewList, StarDisplay } from "@/components/ProductReview";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { Progress } from "@/components/ui/progress";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as fbLimit } from "firebase/firestore";
import { toast } from "sonner";

const ProductDetailPage = () => {
  const { productId } = useParams<{ productId: string }>();
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const { radiusClass, maxWidthClass } = useLayoutConfig();
  const { balance: walletBalance } = useWallet();
  const { addToCart: cartAddToCart, getCartCountForProduct } = useCart();
  const navigate = useNavigate();
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [claimedCount, setClaimedCount] = useState<Record<string, number>>({});
  const [lastClaimTimes, setLastClaimTimes] = useState<Record<string, number>>({});
  const [descExpanded, setDescExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isAdminOrOwner = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;
  const isFreeClaimRole = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;
  const canFreeClaim = isFreeClaimRole && (profile ? roleHasPermission(settings, profile.role, "store_free_claim") : false);
  const isReseller = profile ? roleHasPermission(settings, profile.role, "store_reseller_price") : false;

  const product = (settings.products || []).find(p => p.id === productId && p.enabled);
  const category = product?.categoryId ? (settings.categories || []).find(c => c.id === product.categoryId) : null;

  // Cooldown helpers
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

  const getCooldownProgress = (productId: string, dur: ProductDuration) => {
    const cdMs = getCooldownMs(dur);
    if (cdMs <= 0) return 100;
    const remaining = getCooldownRemaining(productId, dur);
    if (remaining <= 0) return 100;
    return Math.round(((cdMs - remaining) / cdMs) * 100);
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

  // Real-time countdown ticker
  const hasCooldowns = Object.keys(lastClaimTimes).length > 0 && (settings.claimCooldownHours > 0 || (product?.durations || []).some(d => d.cooldownHours && d.cooldownHours > 0));
  useEffect(() => {
    if (!hasCooldowns) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasCooldowns]);

  const loadCounts = useCallback(async () => {
    if (!product) return;
    try {
      // Available counts via edge function (service account) — Firestore rules block /keys list-reads for non-staff.
      const { fetchKeyCounts } = await import("@/lib/keyCounts");
      const all = await fetchKeyCounts();
      const avail: Record<string, number> = {};
      Object.entries(all).forEach(([k, v]) => { if (k.startsWith(`${product.id}_`)) avail[k] = v; });
      setAvailableCounts(avail);
      if (user) {
        const claimedSnap = await getDocs(query(collection(db, "keys"), where("productId", "==", product.id), where("claimed", "==", true), where("claimedBy", "==", user.uid)));
        const claimed: Record<string, number> = {};
        claimedSnap.docs.forEach(d => {
          const data = d.data();
          const ck = `${data.productId}_${data.durationId}`;
          claimed[ck] = (claimed[ck] || 0) + 1;
        });
        setClaimedCount(claimed);
      } else {
        setClaimedCount({});
      }
    } catch (err) {
      console.error("Failed to load counts:", err);
    }
  }, [user, product]);

  const loadLastClaimTimes = useCallback(async () => {
    if (!user || !product) return;
    try {
      const snap = await getDocs(query(
        collection(db, "claimHistory"),
        where("userId", "==", user.uid),
        where("productId", "==", product.id)
      ));
      const times: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const ck = `${data.productId}_${data.durationId}`;
        const ts = data.claimedAt?.seconds ? data.claimedAt.seconds * 1000 : 0;
        if (ts && (!times[ck] || ts > times[ck])) {
          times[ck] = ts;
        }
      });
      setLastClaimTimes(times);
    } catch (err) {
      console.error("Failed to load last claim times:", err);
    }
  }, [user, product]);

  useEffect(() => {
    if (!settings.keySystemEnabled || !product) return;
    loadCounts();
    if (user) loadLastClaimTimes();
  }, [user, settings.keySystemEnabled, product, loadCounts, loadLastClaimTimes]);

  // Dynamic OG meta tags for product sharing
  useEffect(() => {
    if (!product) return;
    const brandName = settings.brandName || "HightXClient";
    const title = `${product.name} — ${brandName}`;
    const description = product.description || `สินค้า ${product.name} จาก ${brandName}`;
    const image = product.imageUrl || "";
    const url = window.location.href;

    document.title = title;

    const setMeta = (property: string, content: string, isName = false) => {
      const attr = isName ? "name" : "property";
      let el = document.querySelector(`meta[${attr}="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:image", image);
    setMeta("og:url", url);
    setMeta("og:type", "product");
    setMeta("twitter:title", title, true);
    setMeta("twitter:description", description, true);
    if (image) setMeta("twitter:image", image, true);
    setMeta("description", description, true);

    return () => {
      // Restore defaults on unmount
      const brand = settings.brandName || "HightXClient";
      const defaultDesc = settings.ogDescription || "แหล่งรวมคีย์โปรแกรมเสริมเกมระดับพรีเมียม";
      document.title = `${brand} — Beyond ur limits`;
      setMeta("og:title", `${brand} — Beyond ur limits`);
      setMeta("og:description", defaultDesc);
      setMeta("og:image", settings.ogImage || "");
      setMeta("og:type", "website");
      setMeta("description", defaultDesc, true);
    };
  }, [product, settings]);

  if (!product) return <Navigate to="/store" replace />;

  const getEffectivePrice = (dur: ProductDuration) => {
    if (canFreeClaim) return 0;
    const disc = settings.discount;
    let basePrice = dur.price || 0;
    if (isReseller && dur.resellerPrice !== undefined && dur.resellerPrice !== null) {
      basePrice = dur.resellerPrice;
    }
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

  const productAvailability = product?.availability || "available";
  const isProductHiddenStatus = productAvailability === "hidden";
  const isProductAvUnavailable = productAvailability !== "available" && !isProductHiddenStatus;
  const productActiveDurations = (product?.durations || []).filter(d => d.enabled !== false);
  const productNonLinkDurations = productActiveDurations.filter(d => !d.linkMode);
  const productAllLinkOnly = productActiveDurations.length > 0 && productNonLinkDurations.length === 0;
  const productTotalAvail = productNonLinkDurations.reduce((s, d) => s + (availableCounts[`${product?.id}_${d.id}`] || 0), 0);
  const isProductOutOfStock = !isProductAvUnavailable && !isProductHiddenStatus && !productAllLinkOnly && productNonLinkDurations.length > 0 && productTotalAvail <= 0;
  const productStatus: "updating" | "closed" | "oos" | null = isProductAvUnavailable
    ? (productAvailability === "updating" ? "updating" : "closed")
    : (isProductOutOfStock ? "oos" : null);
  const isProductUnavailable = productStatus !== null;

  const handleAddToCart = (dur: ProductDuration) => {
    // 🔗 Link-mode duration: เปิดลิงก์ทันที ไม่หักเครดิต ไม่บันทึกประวัติ
    if (dur.linkMode && dur.redirectUrl?.trim()) {
      const url = dur.redirectUrl.trim();
      const newTab = dur.redirectOpenInNewTab !== false;
      if (newTab) window.open(url, "_blank", "noopener,noreferrer");
      else window.location.href = url;
      return;
    }
    if (!user || !profile) {
      toast.error("กรุณาเข้าสู่ระบบก่อนซื้อสินค้า");
      navigate("/login", { state: { from: { pathname: window.location.pathname } } });
      return;
    }
    if (isProductAvUnavailable) {
      toast.error(product.availabilityMessage || (productAvailability === "updating" ? "🔧 สินค้านี้กำลังอัพเดท" : "⛔ สินค้าไม่พร้อมขาย"));
      return;
    }
    const ck = `${product.id}_${dur.id}`;
    const used = claimedCount[ck] || 0;
    const avail = availableCounts[ck] || 0;
    const inCart = getCartCountForProduct(product.id, dur.id);
    const maxPU = dur.maxPerUser && dur.maxPerUser > 0 ? dur.maxPerUser : settings.maxKeysPerUser;
    const maxPC = dur.maxPerClaim && dur.maxPerClaim > 0 ? dur.maxPerClaim : settings.maxKeysPerClaim;
    const cdRemaining = getCooldownRemaining(product.id, dur);
    if (cdRemaining > 0) { toast.error(`⏳ ต้องรออีก ${formatCooldown(cdRemaining)} ก่อนกดตัวเลือกนี้ได้อีก`); return; }
    if (maxPU > 0 && used + inCart >= maxPU) { toast.error(`กดคีย์ตัวเลือกนี้ครบจำนวนสูงสุดแล้ว (${maxPU} คีย์/คน)`); return; }
    if (avail <= inCart) { toast.error("คีย์สินค้านี้หมดแล้ว"); return; }
    if (maxPC > 0 && inCart >= maxPC) { toast.error(`เพิ่มได้สูงสุด ${maxPC} คีย์ต่อรอบ`); return; }
    const res = cartAddToCart(product, dur, maxPC, maxPU, availableCounts, claimedCount);
    if (res.ok) {
      toast.success(`เพิ่ม ${product.name} (${dur.label}) ลงตะกร้า`);
    } else if (res.reason === "maxPerClaim") {
      toast.error(`เพิ่มได้สูงสุด ${maxPC} คีย์ต่อรอบ`);
    } else if (res.reason === "maxPerUser") {
      toast.error(`กดคีย์ตัวเลือกนี้ครบจำนวนสูงสุดแล้ว (${maxPU} คีย์/คน)`);
    } else if (res.reason === "outOfStock") {
      toast.error("คีย์สินค้านี้หมดแล้ว");
    }
  };

  return (
    <div className={`relative z-10 ${maxWidthClass()} mx-auto px-4 sm:px-6 py-6`}>
      <PageBreadcrumb
        items={[
          { label: "ร้านกดคีย์", path: "/store" },
          ...(category ? [{ label: category.name, path: `/store/${category.id}` }] : []),
          { label: product.name },
        ]}
        title={product.name}
        subtitle=""
        icon={Package}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
          <button onClick={() => navigate(-1)} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
            <ArrowLeft size={14} /> <span className="text-[11px] font-medium">กลับ</span>
          </button>
          <button
            onClick={async () => {
              const origin = window.location.origin;
              // ใช้ลิงก์ตรง /product/<id> ที่ถูก prerender OG ไว้ตอน build
              // (Supabase edge function ไม่สามารถส่ง text/html ให้ crawler อ่านได้)
              const shareUrl = `${origin}/product/${product.id}`;
              const shareData = { title: product.name, text: product.description || product.name, url: shareUrl };
              try {
                if (navigator.share && /Mobi|Android|iPhone/i.test(navigator.userAgent)) {
                  await navigator.share(shareData);
                } else {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success("คัดลอกลิงก์แชร์พร้อม OG แล้ว");
                }
              } catch (e) {
                // user cancelled — ignore
              }
            }}
            className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5"
            title="คัดลอกลิงก์แชร์ (มี OG preview)"
          >
            <Share2 size={14} /> <span className="text-[11px] font-medium">แชร์ลิงก์</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Product Image - sticky on desktop */}
          <div className={`lg:col-span-2 lg:sticky lg:top-24 flex flex-col gap-4`}>
            {/* Product Image */}
            <div className={`glass-card overflow-hidden !p-0 ${radiusClass()} relative ${isProductUnavailable ? (productStatus === "updating" ? 'ring-2 ring-amber-500/40' : productStatus === "closed" ? 'ring-2 ring-red-500/40' : 'ring-2 ring-slate-400/40') : ''}`}>
              {product.imageUrl ? (
                <>
                  {/* Blurred background fill */}
                  <div className="absolute inset-0 overflow-hidden">
                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-30" />
                  </div>
                  {/* Actual image centered */}
                  <div className="relative flex items-center justify-center p-4 min-h-[280px] lg:min-h-[360px]">
                    <img src={product.imageUrl} alt={product.name} className={`max-w-full max-h-[500px] object-contain drop-shadow-2xl ${radiusClass()} ${isProductUnavailable ? 'grayscale-[60%] blur-[1px]' : ''}`} />
                  </div>
                </>
              ) : (
                <div className="w-full aspect-[4/5] bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <Package size={64} className="text-muted-foreground/20" />
                </div>
              )}
              {isProductUnavailable && (() => {
                const meta = productStatus === "updating"
                  ? { label: "กำลังอัพเดท", Icon: Cog, iconAnim: "animate-spin-slow", tone: "amber", dot: "hsl(38 92% 55%)", msg: "กำลังอัพเดทระบบ กรุณารอสักครู่" }
                  : productStatus === "closed"
                  ? { label: "ปิดการขาย", Icon: Ban, iconAnim: "", tone: "red", dot: "hsl(0 84% 60%)", msg: "ไม่พร้อมขายในขณะนี้" }
                  : { label: "สินค้าหมด", Icon: PackageX, iconAnim: "", tone: "slate", dot: "hsl(215 20% 60%)", msg: "สินค้าหมดชั่วคราว" };
                return (
                  <>
                    {/* Soft dim — keeps the artwork visible */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/70 pointer-events-none" />
                    {/* Corner status dot */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 pointer-events-none">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ background: meta.dot }} />
                        <span className="relative rounded-full h-1.5 w-1.5" style={{ background: meta.dot }} />
                      </span>
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-white/90">{meta.label}</span>
                    </div>
                    {/* Centered clean card */}
                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl max-w-[85%]">
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
                          style={{ background: `${meta.dot} / 0.18`, backgroundColor: `color-mix(in srgb, ${meta.dot} 18%, transparent)`, color: meta.dot }}
                        >
                          <meta.Icon size={22} strokeWidth={2.25} className={meta.iconAnim} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-white leading-tight">{meta.label}</p>
                          <p className="text-[11px] text-white/70 leading-tight mt-0.5 line-clamp-2">
                            {product.availabilityMessage || meta.msg}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

            </div>

            {/* Video / Tutorial button */}
            {product.videoUrl && (
              <a
                href={product.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`glass-card ${radiusClass()} flex items-center gap-3 group hover:border-primary/40 hover:bg-primary/5 transition-colors`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                  <PlayCircle size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{product.videoLabel?.trim() || "ดูคลิปตัวอย่าง"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{product.videoUrl}</p>
                </div>
                <span className="text-[11px] font-semibold text-primary shrink-0">เปิด →</span>
              </a>
            )}

            {/* Bundle Promotion Banner */}
            {(() => {
              const relatedBundles = (settings.bundleDiscounts || []).filter(
                b => b.enabled && (b.requiredProductIds || []).includes(product.id) && (b.requiredProductIds || []).length >= 2
              );
              if (relatedBundles.length === 0) return null;
              return (
                <div className="space-y-2">
                  {relatedBundles.map(b => {
                    const others = (b.requiredProductIds || [])
                      .filter(pid => pid !== product.id)
                      .map(pid => (settings.products || []).find(p => p.id === pid))
                      .filter(Boolean) as typeof settings.products;
                    const discountLabel = b.type === "percent" ? `ลด ${b.value}%` : `ลด ฿${b.value.toLocaleString()}`;
                    return (
                      <div key={b.id} className={`glass-card ${radiusClass()} border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent space-y-2`}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                            <Package size={16} className="text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-amber-300 truncate">โปรโมชั่นซื้อแพ็คคู่</p>
                            <p className="text-[10px] text-muted-foreground truncate">{b.name}</p>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 shrink-0">{discountLabel}</span>
                        </div>
                        {others.length > 0 && (
                          <div className="text-[11px] text-foreground/80">
                            ซื้อพร้อมกับ:
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {others.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => navigate(`/product/${p.id}`)}
                                  className="px-2 py-1 rounded-md bg-card/60 border border-border/30 hover:border-amber-400/50 hover:bg-amber-500/10 transition-colors text-[10px] font-medium text-foreground"
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">เพิ่มสินค้าทั้งหมดในชุดนี้ลงตะกร้าเพื่อรับส่วนลดอัตโนมัติ</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Quick Info Card - fills empty space */}
            <div className={`glass-card ${radiusClass()} space-y-3`}>
              <div className="flex items-center gap-2">
                {category && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                    {category.icon && <span>{category.icon}</span>}
                    {category.name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent-foreground text-[10px] font-medium">
                  {product.durations.length} ตัวเลือก
                </span>
              </div>
              {!canFreeClaim && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card/50 border border-border/20">
                  <span className="text-[11px] text-muted-foreground">ยอดเงินคงเหลือ</span>
                  <span className="text-sm font-bold text-primary">฿{walletBalance.toLocaleString()}</span>
                </div>
              )}
              {canFreeClaim && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-[11px] text-green-400 font-medium">สิทธิ์กดคีย์ฟรี</span>
                </div>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div>
              {category && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium mb-2">
                  {category.icon && <span>{category.icon}</span>}
                  {category.name}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{product.name}</h1>
            </div>

            {product.description && (() => {
              const descLength = product.description.length;
              const isLong = descLength > 200;
              return (
                <div className={`glass-card ${radiusClass()}`}>
                  <h3 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <ShoppingBag size={12} /> รายละเอียดสินค้า
                  </h3>
                  <div className="relative">
                    <p className={`text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap ${!descExpanded && isLong ? 'line-clamp-4' : ''}`}>
                      {product.description}
                    </p>
                    {isLong && !descExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
                    )}
                  </div>
                  {isLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="flex items-center gap-1 mt-2 text-[10px] text-primary font-medium hover:underline"
                    >
                      {descExpanded ? <><ChevronUp size={10} /> ย่อ</> : <><ChevronDown size={10} /> อ่านเพิ่มเติม</>}
                    </button>
                  )}
                </div>
              );
            })()}

            {isProductUnavailable && (() => {
              const s = productStatus === "updating"
                ? { Icon: Cog, iconClass: "animate-spin-slow", title: "สินค้านี้กำลังอัพเดท", ring: "border-amber-500/35", bg: "bg-amber-500/[0.06]", chip: "bg-amber-500/15 text-amber-400", label: "UPDATING" }
                : productStatus === "closed"
                ? { Icon: Ban, iconClass: "", title: "สินค้าไม่พร้อมขายในขณะนี้", ring: "border-red-500/35", bg: "bg-red-500/[0.06]", chip: "bg-red-500/15 text-red-400", label: "CLOSED" }
                : { Icon: PackageX, iconClass: "", title: "สินค้าหมดชั่วคราว", ring: "border-slate-400/30", bg: "bg-slate-500/[0.06]", chip: "bg-slate-500/15 text-slate-300", label: "OUT OF STOCK" };
              return (
                <div className={`glass-card ${radiusClass()} border ${s.ring} ${s.bg}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.chip}`}>
                      <s.Icon size={18} className={s.iconClass} strokeWidth={2.25} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-bold text-foreground leading-tight">{s.title}</p>
                        <span className={`text-[9px] font-bold tracking-[0.12em] px-1.5 py-0.5 rounded ${s.chip}`}>{s.label}</span>
                      </div>
                      {product.availabilityMessage && (
                        <p className="text-[11.5px] text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">{product.availabilityMessage}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}


            {!user && (
              <button
                onClick={() => navigate("/login", { state: { from: { pathname: window.location.pathname } } })}
                className={`glass-card ${radiusClass()} w-full text-left border border-primary/40 bg-primary/10 hover:bg-primary/15 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <LogIn size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-primary">กรุณาเข้าสู่ระบบ</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">เข้าสู่ระบบเพื่อสั่งซื้อหรือกดรับคีย์สินค้านี้</p>
                  </div>
                  <span className="text-[11px] font-semibold text-primary shrink-0">เข้าสู่ระบบ →</span>
                </div>
              </button>
            )}

            <div className={`glass-card ${radiusClass()}`}>
              <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Clock size={12} /> ตัวเลือกระยะเวลา
              </h3>
              <div className="flex flex-col gap-2">
                {product.durations.filter(dur => dur.enabled !== false).map((dur) => {
                  const ck = `${product.id}_${dur.id}`;
                  const avail = availableCounts[ck] || 0;
                  const used = claimedCount[ck] || 0;
                  const inCart = getCartCountForProduct(product.id, dur.id);
                  const maxPU = dur.maxPerUser && dur.maxPerUser > 0 ? dur.maxPerUser : settings.maxKeysPerUser;
                  const cdRemaining = getCooldownRemaining(product.id, dur);
                  const cdProgress = getCooldownProgress(product.id, dur);
                  const isCoolingDown = cdRemaining > 0;
                  const isLink = !!(dur.linkMode && dur.redirectUrl?.trim());
                  const canAdd = !isProductUnavailable && !isCoolingDown && avail > inCart && (maxPU <= 0 || used + inCart < maxPU);
                  const effectivePrice = getEffectivePrice(dur);

                    const cdMs = getCooldownMs(dur);
                    const cdPercent = cdMs > 0 && isCoolingDown ? Math.round((cdRemaining / cdMs) * 100) : 0;
                    const cdBarColor = cdPercent > 66 ? 'bg-red-500' : cdPercent > 33 ? 'bg-amber-500' : 'bg-green-500';
                    return (
                      <div
                        key={dur.id}
                        className={`flex flex-col rounded-xl border transition-all ${
                          isLink ? 'border-blue-500/30 bg-blue-500/5 hover:border-blue-400/50'
                          : isCoolingDown ? 'border-amber-500/20 bg-amber-500/5'
                          : canAdd ? 'border-border/30 hover:border-primary/20 bg-card/50' : 'border-border/10 bg-muted/10 opacity-50'
                        }`}
                      >
                        <div className="flex items-center justify-between p-3">
                          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground">{dur.label}</span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isLink ? (
                                <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                                  <ExternalLink size={10} /> LINK
                                </span>
                              ) : (
                                <>
                                  {canFreeClaim ? (
                                    <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                      <CheckCircle size={10} /> ฟรี
                                    </span>
                                  ) : effectivePrice > 0 ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm font-bold text-primary">฿{effectivePrice.toLocaleString()}</span>
                                      {effectivePrice < (dur.price || 0) && (
                                        <span className="text-[10px] line-through text-muted-foreground/40">฿{dur.price}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs font-bold text-green-400">ฟรี</span>
                                  )}
                                  <span className={`text-[10px] ${avail === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    คงเหลือ {avail} คีย์
                                  </span>
                                </>
                              )}
                              {inCart > 0 && !isLink && (
                                <span className="text-[10px] text-primary font-medium">
                                  (ในตะกร้า {inCart})
                                </span>
                              )}
                            </div>
                          </div>
                          {dur.linkMode && dur.redirectUrl?.trim() ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = dur.redirectUrl!.trim();
                                if (dur.redirectOpenInNewTab !== false) window.open(url, "_blank", "noopener,noreferrer");
                                else window.location.href = url;
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:opacity-90 active:scale-95 shadow-sm shrink-0"
                            >
                              <ExternalLink size={12} /> {dur.redirectLabel?.trim() || "ไปที่ลิงก์"}
                            </button>
                          ) : !user ? (
                            <button
                              onClick={() => navigate("/login", { state: { from: { pathname: window.location.pathname } } })}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm shrink-0"
                            >
                              <LogIn size={12} /> เข้าสู่ระบบ
                            </button>
                          ) : (
                          <button
                            onClick={() => canAdd && handleAddToCart(dur)}
                            disabled={!canAdd}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all shrink-0 ${
                              isProductUnavailable
                                ? 'bg-amber-500/15 text-amber-500 cursor-not-allowed'
                                : isCoolingDown
                                ? 'bg-amber-500/15 text-amber-500 cursor-not-allowed'
                                : canAdd
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm'
                                : 'bg-muted/20 text-muted-foreground cursor-not-allowed'
                            }`}
                          >
                            {isProductUnavailable ? <Package size={12} /> : isCoolingDown ? <Timer size={12} /> : <ShoppingCart size={12} />}
                            {isProductUnavailable ? (productAvailability === "updating" ? "อัพเดท" : "ไม่พร้อม") : isCoolingDown ? 'รอ' : avail === 0 ? 'หมด' : !canAdd ? 'ครบแล้ว' : 'เพิ่ม'}
                          </button>
                          )}
                        </div>
                        {isCoolingDown && (
                          <div className="px-3 pb-3 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Timer size={10} className="text-amber-400" /> Cooldown
                              </span>
                              <span className="text-[10px] font-semibold text-amber-400">
                                {formatCooldown(cdRemaining)}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-muted/20 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${cdBarColor}`} style={{ width: `${100 - cdPercent}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                })}
              </div>
            </div>

            {/* Reviews Section */}
            <div className="mt-6 space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MessageSquare size={14} className="text-primary" />
                รีวิวจากผู้ซื้อ
              </h3>
              <ReviewForm productId={product.id} />
              <ReviewList productId={product.id} />
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ProductDetailPage;
