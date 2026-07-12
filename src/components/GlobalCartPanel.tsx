import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings, roleHasPermission, Product, ProductDuration, Coupon } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import { useCart } from "@/contexts/CartContext";
import { useNavigate } from "react-router-dom";
import { Clock, Send, X, Image as ImageIcon, ShoppingCart, Trash2, Plus, MessageSquare, Package, Minus, AlertTriangle, CheckCircle, Tag, ToggleLeft, ToggleRight, Wallet, Zap, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, limit, getDoc, setDoc, increment, addDoc, runTransaction, orderBy } from "firebase/firestore";
import { toast } from "sonner";
import { checkRateLimit, formatRetryTime } from "@/lib/rateLimiter";
import { logActivity } from "@/lib/activityLogger";
import { invalidateCache } from "@/lib/firestoreCache";
import { useNotifications } from "@/components/NotificationPanel";
import { applyLedger, safeAddHistory, generateAttemptId } from "@/lib/walletLedger";
import { logError } from "@/lib/errorLogger";
import { freeClaimEmbed, keyStockActivityEmbed } from "@/lib/webhookTemplates";

const GlobalCartPanel = () => {
  const { user, profile } = useAuth();
  const { settings, updateSettings } = useSiteSettings();
  const { balance: walletBalance } = useWallet();
  const { cart, showCart, setShowCart, removeFromCart, updateCartQuantity: cartUpdateQuantity, updateCartNote, clearCart, totalCartItems } = useCart();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [claiming, setClaiming] = useState(false);
  const claimingLockRef = useRef(false);
  const [lastClaimTime, setLastClaimTime] = useState(0);
  const [claimedCount, setClaimedCount] = useState<Record<string, number>>({});
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [useCredits, setUseCredits] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const isFreeClaimRole = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;
  const hasFreePerm = isFreeClaimRole && (profile ? roleHasPermission(settings, profile.role, "store_free_claim") : false);
  const canFreeClaim = hasFreePerm && !useCredits;
  const isReseller = profile ? roleHasPermission(settings, profile.role, "store_reseller_price") : false;
  const canAttachClaimExtras = isFreeClaimRole;

  const loadCounts = useCallback(async () => {
    if (!user) return;
    try {
      // Available counts come from edge function (service account) — Firestore rules
      // restrict /keys list-reads to staff. The user's own claimed keys are still
      // readable directly because the rule allows reading keys where claimedBy == self.
      const { fetchKeyCounts } = await import("@/lib/keyCounts");
      const [avail, claimedSnap] = await Promise.all([
        fetchKeyCounts(),
        getDocs(query(collection(db, "keys"), where("claimed", "==", true), where("claimedBy", "==", user.uid))),
      ]);
      const claimed: Record<string, number> = {};
      claimedSnap.docs.forEach(d => { const data = d.data(); claimed[`${data.productId}_${data.durationId}`] = (claimed[`${data.productId}_${data.durationId}`] || 0) + 1; });
      setAvailableCounts(avail);
      setClaimedCount(claimed);
    } catch (err) { console.error(err); }
  }, [user]);

  // Load total spend for VIP tier
  const [totalSpend, setTotalSpend] = useState(0);
  useEffect(() => {
    if (!user || !settings.vipTiers?.enabled) return;
    const load = async () => {
      try {
        const q = query(collection(db, "walletTransactions"), where("userId", "==", user.uid), where("type", "==", "purchase"));
        const snap = await getDocs(q);
        setTotalSpend(snap.docs.reduce((s, d) => s + (d.data().amount || 0), 0));
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("GlobalCartPanel.loadVipSpend", err, "warn"); }
    };
    load();
  }, [user, settings.vipTiers?.enabled]);

  useEffect(() => {
    if (user && settings.keySystemEnabled && showCart) loadCounts();
  }, [user, settings.keySystemEnabled, showCart, loadCounts]);

  if (!user || !profile || !settings.keySystemEnabled) return null;

  const updateCartQuantity = (itemId: string, delta: number) => {
    const item = cart.find(c => c.id === itemId);
    if (!item) return;
    // ถ้าลดจนเหลือ 0 → ลบออกจากตะกร้า
    if (delta < 0 && item.quantity + delta <= 0) {
      removeFromCart(itemId);
      return;
    }
    const maxPC = item.duration?.maxPerClaim && item.duration.maxPerClaim > 0 ? item.duration.maxPerClaim : settings.maxKeysPerClaim;
    const maxPU = item.duration?.maxPerUser && item.duration.maxPerUser > 0 ? item.duration.maxPerUser : settings.maxKeysPerUser;
    cartUpdateQuantity(itemId, delta, maxPC, maxPU, availableCounts, claimedCount);
  };

  const getEffectivePrice = (dur: ProductDuration, product?: Product) => {
    if (canFreeClaim) return 0;
    const disc = settings.discount;
    let basePrice = dur.price || 0;
    if (isReseller && dur.resellerPrice !== undefined && dur.resellerPrice !== null) basePrice = dur.resellerPrice;
    if (disc?.enabled && product) {
      if (isReseller && disc.resellerGlobalPercent > 0) {
        const isApplied = disc.resellerApplyTo === "all" || disc.resellerSelectedProductIds?.includes(product.id);
        if (isApplied) basePrice = Math.round(basePrice * (1 - disc.resellerGlobalPercent / 100));
      } else if (!isReseller && disc.globalPercent > 0) {
        const isApplied = disc.applyTo === "all" || disc.selectedProductIds?.includes(product.id);
        if (isApplied) basePrice = Math.round(basePrice * (1 - disc.globalPercent / 100));
      }
    }
    // Apply VIP tier discount
    if (!isReseller && settings.vipTiers?.enabled && totalSpend > 0) {
      const currentTier = [...(settings.vipTiers.tiers || [])].sort((a, b) => b.minSpend - a.minSpend).find(t => totalSpend >= t.minSpend);
      if (currentTier && currentTier.discountPercent > 0) {
        basePrice = Math.round(basePrice * (1 - currentTier.discountPercent / 100));
      }
    }
    // Apply per-user discount rules (set by admin in Discount tab)
    if (user && product) {
      const rules = (settings.userDiscounts || []).filter(r =>
        r.enabled && r.userId === user.uid && (r.applyTo === "all" || r.productIds.includes(product.id))
      );
      for (const r of rules) {
        if (r.type === "percent") basePrice = Math.round(basePrice * (1 - Math.min(100, r.value) / 100));
        else basePrice = Math.max(0, basePrice - r.value);
      }
    }
    return basePrice;
  };

  const totalCartPriceBeforeBundle = cart.reduce((sum, c) => sum + getEffectivePrice(c.duration, c.product) * c.quantity, 0);

  // Bundle discount: apply when ALL required products of an enabled bundle are in cart
  const cartProductIds = new Set(cart.map(c => c.product.id));
  const activeBundles = (settings.bundleDiscounts || []).filter(b =>
    b.enabled && b.requiredProductIds.length >= 2 && b.requiredProductIds.every(pid => cartProductIds.has(pid))
  );
  const bundleDiscount = activeBundles.reduce((sum, b) => {
    if (b.type === "percent") return sum + Math.round(totalCartPriceBeforeBundle * b.value / 100);
    return sum + b.value;
  }, 0);
  const totalCartPriceBeforeCoupon = Math.max(0, totalCartPriceBeforeBundle - bundleDiscount);

  // Coupon discount calculation
  const couponDiscount = (() => {
    if (!appliedCoupon || totalCartPriceBeforeCoupon <= 0) return 0;
    let discount = 0;
    if (appliedCoupon.type === "percent") {
      discount = Math.round(totalCartPriceBeforeCoupon * appliedCoupon.value / 100);
    } else {
      discount = appliedCoupon.value;
    }
    if (appliedCoupon.maxDiscount > 0) discount = Math.min(discount, appliedCoupon.maxDiscount);
    return Math.min(discount, totalCartPriceBeforeCoupon);
  })();

  const totalCartPrice = totalCartPriceBeforeCoupon - couponDiscount;

  const applyCoupon = () => {
    if (!couponCode.trim()) return;
    const coupons = settings.coupons || [];
    const found = coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.enabled);
    if (!found) { toast.error("คูปองไม่ถูกต้องหรือหมดอายุ"); return; }
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) { toast.error("คูปองหมดอายุแล้ว"); return; }
    if (found.usedCount >= found.maxUses) { toast.error("คูปองถูกใช้ครบจำนวนแล้ว"); return; }
    if (user && (found.usedBy || []).filter(uid => uid === user.uid).length >= found.perUserLimit) { toast.error("คุณใช้คูปองนี้ครบจำนวนแล้ว"); return; }
    if (found.minPurchase > 0 && totalCartPriceBeforeCoupon < found.minPurchase) { toast.error(`ยอดซื้อขั้นต่ำ ฿${found.minPurchase.toLocaleString()}`); return; }
    if (found.applyTo === "selected") {
      const hasApplicable = cart.some(item => found.applicableProducts?.includes(item.product.id));
      if (!hasApplicable) { toast.error("คูปองนี้ไม่สามารถใช้กับสินค้าในตะกร้าได้"); return; }
    }
    setAppliedCoupon(found);
    toast.success(`ใช้คูปอง ${found.code} สำเร็จ! ลด ${found.type === "percent" ? `${found.value}%` : `฿${found.value}`}`);
  };

  const removeCoupon = () => { setAppliedCoupon(null); setCouponCode(""); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)"); return; }
      setAttachedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => { setAttachedImage(null); setImagePreview(null); };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > 5 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 5MB)"); return; }
          setAttachedImage(file);
          const reader = new FileReader();
          reader.onloadend = () => setImagePreview(reader.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const sendClaimToDiscord = async (allClaimedKeys: { product: Product; duration: ProductDuration; keys: string[] }[]) => {
    if (allClaimedKeys.length === 0) return;
    try {
      const { sendWebhook } = await import("@/lib/webhookSender");
      const totalCount = allClaimedKeys.reduce((s, g) => s + g.keys.length, 0);
      const actorDisplay = profile?.displayName || profile?.email || "Unknown";
      const proofName = attachedImage ? `claim-proof-${Date.now()}.${(attachedImage.name.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "png"}` : undefined;
      if (canFreeClaim) {
        await sendWebhook(settings, "freeClaim", [freeClaimEmbed({
          actorDisplay,
          actorEmail: user.email || "",
          actorRole: profile?.role || "user",
          totalCount,
          groups: allClaimedKeys.map((g) => ({ productName: g.product.name, durationLabel: g.duration.label, keys: g.keys, productImageUrl: g.product.imageUrl })),
          message: claimMessage,
          hasProofImage: !!imagePreview,
          proofAttachmentName: imagePreview ? proofName : undefined,
          brandName: settings.brandName,
        })], imagePreview && proofName ? { attachments: [{ name: proofName, contentType: attachedImage?.type || "image/png", dataUrl: imagePreview }] } : {});
      } else {
        await sendWebhook(settings, "keyClaim", allClaimedKeys.map((g) => keyStockActivityEmbed({
          action: "purchase",
          actorDisplay,
          actorRole: profile?.role || "user",
          productName: g.product.name,
          productImageUrl: g.product.imageUrl,
          durationLabel: g.duration.label,
          count: g.keys.length,
          keys: g.keys,
          note: claimMessage.trim() || undefined,
          brandName: settings.brandName,
        })));
      }
    } catch (err) { console.error("Discord webhook failed:", err); }
  };

  const claimCart = async () => {
    // Synchronous re-entrancy guard — blocks double-clicks before React state updates.
    if (claimingLockRef.current) return;
    claimingLockRef.current = true;
    try {
    if (cart.length === 0) { toast.error("ตะกร้าว่าง"); return; }
    // Free claim requires image + message
    if (canFreeClaim) {
      if (!attachedImage) { toast.error("กรุณาแนบรูปหลักฐานก่อนกดรับฟรี"); return; }
      if (!claimMessage.trim()) { toast.error("กรุณาพิมพ์ข้อความก่อนกดรับฟรี"); return; }
    }
    // Cooldown check at checkout (skip for admin/owner)
    const isAdminOrOwner = profile ? ["hightxcrew", "moderator", "admin", "owner"].includes(profile.role) : false;
    if (!isAdminOrOwner && settings.cooldownEnabled !== false) {
      try {
        const histSnap = await getDocs(query(collection(db, "claimHistory"), where("userId", "==", user!.uid)));
        const lastTimes: Record<string, number> = {};
        histSnap.docs.forEach(d => {
          const data = d.data();
          const ck = `${data.productId}_${data.durationId}`;
          const ts = data.claimedAt?.seconds ? data.claimedAt.seconds * 1000 : 0;
          if (ts && (!lastTimes[ck] || ts > lastTimes[ck])) {
            lastTimes[ck] = ts;
          }
        });
        const nowMs = Date.now();
        for (const item of cart) {
          const cdHours = (item.duration.cooldownEnabled !== false && item.duration.cooldownHours && item.duration.cooldownHours > 0) ? item.duration.cooldownHours : (settings.claimCooldownHours || 0);
          if (cdHours <= 0) continue;
          const ck = `${item.product.id}_${item.duration.id}`;
          const lastTime = lastTimes[ck] || 0;
          if (lastTime && (lastTime + cdHours * 3600000) > nowMs) {
            const remaining = (lastTime + cdHours * 3600000) - nowMs;
            const mins = Math.ceil(remaining / 60000);
            const timeStr = mins < 60 ? `${mins} นาที` : `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
            toast.error(`⏳ ${item.product.name} (${item.duration.label}) ต้องรออีก ${timeStr}`);
            return;
          }
        }
      } catch (err) { console.error("Cooldown check failed:", err); }
    }
    const rl = checkRateLimit("key_claim", user?.uid);
    if (!rl.allowed) { toast.error(`กดรับบ่อยเกินไป กรุณารออีก ${formatRetryTime(rl.retryAfterMs)}`); return; }
    const now = Date.now();
    if (now - lastClaimTime < 5000) { toast.error("กรุณารอสักครู่ก่อนกดอีกครั้ง"); return; }
    if (!canFreeClaim && totalCartPrice > 0 && walletBalance < totalCartPrice) {
      toast.error(`ยอดเงินไม่เพียงพอ (ต้องการ ฿${totalCartPrice.toLocaleString()} มีอยู่ ฿${walletBalance.toLocaleString()})`);
      return;
    }
    setClaiming(true);
    // Re-validate coupon at checkout time with fresh Firestore data
    if (appliedCoupon) {
      try {
        const settingsSnap = await getDoc(doc(db, "settings", "site"));
        const freshCoupons = settingsSnap.data()?.coupons || [];
        const freshCoupon = freshCoupons.find((c: any) => c.id === appliedCoupon.id && c.enabled);
        if (!freshCoupon) { toast.error("คูปองไม่ถูกต้องแล้ว"); setClaiming(false); return; }
        if (freshCoupon.usedCount >= freshCoupon.maxUses) { toast.error("คูปองถูกใช้ครบจำนวนแล้ว"); setAppliedCoupon(null); setClaiming(false); return; }
        if (user && (freshCoupon.usedBy || []).filter((uid: string) => uid === user.uid).length >= freshCoupon.perUserLimit) { toast.error("คุณใช้คูปองนี้ครบจำนวนแล้ว"); setAppliedCoupon(null); setClaiming(false); return; }
      } catch (err) {
        console.error("Coupon re-validation failed:", err);
      }
    }
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attemptId = generateAttemptId("cart");
    const allClaimedKeys: { product: Product; duration: ProductDuration; keys: string[] }[] = [];

    // Deduct balance BEFORE claiming keys so a crash/tab-close between the two
    // steps cannot yield free keys. Refunds on downstream failure are handled below.
    let balanceDeducted = false;
    if (!canFreeClaim && totalCartPrice > 0) {
      try {
        await applyLedger({
          type: "purchase",
          amount: -totalCartPrice,
          description: `ซื้อสินค้า: ${cart.map(i => `${i.product.name} (${i.duration.label}) x${i.quantity}`).join(", ")}`,
          userId: user.uid,
          userEmail: user.email || null,
          userName: profile?.displayName || profile?.email || null,
          refId: batchId,
          method: "wallet",
          meta: { attemptId, couponId: appliedCoupon?.id || null },
        });
        balanceDeducted = true;
      } catch (ledgerErr) {
        logError("cart.applyLedger.preDeduct", ledgerErr);
        toast.error("ไม่สามารถหักเงินได้ กรุณาลองใหม่");
        setClaiming(false);
        claimingLockRef.current = false;
        return;
      }
    }

    try {
      // Allocate keys via edge function (service account) — Firestore rules
      // forbid non-staff from listing/reading unclaimed keys, so client-side
      // querying fails with "permission-denied" for regular users.
      const { supabase } = await import("@/integrations/supabase/client");
      const { auth } = await import("@/lib/firebase");
      const idToken = (await auth.currentUser?.getIdToken()) || "";

      const requestItems = cart.map((item) => ({
        productId: item.product.id,
        durationId: item.duration.id,
        quantity: item.quantity,
        price: canFreeClaim ? 0 : getEffectivePrice(item.duration, item.product),
        productName: item.product.name,
        durationLabel: item.duration.label,
        claimNote: item.product.remark?.trim() || "",
      }));
      const purchaseType = canFreeClaim ? "free" : (isReseller ? "reseller" : "normal");

      const { data, error } = await supabase.functions.invoke("claim-keys", {
        body: {
          items: requestItems,
          batchId,
          claimMessage: claimMessage.trim() || "",
          purchaseType,
          displayName: profile?.displayName || profile?.email || "",
        },
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (error) throw new Error(error.message || "claim-keys invoke failed");
      if (!data?.success) throw new Error(data?.error || "ออกคีย์ไม่สำเร็จ");

      const groups: Array<{ productId: string; durationId: string; keys: string[]; claimedIds: string[] }> = data.groups || [];

      for (const g of groups) {
        if (!g.keys?.length) continue;
        const item = cart.find((c) => c.product.id === g.productId && c.duration.id === g.durationId);
        if (!item) continue;
        allClaimedKeys.push({ product: item.product, duration: item.duration, keys: g.keys });
      }
      for (const item of cart) {
        const g = groups.find((x) => x.productId === item.product.id && x.durationId === item.duration.id);
        const got = g?.keys?.length || 0;
        if (got < item.quantity) {
          toast.error(`คีย์ ${item.product.name} (${item.duration.label}) ${got === 0 ? "หมดแล้ว!" : `เหลือเพียง ${got}/${item.quantity}`}`);
        }
      }

      // Balance was deducted but every key claim failed (e.g. all stock gone).
      // Log for manual admin review — admin panel can issue the refund.
      if (balanceDeducted && allClaimedKeys.length === 0) {
        safeAddHistory("walletTransactions", {
          userId: user.uid,
          userEmail: user.email || "",
          userName: profile?.displayName || profile?.email || "",
          amount: totalCartPrice,
          description: `ต้องตรวจสอบ: หักเงินแล้วแต่ไม่ได้คีย์ (${batchId})`,
          type: "purchase",
          batchId,
          attemptId,
          status: "needs_review",
          needsManualReview: true,
        }).catch(() => {});
        toast.error("ไม่มีคีย์ว่าง กรุณาติดต่อแอดมิน (ยอดเงินอยู่ระหว่างตรวจสอบ)");
        setClaiming(false);
        claimingLockRef.current = false;
        return;
      }

      if (allClaimedKeys.length > 0) {
        const details = allClaimedKeys.map(g => `${g.product.name} (${g.duration.label}) x${g.keys.length}`).join(", ");
        const totalKeys = allClaimedKeys.reduce((s, g) => s + g.keys.length, 0);

        // Show success + navigate IMMEDIATELY — post-processing runs in background
        toast.success(`กดคีย์สำเร็จ ${totalKeys} คีย์!`);
        addNotification(
          totalCartPrice > 0 ? "purchase" : "success",
          totalCartPrice > 0 ? "ซื้อสินค้าสำเร็จ" : "กดคีย์สำเร็จ",
          `${details}${totalCartPrice > 0 ? ` | ราคา ฿${totalCartPrice.toLocaleString()}` : " (ฟรี)"}`
        );
        invalidateCache();
        clearCart(); setClaimMessage(""); removeImage(); setShowCart(false); setLastClaimTime(Date.now());
        const couponToConsume = appliedCoupon;
        setAppliedCoupon(null); setCouponCode("");
        navigate("/history/claims");

        // ===== Background post-processing (non-blocking) =====
        (async () => {
          try {
            const historyWrites: Promise<void>[] = [];
            for (const group of allClaimedKeys) {
              for (const key of group.keys) {
                const itemPrice = canFreeClaim ? 0 : getEffectivePrice(group.duration, group.product);
                const purchaseType = canFreeClaim ? "free" : (isReseller ? "reseller" : "normal");
                historyWrites.push(safeAddHistory("claimHistory", {
                  userId: user.uid,
                  userEmail: user.email || "",
                  userName: profile?.displayName || profile?.email || "",
                  productId: group.product.id,
                  productName: group.product.name,
                  durationId: group.duration.id,
                  durationLabel: group.duration.label,
                  key,
                  price: itemPrice,
                  purchaseType,
                  batchId,
                  attemptId,
                  status: "success",
                  claimMessage: claimMessage.trim() || "",
                  claimNote: group.product.remark?.trim() || "",
                }));
              }
            }
            await Promise.allSettled(historyWrites);

            sendClaimToDiscord(allClaimedKeys).catch(e => console.error("Discord webhook failed:", e));
            logActivity(user, profile, "key_claim", `เคลมคีย์ตะกร้า: ${details}${claimMessage ? ` | ข้อความ: ${claimMessage}` : ""}`).catch(() => {});

            if (totalCartPrice > 0) {
              // Balance was already deducted atomically before key claiming — audit record only.
              safeAddHistory("walletTransactions", { userId: user.uid, userEmail: user.email || "", userName: profile?.displayName || profile?.email || "", amount: totalCartPrice, description: `ซื้อสินค้า: ${details}`, type: "purchase", batchId, attemptId }).catch(() => {});

              const userDisplay = `${profile?.displayName || '-'} (${user.email || '-'})`;
              const firstProductImage = allClaimedKeys.find((g) => g.product.imageUrl)?.product.imageUrl;
              const purchaseEmbed = { title: "🛒 ซื้อสินค้า", color: 0xf59e0b, fields: [{ name: "👤 ผู้ใช้", value: userDisplay, inline: true }, { name: "🎭 ยศ", value: profile?.role || "user", inline: true }, { name: "💰 ราคารวม", value: `฿${totalCartPrice.toLocaleString()}`, inline: true }, { name: "📦 รายการ", value: details, inline: false }], ...(firstProductImage ? { thumbnail: { url: firstProductImage } } : {}), timestamp: new Date().toISOString(), footer: { text: settings.brandName } };
              try {
                const { sendWebhook } = await import("@/lib/webhookSender");
                sendWebhook(settings, "purchase", [purchaseEmbed]).catch(err => console.error("Purchase webhook failed:", err));
              } catch (err) { console.error("Purchase webhook failed:", err); }
            }

            if (couponToConsume && totalCartPrice > 0) {
              const settingsRef = doc(db, "settings", "site");
              try {
                await runTransaction(db, async (transaction) => {
                  const settingsSnap = await transaction.get(settingsRef);
                  if (!settingsSnap.exists()) return;
                  const currentCoupons = settingsSnap.data().coupons || [];
                  const updatedCoupons = currentCoupons.map((c: any) => {
                    if (c.id === couponToConsume.id) {
                      return { ...c, usedCount: (c.usedCount || 0) + 1, usedBy: [...(c.usedBy || []), user.uid] };
                    }
                    return c;
                  });
                  transaction.update(settingsRef, { coupons: updatedCoupons });
                });
              } catch (err) { console.error("Coupon update failed:", err); }
            }
          } catch (bgErr) {
            console.error("Background post-claim processing error:", bgErr);
          }
        })();
      }
    } catch (err: any) {
      console.error("Claim error:", err?.code, err?.message, err);
      const errMsg = err?.message || "เกิดข้อผิดพลาดในการกดคีย์";
      // Always log a failed attempt so admins can trace what happened
      await safeAddHistory("claimAttempts", {
        userId: user!.uid,
        userEmail: user!.email || "",
        userName: profile?.displayName || profile?.email || "",
        attemptId,
        batchId,
        status: "failed",
        error: errMsg,
        errorCode: err?.code || "",
        items: cart.map(i => ({ productId: i.product.id, productName: i.product.name, durationId: i.duration.id, durationLabel: i.duration.label, quantity: i.quantity })),
        totalCartPrice,
        partialClaimed: allClaimedKeys.reduce((s, g) => s + g.keys.length, 0),
      });
      if (err?.code === "permission-denied") toast.error("สิทธิ์ไม่เพียงพอ");
      else toast.error("เกิดข้อผิดพลาดในการกดคีย์");
    } finally { setClaiming(false); }
    } finally { claimingLockRef.current = false; }
  };

  return createPortal(
    <>
      {/* FAB */}
      <AnimatePresence>
        {totalCartItems > 0 && !showCart && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 right-6 z-[9999] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/25 transition-shadow flex items-center justify-center"
          >
            <ShoppingCart size={18} />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
              {totalCartItems}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Full-screen Cart */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[9999] flex flex-col"
            style={{
              background:
                "radial-gradient(1200px 800px at 80% -10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(900px 700px at -10% 110%, hsl(var(--accent) / 0.15), transparent 55%), hsl(var(--background) / 0.92)",
              backdropFilter: "blur(28px)",
              WebkitBackdropFilter: "blur(28px)",
            }}
            onPaste={handlePaste}
          >
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border/15"
            >
              <div className="flex items-center gap-3">
                <motion.div whileHover={{ rotate: 12, scale: 1.06 }} className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/25 to-accent/15 border border-primary/20 flex items-center justify-center hover:shadow-lg hover:shadow-primary/20 transition-shadow">
                  <ShoppingCart size={20} className="text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">ตะกร้าสินค้า</h2>
                  <p className="text-[11px] text-muted-foreground">{totalCartItems} ชิ้น · {cart.length} รายการ</p>
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.9 }} onClick={() => setShowCart(false)} className="w-10 h-10 rounded-2xl bg-muted/20 hover:bg-muted/40 backdrop-blur-md border border-border/15 flex items-center justify-center transition-colors">
                <X size={17} className="text-foreground" />
              </motion.button>
            </motion.div>

            {/* Body: 2-column on desktop, stacked on mobile */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left: items */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-5">
                <div className="max-w-2xl mx-auto">
                  {cart.length === 0 ? (
                    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center text-center py-16 sm:py-24">
                      <motion.div
                        animate={{ y: [0, -12, 0], rotate: [0, -4, 4, 0] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="relative w-32 h-32 rounded-[2rem] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent border border-primary/15 flex items-center justify-center mb-6 shadow-2xl shadow-primary/20"
                      >
                        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
                        <ShoppingCart size={56} strokeWidth={1.4} className="text-primary/70 relative z-10" />
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-[2rem] border-2 border-primary/30"
                        />
                      </motion.div>
                      <h3 className="text-lg font-bold text-foreground">ตะกร้าของคุณยังว่างอยู่</h3>
                      <p className="text-xs text-muted-foreground/70 mt-1.5">เลือกสินค้าจากหน้าร้านเพื่อเริ่มสั่งซื้อ</p>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { setShowCart(false); navigate("/"); }}
                        className="btn-gradient mt-6 px-6 py-2.5 text-xs font-semibold !rounded-xl flex items-center gap-2"
                      >
                        <Package size={14} /> เลือกสินค้า
                      </motion.button>
                    </motion.div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">รายการสินค้า</p>
                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => clearCart()} className="text-[11px] text-destructive/80 hover:text-destructive transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-destructive/10 flex items-center gap-1">
                          <Trash2 size={11} /> ล้างทั้งหมด
                        </motion.button>
                      </div>
                      <div className="space-y-2.5">
                        {cart.map((item, idx) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -40, height: 0 }}
                            transition={{ delay: idx * 0.05, type: "spring", damping: 22 }}
                            layout
                            className="p-3.5 rounded-2xl border border-border/15 bg-gradient-to-br from-muted/15 to-muted/5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group backdrop-blur-md"
                          >
                            <div className="flex items-center gap-3.5">
                              {item.product.imageUrl ? (
                                <motion.div whileHover={{ scale: 1.08, rotate: 2 }} className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border/20 shadow-md">
                                  <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                                </motion.div>
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center flex-shrink-0">
                                  <Package size={20} className="text-primary/50" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{item.product.name}</p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5"><Clock size={9} /> {item.duration.label}</p>
                                {!canFreeClaim && (
                                  <p className="text-[11px] font-bold text-primary mt-0.5">฿{(getEffectivePrice(item.duration, item.product) * item.quantity).toLocaleString()}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 bg-background/60 backdrop-blur-md rounded-xl p-1 border border-border/15">
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateCartQuantity(item.id, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors"><Minus size={12} className="text-muted-foreground" /></motion.button>
                                <motion.span key={item.quantity} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="text-xs font-bold text-foreground w-7 text-center">{item.quantity}</motion.span>
                                <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateCartQuantity(item.id, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/40 transition-colors"><Plus size={12} className="text-muted-foreground" /></motion.button>
                              </div>
                              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.85 }} onClick={() => removeFromCart(item.id)} className="p-2 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all">
                                <Trash2 size={14} />
                              </motion.button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right: summary panel */}
              {cart.length > 0 && (
                <motion.aside
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, type: "spring", damping: 22 }}
                  className="lg:w-[400px] lg:border-l border-t lg:border-t-0 border-border/15 overflow-y-auto p-4 sm:p-6 space-y-3"
                  style={{ background: "hsl(var(--background) / 0.4)", backdropFilter: "blur(20px)" }}
                >
                  {canAttachClaimExtras && (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground mb-1.5">📸 แนบรูปหลักฐาน {canFreeClaim ? <span className="text-destructive">(บังคับ)</span> : "(ไม่บังคับ)"}</label>
                        {imagePreview ? (
                          <div className="relative inline-block">
                            <img src={imagePreview} alt="Proof" className="w-24 h-24 object-cover rounded-xl border border-border/20 shadow-md" />
                            <motion.button whileTap={{ scale: 0.8 }} onClick={removeImage} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 shadow-lg"><X size={11} /></motion.button>
                          </div>
                        ) : (
                          <label className={`flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300 bg-muted/8 ${canFreeClaim ? "border-destructive/40 hover:border-destructive/60 hover:bg-destructive/5" : "border-border/25 hover:border-primary/40 hover:bg-primary/5"}`}>
                            <ImageIcon size={17} className="text-muted-foreground/40 mb-1" />
                            <span className="text-[10px] text-muted-foreground/60">คลิกเลือกรูป หรือ Ctrl+V</span>
                            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                          </label>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1"><MessageSquare size={10} /> ข้อความ {canFreeClaim ? <span className="text-destructive">(บังคับ)</span> : "(ไม่บังคับ)"}</label>
                        <textarea value={claimMessage} onChange={(e) => setClaimMessage(e.target.value)} placeholder={canFreeClaim ? "กรุณาพิมพ์ข้อความ..." : "พิมพ์ข้อความ..."} className={`input-glass w-full px-3 py-2 text-[11px] resize-none h-16 !rounded-xl ${canFreeClaim && !claimMessage.trim() ? "!border-destructive/30" : ""}`} maxLength={500} />
                      </div>
                    </>
                  )}

                  {!canFreeClaim && totalCartPriceBeforeCoupon > 0 && (
                    <div>
                      <label className="text-[11px] font-semibold text-foreground mb-1.5 flex items-center gap-1"><Tag size={10} /> คูปองส่วนลด</label>
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/8 border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Tag size={12} className="text-primary" />
                            <span className="text-[11px] font-semibold text-primary">{appliedCoupon.code}</span>
                            <span className="text-[10px] text-muted-foreground">(-฿{couponDiscount.toLocaleString()})</span>
                          </div>
                          <button onClick={removeCoupon} className="text-[10px] text-destructive hover:underline">ยกเลิก</button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="กรอกรหัสคูปอง" className="input-glass flex-1 px-3 py-2 text-[11px] !rounded-xl font-mono" onKeyDown={(e) => e.key === "Enter" && applyCoupon()} />
                          <button onClick={applyCoupon} className="btn-glass px-3 py-2 text-[10px] font-semibold !rounded-xl">ใช้</button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hero price summary */}
                  {!canFreeClaim && totalCartPriceBeforeBundle > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15 }}
                      className="relative overflow-hidden p-4 rounded-2xl border border-primary/25 shadow-xl shadow-primary/10"
                      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.08))" }}
                    >
                      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
                      <div className="relative space-y-1.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>ราคาสินค้า</span>
                          <span>฿{totalCartPriceBeforeBundle.toLocaleString()}</span>
                        </div>
                        {bundleDiscount > 0 && activeBundles.map(b => (
                          <div key={b.id} className="flex justify-between text-[11px] text-emerald-400">
                            <span>🎁 {b.name}</span>
                            <span>-{b.type === "percent" ? `${b.value}%` : `฿${b.value.toLocaleString()}`}</span>
                          </div>
                        ))}
                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-[11px] text-primary">
                            <span>คูปอง ({appliedCoupon?.code})</span>
                            <span>-฿{couponDiscount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="border-t border-border/20 pt-2 mt-2 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">ยอดรวมทั้งหมด</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{totalCartItems} ชิ้น · {cart.length} รายการ</p>
                          </div>
                          <motion.span
                            key={totalCartPrice}
                            initial={{ scale: 1.15, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-2xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-none"
                          >
                            ฿{totalCartPrice.toLocaleString()}
                          </motion.span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!canFreeClaim && totalCartPrice > 0 && walletBalance < totalCartPrice && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-[11px]">
                      <AlertTriangle size={14} />
                      <span>ยอดเงินไม่เพียงพอ (มี ฿{walletBalance.toLocaleString()} / ต้องการ ฿{totalCartPrice.toLocaleString()})</span>
                    </div>
                  )}
                  {canFreeClaim && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/25 text-[11px] text-primary">
                      <CheckCircle size={14} />
                      <span>ยศ {profile?.role} — กดคีย์ฟรีไม่ต้องใช้เครดิต</span>
                    </div>
                  )}
                  {hasFreePerm && (
                    <button
                      onClick={() => setUseCredits(!useCredits)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-[11px] font-medium transition-all duration-200 w-full ${useCredits ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400" : "bg-muted/10 border-border/15 text-muted-foreground hover:border-primary/25"}`}
                    >
                      {useCredits ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      {useCredits ? (
                        <><Wallet size={12} /> ใช้เครดิตแทน (หักจากกระเป๋าเงิน)</>
                      ) : (
                        <><Zap size={12} /> เปลี่ยนเป็นหักเครดิต</>
                      )}
                    </button>
                  )}

                  {/* Hero CTA */}
                  <motion.button
                    whileHover={{ scale: 1.015, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={claiming || cart.length === 0 || (!canFreeClaim && totalCartPrice > 0 && walletBalance < totalCartPrice)}
                    className="relative w-full py-4 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl text-primary-foreground overflow-hidden shadow-2xl shadow-primary/30 transition-all"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                    />
                    <Send size={15} className="relative z-10" />
                    <span className="relative z-10">
                      {claiming ? "กำลังดำเนินการ..." : canFreeClaim ? `ยืนยันกดคีย์ (${totalCartItems} รายการ)` : `ยืนยันซื้อ ${totalCartPrice > 0 ? `฿${totalCartPrice.toLocaleString()}` : `(${totalCartItems} รายการ)`}`}
                    </span>
                  </motion.button>
                </motion.aside>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Confirmation Dialog */}
      {showConfirmDialog && createPortal(
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-sm !rounded-2xl z-[10001]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShieldCheck size={18} className="text-primary" />
                {canFreeClaim ? "ยืนยันการกดคีย์" : "ยืนยันการซื้อ"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/10 border border-border/15 space-y-1.5">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.product.imageUrl && <img src={item.product.imageUrl} alt="" className="w-6 h-6 rounded object-cover" />}
                      <span className="truncate">{item.product.name} ({item.duration.label})</span>
                    </div>
                    <span className="text-muted-foreground shrink-0 ml-2">x{item.quantity}</span>
                  </div>
                ))}
              </div>
              {!canFreeClaim && totalCartPrice > 0 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <span className="text-xs font-medium text-foreground">ราคารวม</span>
                  <span className="text-sm font-bold text-primary">฿{totalCartPrice.toLocaleString()}</span>
                </div>
              )}
              {canFreeClaim && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/15 text-[11px] text-primary">
                  <CheckCircle size={13} /> กดคีย์ฟรี (ยศพิเศษ)
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                {canFreeClaim ? "คุณต้องการกดคีย์ตามรายการข้างต้นใช่หรือไม่?" : "ยอดเงินจะถูกหักจากกระเป๋าเงินของคุณ"}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <button onClick={() => setShowConfirmDialog(false)} className="btn-glass px-4 py-2.5 text-xs">
                ยกเลิก
              </button>
              <button onClick={() => { setShowConfirmDialog(false); claimCart(); }} disabled={claiming} className="btn-gradient px-4 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle size={13} /> {claiming ? "กำลังดำเนินการ..." : (canFreeClaim ? "ยืนยันกดคีย์" : "ยืนยันซื้อ")}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
        document.body
      )}
    </>,
    document.body
  );
};

export default GlobalCartPanel;
