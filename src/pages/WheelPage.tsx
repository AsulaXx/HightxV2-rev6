import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, Sparkles, Zap, ArrowLeft, Coins, Trophy, Loader2, X, Wallet, ShoppingBag, Gift, RotateCw, PartyPopper } from "lucide-react";
import { useSiteSettings, type WheelConfig, type WheelPrize } from "@/contexts/SiteSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { safeAddHistory, generateAttemptId, recordLedgerOnly } from "@/lib/walletLedger";
import { useWallet } from "@/hooks/useWallet";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { sendWebhook } from "@/lib/webhookSender";
import { wheelSpinEmbed, keyStockActivityEmbed } from "@/lib/webhookTemplates";

const SIZE = 380;
const RADIUS = SIZE / 2;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

const WheelPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSiteSettings();
  const { user, profile } = useAuth();
  const { balance } = useWallet();

  const wheel: WheelConfig | undefined = useMemo(
    () => (settings.wheels || []).find(w => w.slug === slug && w.enabled),
    [settings.wheels, slug]
  );

  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [lastSpinAt, setLastSpinAt] = useState<number>(0);
  const [userSpins, setUserSpins] = useState<number>(0);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<WheelPrize | null>(null);
  const [wonKey, setWonKey] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<"idle" | "claiming" | "ok" | "out_of_stock" | "error">("idle");
  const [showResultModal, setShowResultModal] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lastSpinIdRef = useRef(0);
  const spinLockRef = useRef(false);

  // load wheel state
  useEffect(() => {
    if (!wheel) return;
    let cancelled = false;
    (async () => {
      const init: Record<string, number> = {};
      wheel.prizes.forEach(p => { init[p.id] = p.stock; });
      try {
        const ref = doc(db, "wheels", wheel.id);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data() as any;
          setStocks({ ...init, ...(d.prizeStocks || {}) });
        } else {
          setStocks(init);
        }
      } catch (e) {
        console.warn("[wheel] failed to load wheel doc", e);
        if (!cancelled) setStocks(init);
      }
      if (user) {
        try {
          const userRef = doc(db, "wheels", wheel.id, "users", user.uid);
          const us = await getDoc(userRef);
          if (!cancelled && us.exists()) {
            const d = us.data() as any;
            setLastSpinAt(d.lastSpinAt?.toMillis?.() || 0);
            setUserSpins(d.spinCount || 0);
          }
        } catch (e) {
          console.warn("[wheel] failed to load user wheel state", e);
        }
      }
      if (!cancelled) setStateLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [wheel?.id, user?.uid]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!wheel) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass-card text-center max-w-md">
          <CircleDot size={36} className="text-muted-foreground/40 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-foreground">ไม่พบวงล้อนี้</h1>
          <p className="text-sm text-muted-foreground mt-1">วงล้อ "{slug}" ไม่มีอยู่หรือถูกปิดไว้</p>
          <Link to="/hub" className="btn-gradient inline-flex items-center gap-2 px-4 py-2 text-sm mt-4"><ArrowLeft size={14} /> กลับไปหน้าบริการ</Link>
        </div>
      </div>
    );
  }

  const prizes = wheel.prizes;
  const slice = 360 / Math.max(1, prizes.length);
  const cooldownLeft = wheel.cooldownSeconds > 0 && lastSpinAt
    ? Math.max(0, Math.ceil((lastSpinAt + wheel.cooldownSeconds * 1000 - now) / 1000))
    : 0;
  const reachedMax = wheel.maxSpinsPerUser > 0 && userSpins >= wheel.maxSpinsPerUser;
  const insufficient = wheel.cost > 0 && balance < wheel.cost;

  const spin = async () => {
    // Synchronous re-entrancy guard — blocks rapid double-clicks.
    if (spinLockRef.current) return;
    if (!user) { toast.error("กรุณาเข้าสู่ระบบก่อนหมุน"); return; }
    if (spinning) return;
    if (!stateLoaded) { toast.error("กำลังโหลดข้อมูลวงล้อ กรุณาลองใหม่อีกครั้ง"); return; }
    if (cooldownLeft > 0) { toast.error(`กรุณารออีก ${cooldownLeft} วินาที`); return; }
    if (reachedMax) { toast.error("คุณหมุนครบจำนวนสูงสุดแล้ว"); return; }
    if (insufficient) { toast.error("เครดิตไม่พอสำหรับการหมุน"); return; }

    spinLockRef.current = true;
    const spinAttemptId = generateAttemptId("spin");
    setSpinning(true);
    setResult(null);
    setWonKey(null);
    setKeyStatus("idle");

    try {
      // 1. Get fresh Firebase ID token
      const idToken = await user.getIdToken();

      // 2. Call server-side spin edge function — server picks prize + claims key atomically
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const r = await fetch(`${supabaseUrl}/functions/v1/spin-wheel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({ wheelId: wheel.id, idToken }),
      });
      const data = await r.json().catch(() => ({}));
      if (!data?.ok) {
        const errMap: Record<string, string> = {
          cooldown: `ยังหมุนซ้ำไม่ได้ (รอ ${data.remain || "?"} วินาที)`,
          max_spins: "ครบจำนวนหมุนสูงสุดแล้ว",
          insufficient: "เครดิตไม่พอ",
          all_out_of_stock: "รางวัลทุกชิ้นหมดสต็อก",
          rate_limited: "หมุนถี่เกินไป กรุณารอสักครู่",
          spin_in_progress: "กำลังประมวลผลการหมุนก่อนหน้า",
          wheel_not_found: "ไม่พบวงล้อนี้หรือถูกปิด",
          server_not_configured: "ระบบยังไม่พร้อม",
        };
        throw new Error(errMap[data?.error] || data?.detail || "การหมุนล้มเหลว");
      }

      // 3. Resolve prize from server response → find idx for animation
      const prizeFromServer = data.prize;
      const idx = prizes.findIndex((p) => p.id === prizeFromServer.id);
      if (idx < 0) throw new Error("เซิร์ฟเวอร์คืนรางวัลที่ไม่รู้จัก");
      const prize = prizes[idx];
      const isProductReward = prize.rewardType === "product" && !!prize.productId;
      const productInfo = isProductReward
        ? (settings.products || []).find((x: any) => x.id === prize.productId)
        : null;
      const targetDurationId: string = prizeFromServer.durationId || "";

      // 4. Animate wheel rotation
      const spinId = ++lastSpinIdRef.current;
      const targetAngle = idx * slice + slice / 2;
      const fullTurns = 6;
      const finalRotation = rotation + fullTurns * 360 + (360 - (rotation % 360)) - targetAngle;
      setRotation(finalRotation);

      // 5. Update local state from server-confirmed values
      setLastSpinAt(Date.now());
      setUserSpins(data.newSpinCount || (userSpins + 1));
      setStocks((s) => ({ ...s, [prize.id]: s[prize.id] === -1 ? -1 : (s[prize.id] ?? prize.stock) - 1 }));

      const claimedKeyValue: string | null = data.claimedKey || null;
      if (isProductReward) {
        setKeyStatus("claiming");
        if (claimedKeyValue) {
          setWonKey(claimedKeyValue);
          setKeyStatus("ok");
        } else {
          setKeyStatus("out_of_stock");
        }
      }

      // 6. Best-effort client-side history mirroring (so existing dashboards work without
      //    waiting on a separate cron). The authoritative records are wheels/{id}/spins +
      //    wheelClaims written by the edge function in the same atomic commit.
      if (claimedKeyValue) {
        const durLabel = (productInfo?.durations || []).find((d: any) => d.id === targetDurationId)?.label
          || (prize.productDays ? `${prize.productDays} วัน` : "");
        safeAddHistory("claimHistory", {
          userId: user.uid, userEmail: user.email || "", userName: profile?.displayName || profile?.email || "",
          productId: prize.productId, productName: productInfo?.name || prize.label,
          durationId: targetDurationId, durationLabel: durLabel,
          key: claimedKeyValue, price: 0, purchaseType: "wheel",
          status: "success", attemptId: spinAttemptId,
          claimNote: `รางวัลจากวงล้อ: ${wheel.name}`,
          wheelId: wheel.id, wheelPrizeId: prize.id,
        });
      }

      // 7. Ledger entries (best-effort) — server already updated wallet atomically
      if (wheel.cost > 0) {
        recordLedgerOnly({
          userId: user.uid, userEmail: user.email, userName: profile?.displayName || profile?.email || "",
          amount: -wheel.cost, type: "wheel_spend",
          description: `ค่าหมุนวงล้อ: ${wheel.name}`,
          refId: spinAttemptId, method: "wheel",
          meta: { attemptId: spinAttemptId, wheelId: wheel.id, prizeId: prize.id, prizeLabel: prize.label, balanceTrackedExternally: true },
        }).catch(e => console.warn("[wheel] ledger spend failed", e));
      }
      if (prize.rewardType === "credit" && (prizeFromServer.creditAmount || 0) > 0) {
        recordLedgerOnly({
          userId: user.uid, userEmail: user.email, userName: profile?.displayName || profile?.email || "",
          amount: prizeFromServer.creditAmount, type: "wheel_prize",
          description: `รางวัลเครดิตจากวงล้อ: ${wheel.name}`,
          refId: spinAttemptId, method: "wheel",
          meta: { attemptId: spinAttemptId, wheelId: wheel.id, prizeId: prize.id, balanceTrackedExternally: true },
        }).catch(e => console.warn("[wheel] ledger prize failed", e));
      }

      // 8. Webhook notifications (non-blocking)
      try {
        const userDisplay = `${profile?.displayName || profile?.email || "-"} (${user.email || "-"})`;
        await sendWebhook(settings, "wheelSpin", [wheelSpinEmbed({
          userDisplay, wheelName: wheel.name, prizeLabel: prize.label,
          rewardType: prize.rewardType as any,
          creditAmount: prizeFromServer.creditAmount || 0,
          productName: productInfo?.name,
          productKey: claimedKeyValue || undefined,
          cost: wheel.cost || 0, attemptId: spinAttemptId,
          brandName: settings.brandName,
        })], { dedupeKey: `wheel:${spinAttemptId}` });

        if (claimedKeyValue) {
          const durLabel = (productInfo?.durations || []).find((d: any) => d.id === targetDurationId)?.label
            || (prize.productDays ? `${prize.productDays} วัน` : "");
          await sendWebhook(settings, "wheelKey", [keyStockActivityEmbed({
            action: "wheel", actorDisplay: userDisplay,
            actorRole: profile?.role || "user",
            productName: productInfo?.name || prize.label,
            durationLabel: durLabel, count: 1, keys: [claimedKeyValue],
            note: `ได้จากวงล้อ: ${wheel.name}`, refId: spinAttemptId,
            brandName: settings.brandName,
          })], { dedupeKey: `wheelKey:${spinAttemptId}` });
        }
      } catch { /* ignore */ }

      setTimeout(() => {
        if (spinId !== lastSpinIdRef.current) return;
        setSpinning(false);
        spinLockRef.current = false;
        setResult({ ...prize, creditAmount: prizeFromServer.creditAmount || 0 } as any);
        setShowResultModal(true);
        if (prize.rewardType === "credit" && (prizeFromServer.creditAmount || 0) > 0) {
          toast.success(`🎉 ได้รางวัล: ${prize.label} (+${prizeFromServer.creditAmount} เครดิต)`);
        } else if (prize.rewardType === "product") {
          toast.success(`🎉 ได้รางวัล: ${prize.label}`);
        } else if (prize.rewardType === "custom") {
          toast.success(`🎉 ได้รางวัล: ${prize.label}`);
        } else {
          toast(`ผลการหมุน: ${prize.label}`);
        }
      }, 4200);
    } catch (e: any) {
      setSpinning(false);
      spinLockRef.current = false;
      const msg = e?.message || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง";
      safeAddHistory("wheelAttempts", {
        userId: user.uid,
        userEmail: user.email || "",
        userName: profile?.displayName || profile?.email || "",
        wheelId: wheel.id, wheelName: wheel.name,
        attemptId: spinAttemptId, status: "failed",
        error: msg, cost: wheel.cost,
      });
      toast.error(msg);
    }
  };

  const cx = RADIUS, cy = RADIUS;

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12 relative z-10">
      <div className="max-w-5xl mx-auto">
        <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={12} /> กลับไปหน้าบริการ
        </Link>

        {wheel.bannerUrl && (
          <div className="rounded-2xl overflow-hidden mb-6 border border-border/50 max-h-48">
            <img src={wheel.bannerUrl} alt={wheel.name} className="w-full object-cover" />
          </div>
        )}

        <div className="text-center mb-6">
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent inline-flex items-center gap-2">
            <Sparkles className="text-primary" size={26} /> {wheel.name}
          </motion.h1>
          {wheel.description && <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">{wheel.description}</p>}
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Wheel */}
          <div className="glass-card flex flex-col items-center py-8">
            <div className="relative" style={{ width: SIZE, height: SIZE, maxWidth: "100%" }}>
              {/* Pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[24px] border-t-primary drop-shadow-[0_4px_8px_hsl(var(--primary)/0.6)]" />
              </div>
              {/* Glow */}
              <div className="absolute inset-0 rounded-full" style={{ boxShadow: "0 0 80px hsl(var(--primary) / 0.35), inset 0 0 40px hsl(var(--accent) / 0.2)" }} />
              <motion.div
                animate={{ rotate: rotation }}
                transition={{ duration: 4, ease: [0.17, 0.67, 0.21, 0.99] }}
                style={{ width: SIZE, height: SIZE }}
                className="relative"
              >
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" height="100%">
                  <defs>
                    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
                      <stop offset="92%" stopColor="hsl(var(--primary) / 0)" />
                      <stop offset="100%" stopColor="hsl(var(--primary) / 0.6)" />
                    </radialGradient>
                  </defs>
                  {prizes.map((p, i) => {
                    const start = i * slice;
                    const end = start + slice;
                    const path = arcPath(cx, cy, RADIUS - 6, start, end);
                    const mid = start + slice / 2;
                    const tp = polar(cx, cy, RADIUS * 0.62, mid);
                    const empty = stocks[p.id] === 0;
                    return (
                      <g key={p.id} opacity={empty ? 0.35 : 1}>
                        <path d={path} fill={p.color || "#6366f1"} stroke="hsl(var(--background))" strokeWidth={2} />
                        <text
                          x={tp.x} y={tp.y}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize={prizes.length > 8 ? 11 : 13}
                          fontWeight={700} fill="#fff"
                          transform={`rotate(${mid} ${tp.x} ${tp.y})`}
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
                        >
                          {p.label.length > 14 ? p.label.slice(0, 13) + "…" : p.label}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx={cx} cy={cy} r={RADIUS - 4} fill="none" stroke="url(#rim)" strokeWidth={8} />
                  <circle cx={cx} cy={cy} r={28} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={3} />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill="hsl(var(--primary))">SPIN</text>
                </svg>
              </motion.div>
            </div>

            <button
              onClick={spin}
              disabled={spinning || !user || cooldownLeft > 0 || reachedMax || insufficient}
              className="mt-8 btn-gradient relative overflow-hidden px-8 py-4 text-base font-bold inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {spinning ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
              {spinning ? "กำลังหมุน..." :
                !user ? "เข้าสู่ระบบเพื่อหมุน" :
                cooldownLeft > 0 ? `รอ ${cooldownLeft}s` :
                reachedMax ? "หมุนครบจำนวนแล้ว" :
                wheel.cost > 0 ? `หมุน (-${wheel.cost} เครดิต)` : "หมุนฟรี"}
            </button>

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {user && <span className="inline-flex items-center gap-1"><Coins size={12} className="text-primary" /> เครดิต: <b className="text-foreground">{balance}</b></span>}
              {wheel.maxSpinsPerUser > 0 && user && <span>หมุนแล้ว: <b className="text-foreground">{userSpins}/{wheel.maxSpinsPerUser}</b></span>}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {result && (
              <motion.button
                onClick={() => setShowResultModal(true)}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full glass-card border-primary/40 text-left hover:border-primary/70 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${result.color || "hsl(var(--primary))"}, hsl(var(--accent)))` }}>
                    <Trophy className="text-white" size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">รางวัลล่าสุด</div>
                    <div className="text-sm font-extrabold text-foreground truncate">{result.label}</div>
                    {result.rewardType === "credit" && (result.creditAmount || 0) > 0 && (
                      <div className="text-xs text-primary font-bold">+{result.creditAmount} เครดิต</div>
                    )}
                  </div>
                  <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">ดูรายละเอียด →</span>
                </div>
              </motion.button>
            )}

            <div className="glass-card">
              <h3 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5"><CircleDot size={12} className="text-primary" /> รางวัลทั้งหมด</h3>
              <div className="space-y-2 max-h-[420px] overflow-auto">
                {prizes.map(p => {
                  const total = prizes.reduce((s, x) => s + (Number(x.weight) || 0), 0);
                  const pct = total > 0 ? ((Number(p.weight) || 0) / total) * 100 : 0;
                  const stk = stocks[p.id] ?? p.stock;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-background/40 border border-border/40">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: p.color || "#6366f1" }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">{p.label}</div>
                        <div className="text-[10px] text-muted-foreground">โอกาส {pct.toFixed(1)}% {stk !== -1 && `· เหลือ ${stk}`}</div>
                      </div>
                      {p.rewardType === "credit" && <span className="text-[10px] font-bold text-primary">+{p.creditAmount}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResultModal && result && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(20px)" }}
            onClick={() => setShowResultModal(false)}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 18, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl border border-primary/40 overflow-hidden"
              style={{
                background: `linear-gradient(160deg, hsl(var(--background) / 0.95), hsl(var(--background) / 0.85))`,
                boxShadow: "0 30px 80px -20px hsl(var(--primary) / 0.5), inset 0 1px 0 hsl(var(--primary) / 0.3)",
              }}
            >
              {/* Confetti burst */}
              {result.rewardType !== "none" && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 18 }).map((_, i) => {
                    const angle = (i / 18) * Math.PI * 2;
                    const dist = 120 + Math.random() * 80;
                    const colors = ["#fbbf24", "#ec4899", "#6366f1", "#10b981", "#06b6d4"];
                    return (
                      <motion.span
                        key={i}
                        initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                        animate={{
                          x: Math.cos(angle) * dist,
                          y: Math.sin(angle) * dist,
                          opacity: 0,
                          scale: 1.2,
                          rotate: Math.random() * 360,
                        }}
                        transition={{ duration: 1.4, ease: "easeOut", delay: 0.15 }}
                        className="absolute top-1/2 left-1/2 w-2 h-3 rounded-sm"
                        style={{ background: colors[i % colors.length] }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Glow accent */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full pointer-events-none" style={{
                background: `radial-gradient(circle, ${result.color || "hsl(var(--primary))"} 0%, transparent 70%)`,
                opacity: 0.35,
              }} />

              <button
                onClick={() => setShowResultModal(false)}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-foreground/10 text-muted-foreground hover:text-foreground z-10"
              >
                <X size={18} />
              </button>

              <div className="relative px-6 pt-10 pb-6 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.1 }}
                  className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center mb-4 relative"
                  style={{
                    background: `linear-gradient(135deg, ${result.color || "hsl(var(--primary))"}, hsl(var(--accent)))`,
                    boxShadow: `0 12px 40px -8px ${result.color || "hsl(var(--primary))"}`,
                  }}
                >
                  {result.rewardType === "credit" ? <Coins className="text-white" size={44} /> :
                    result.rewardType === "product" ? <ShoppingBag className="text-white" size={44} /> :
                    result.rewardType === "custom" ? <Gift className="text-white" size={44} /> :
                    <Sparkles className="text-white/80" size={44} />}
                </motion.div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider mb-2">
                  {result.rewardType === "none" ? "ผลการหมุน" : <><PartyPopper size={11} /> ยินดีด้วย!</>}
                </div>
                <h2 className="text-2xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  {result.label}
                </h2>

                {result.rewardType === "credit" && (result.creditAmount || 0) > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
                    <Coins className="text-primary" size={20} />
                    <span className="text-xl font-extrabold text-foreground">+{result.creditAmount}</span>
                    <span className="text-sm text-muted-foreground">เครดิต</span>
                  </div>
                )}
                {result.rewardType === "product" && (() => {
                  const prod = (settings.products || []).find((x: any) => x.id === result.productId);
                  const days = result.productDays || 0;
                  return (
                    <div className="mt-4 mx-auto max-w-sm space-y-2">
                      {prod ? (
                        <div className="rounded-2xl border border-primary/30 bg-background/50 px-4 py-3 text-left">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">สินค้าที่ได้รับ</div>
                          <div className="text-sm font-bold text-foreground flex items-center justify-between gap-2">
                            <span className="truncate">{prod.name}</span>
                            {days > 0 && (
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[11px] font-extrabold">{days} วัน</span>
                            )}
                          </div>
                          {prod.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{prod.description}</p>}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">รางวัลสินค้าจะถูกจัดส่งให้คุณโดยทีมงาน{days > 0 ? ` (ระยะเวลา ${days} วัน)` : ""}</p>
                      )}

                      {keyStatus === "claiming" && (
                        <div className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-left flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">กำลังดึงคีย์จากสต็อก...</span>
                        </div>
                      )}
                      {keyStatus === "ok" && wonKey && (
                        <div className="rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-left">
                          <div className="text-[10px] uppercase tracking-wider text-primary mb-1">คีย์ของคุณ</div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono font-bold text-foreground bg-background/60 px-2 py-1.5 rounded-lg break-all">{wonKey}</code>
                            <button
                              onClick={() => { navigator.clipboard?.writeText(wonKey); toast.success("คัดลอกคีย์แล้ว"); }}
                              className="px-2.5 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-[11px] font-bold"
                            >
                              คัดลอก
                            </button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5">ดูประวัติได้ที่ "ประวัติการกดคีย์"</p>
                        </div>
                      )}
                      {keyStatus === "out_of_stock" && (
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left">
                          <div className="text-xs font-bold text-amber-500">คีย์ในสต็อกหมด</div>
                          <p className="text-[11px] text-muted-foreground mt-1">กรุณาติดต่อทีมงานเพื่อรับรางวัล (อ้างอิงประวัติการหมุน)</p>
                        </div>
                      )}
                      {keyStatus === "error" && (
                        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-left">
                          <div className="text-xs font-bold text-destructive">ดึงคีย์ไม่สำเร็จ</div>
                          <p className="text-[11px] text-muted-foreground mt-1">กรุณาติดต่อทีมงาน</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {result.rewardType === "custom" && result.customNote && (
                  <div className="mt-4 mx-auto max-w-sm rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">รายละเอียดของรางวัล</div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{result.customNote}</p>
                  </div>
                )}
                {result.rewardType === "none" && (
                  <p className="text-sm text-muted-foreground mt-3">ไม่ได้รางวัลในรอบนี้ ลองหมุนใหม่อีกครั้ง!</p>
                )}

                {/* CTAs */}
                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                  {result.rewardType === "credit" && (result.creditAmount || 0) > 0 ? (
                    <Link to="/wallet" className="btn-gradient flex-1 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                      <Wallet size={16} /> ดูกระเป๋าเงิน
                    </Link>
                  ) : result.rewardType === "product" && result.productId ? (
                    <Link to={`/product/${result.productId}`} className="btn-gradient flex-1 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                      <ShoppingBag size={16} /> ดูสินค้า
                    </Link>
                  ) : result.rewardType === "custom" ? (
                    <Link to="/store" className="btn-gradient flex-1 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                      <ShoppingBag size={16} /> ไปหน้าสินค้า
                    </Link>
                  ) : null}
                  <Link to="/wheel-history" className="flex-1 border border-border/60 bg-background/40 hover:bg-background/60 py-3 text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 text-foreground">
                    <Trophy size={16} /> ประวัติการหมุน
                  </Link>
                  <button
                    onClick={() => { setShowResultModal(false); }}
                    className={`${result.rewardType === "none" ? "btn-gradient flex-1" : "flex-1 border border-border/60 bg-background/40 hover:bg-background/60"} py-3 text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2 text-foreground`}
                  >
                    <RotateCw size={16} /> หมุนอีกครั้ง
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WheelPage;
