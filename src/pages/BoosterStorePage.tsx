import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import {
  getServices, addOrder, getSellingRate,
  DEFAULT_PROFIT_CONFIG, type BoosterService, type BoosterProfitConfig,
} from "@/lib/boosterApi";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
  Search, Loader2, Zap, TrendingUp,
  Rocket, Wallet, Hash, Layers, RefreshCw, Link2,
  DollarSign, Clock, CheckCircle, ChevronRight, ArrowLeft, Info,
  ClipboardList, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* ── helpers ── */

function extractPlatform(category: string): string {
  const dashIdx = category.indexOf(" - ");
  if (dashIdx > 0) return category.substring(0, dashIdx).trim();
  const known = [
    "Instagram","TikTok","YouTube","Facebook","Twitter","X",
    "Telegram","Spotify","SoundCloud","Threads","Snapchat",
    "LinkedIn","Pinterest","Twitch","Discord","LINE",
    "Clubhouse","Reddit","Kwai","Likee","VK","Tumblr",
    "Google","Apple Music","Deezer","Shazam","Website",
    "Reviews","SEO","Traffic","Emoji",
  ];
  for (const p of known) {
    if (category.toLowerCase().startsWith(p.toLowerCase())) return p;
  }
  return category.split(" ")[0] || category;
}

function getExampleLink(service: BoosterService): string {
  const n = (service.name + " " + service.category).toLowerCase();
  if (n.includes("instagram")) return "https://www.instagram.com/username";
  if (n.includes("tiktok")) return "https://www.tiktok.com/@username/video/123";
  if (n.includes("youtube") && n.includes("subscri")) return "https://www.youtube.com/channel/CHANNEL_ID";
  if (n.includes("youtube")) return "https://www.youtube.com/watch?v=VIDEO_ID";
  if (n.includes("facebook") && n.includes("page")) return "https://www.facebook.com/PageName";
  if (n.includes("facebook")) return "https://www.facebook.com/post/123";
  if (n.includes("twitter") || n.includes(" x ")) return "https://twitter.com/username/status/123";
  if (n.includes("telegram")) return "https://t.me/channel_name";
  if (n.includes("spotify")) return "https://open.spotify.com/track/TRACK_ID";
  if (n.includes("soundcloud")) return "https://soundcloud.com/artist/track";
  if (n.includes("threads")) return "https://www.threads.net/@username";
  if (n.includes("linkedin")) return "https://www.linkedin.com/in/username";
  if (n.includes("twitch")) return "https://www.twitch.tv/username";
  if (n.includes("discord")) return "https://discord.gg/invite_code";
  return "https://example.com/your-link";
}

const platformColors: Record<string, string> = {
  Instagram: "from-pink-500/20 to-purple-500/20 text-pink-500",
  TikTok: "from-slate-500/20 to-pink-500/20 text-foreground",
  YouTube: "from-red-500/20 to-red-600/20 text-red-500",
  Facebook: "from-blue-500/20 to-blue-600/20 text-blue-500",
  Twitter: "from-sky-400/20 to-sky-500/20 text-sky-500",
  Telegram: "from-sky-400/20 to-blue-400/20 text-sky-500",
  Spotify: "from-green-500/20 to-green-600/20 text-green-500",
  Threads: "from-slate-500/20 to-slate-600/20 text-foreground",
  LinkedIn: "from-blue-600/20 to-blue-700/20 text-blue-600",
  Twitch: "from-purple-500/20 to-purple-600/20 text-purple-500",
  Discord: "from-indigo-500/20 to-indigo-600/20 text-indigo-500",
};

/* ── component ── */

const BoosterStorePage = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const { balance } = useWallet();
  const navigate = useNavigate();
  const isAdmin = profile && ["owner", "admin"].includes(profile.role);
  const [services, setServices] = useState<BoosterService[]>([]);
  const [profitConfig, setProfitConfig] = useState<BoosterProfitConfig>(DEFAULT_PROFIT_CONFIG);
  const [loading, setLoading] = useState(true);

  // navigation
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [budgetRange, setBudgetRange] = useState(500);
  const [budgetFilterEnabled, setBudgetFilterEnabled] = useState(false);

  // order
  const [orderDialog, setOrderDialog] = useState<BoosterService | null>(null);
  const [orderLink, setOrderLink] = useState("");
  const [orderQty, setOrderQty] = useState("");
  const [ordering, setOrdering] = useState(false);

  useEffect(() => { loadServices(); loadProfitConfig(); }, []);

  const loadProfitConfig = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "boosterProfit"));
      if (snap.exists()) setProfitConfig({ ...DEFAULT_PROFIT_CONFIG, ...snap.data() } as BoosterProfitConfig);
    } catch { /* default */ }
  };

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await getServices(settings.booster?.apiKey || undefined);
      setServices(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error("โหลดรายการบริการไม่สำเร็จ: " + err.message);
    } finally { setLoading(false); }
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => setDebouncedSearch(value), 300);
    setSearchTimeout(t);
  }, [searchTimeout]);

  const getRate = (s: BoosterService) => getSellingRate(parseFloat(s.rate), s.category, profitConfig);

  /* ── derived data ── */

  const platforms = useMemo(() => {
    const map = new Map<string, { categories: Set<string>; count: number }>();
    services.forEach((s) => {
      const p = extractPlatform(s.category);
      if (!map.has(p)) map.set(p, { categories: new Set(), count: 0 });
      const e = map.get(p)!;
      e.categories.add(s.category);
      e.count++;
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, d]) => ({ name, count: d.count, categoryCount: d.categories.size }));
  }, [services]);

  const platformCategories = useMemo(() => {
    if (!selectedPlatform) return [];
    const catMap = new Map<string, number>();
    services.forEach((s) => {
      if (extractPlatform(s.category) === selectedPlatform)
        catMap.set(s.category, (catMap.get(s.category) || 0) + 1);
    });
    return Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [services, selectedPlatform]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (selectedPlatform && extractPlatform(s.category) !== selectedPlatform) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
      }
      if (budgetFilterEnabled && getRate(s) > budgetRange) return false;
      return true;
    });
  }, [services, selectedPlatform, selectedCategory, debouncedSearch, budgetFilterEnabled, budgetRange, profitConfig]);

  const globalSearchResults = useMemo(() => {
    if (!debouncedSearch || selectedPlatform) return null;
    return services.filter((s) => {
      const q = debouncedSearch.toLowerCase();
      const match = s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const matchBudget = !budgetFilterEnabled || getRate(s) <= budgetRange;
      return match && matchBudget;
    });
  }, [services, debouncedSearch, selectedPlatform, budgetFilterEnabled, budgetRange, profitConfig]);

  /* ── order handler ── */

  const handleOrder = async () => {
    if (!user || !orderDialog) return;
    if (!orderLink.trim()) { toast.error("กรุณากรอกลิงก์"); return; }
    const qty = parseInt(orderQty);
    const boosterSettings = settings.booster;
    const globalMin = boosterSettings?.minOrderQty || 1;
    const globalMax = boosterSettings?.maxOrderQty || 1000000;
    const min = Math.max(parseInt(orderDialog.min), globalMin);
    const max = globalMax > 0 ? Math.min(parseInt(orderDialog.max), globalMax) : parseInt(orderDialog.max);
    if (isNaN(qty) || qty < min || qty > max) {
      toast.error(`จำนวนต้องอยู่ระหว่าง ${min.toLocaleString()} - ${max.toLocaleString()}`); return;
    }
    const sellingRate = getRate(orderDialog);
    const totalCost = (sellingRate / 1000) * qty;
    if (balance < totalCost) {
      toast.error(`เครดิตไม่พอ ต้องการ ฿${totalCost.toFixed(2)} แต่มี ฿${balance.toFixed(2)}`);
      return;
    }
    setOrdering(true);
    const walletRef = doc(db, "wallets", user.uid);
    try {
      // Deduct wallet first
      await updateDoc(walletRef, { balance: increment(-totalCost) });

      const result = await addOrder({ service: String(orderDialog.service), link: orderLink.trim(), quantity: qty.toString() }, settings.booster?.apiKey || undefined);
      const res = result as any;
      if (res?.status && res.status >= 400) {
        throw new Error(res.message ? (Array.isArray(res.message) ? res.message.join(', ') : res.message) : 'API Error');
      }
      const orderId = res?.order ?? res?.orderId ?? res?.id ?? Date.now();
      const baseCost = (parseFloat(orderDialog.rate) / 1000) * qty;
      const profit = totalCost - baseCost;
      await addDoc(collection(db, "boosterOrders"), {
        userId: user.uid, userEmail: user.email, orderId: String(orderId),
        serviceId: orderDialog.service, serviceName: orderDialog.name,
        category: orderDialog.category, link: orderLink.trim(), quantity: qty,
        baseRate: parseFloat(orderDialog.rate), sellingRate, baseCost, totalCost, profit,
        status: "pending", createdAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "walletTransactions"), {
        userId: user.uid, type: "booster_purchase", amount: -totalCost,
        description: `ปั๊มบริการ: ${orderDialog.name} x${qty}`,
        orderId: String(orderId), createdAt: new Date().toISOString(),
      });
      // Send Discord webhook notification via edge function
      const boosterEmbed = {
        title: "🚀 สั่งซื้อ Booster ใหม่",
        color: 0xf97316,
        fields: [
          { name: "👤 ผู้ใช้", value: user.email || "ไม่ระบุ", inline: true },
          { name: "🚀 บริการ", value: orderDialog.name, inline: true },
          { name: "📂 หมวดหมู่", value: orderDialog.category || "-", inline: true },
          { name: "🔢 จำนวน", value: qty.toLocaleString(), inline: true },
          { name: "💰 ราคาขาย", value: `฿${totalCost.toFixed(2)}`, inline: true },
          { name: "📈 กำไร", value: `฿${profit.toFixed(2)}`, inline: true },
          { name: "🔗 ลิงก์", value: orderLink.trim() },
          { name: "🆔 Order ID", value: `#${orderId}`, inline: true },
        ],
        timestamp: new Date().toISOString(),
        footer: { text: settings.brandName || "HightX" },
      };
      try {
        const { sendWebhook } = await import("@/lib/webhookSender");
        await sendWebhook(settings, "booster", [boosterEmbed]);
      } catch (e) { console.error("Booster webhook failed:", e); }
      toast.success(`สั่งซื้อสำเร็จ! Order #${orderId}`);
      setOrderDialog(null); setOrderLink(""); setOrderQty("");
    } catch (err: any) {
      // Auto-refund on fail
      if (boosterSettings?.autoRefundOnFail !== false) {
        try {
          await updateDoc(walletRef, { balance: increment(totalCost) });
          await addDoc(collection(db, "walletTransactions"), {
            userId: user.uid, type: "booster_refund", amount: totalCost,
            description: `คืนเครดิต (Booster ล้มเหลว): ${orderDialog.name}`,
            createdAt: new Date().toISOString(),
          });
          toast.error("สั่งซื้อไม่สำเร็จ: " + err.message + " (คืนเครดิตแล้ว)");
        } catch (refundErr) {
          console.error("Refund failed:", refundErr);
          toast.error("สั่งซื้อไม่สำเร็จและคืนเครดิตล้มเหลว กรุณาแจ้งแอดมิน");
        }
      } else {
        toast.error("สั่งซื้อไม่สำเร็จ: " + err.message);
      }
    } finally { setOrdering(false); }
  };

  const orderSellingRate = orderDialog ? getRate(orderDialog) : 0;
  const totalCostPreview = orderDialog && orderQty && !isNaN(parseInt(orderQty))
    ? (orderSellingRate / 1000) * parseInt(orderQty) : 0;

  const boosterCfg = settings.booster;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card text-center p-8">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-primary" />
          <p className="text-foreground font-medium mb-2">กรุณาเข้าสู่ระบบ</p>
          <p className="text-sm text-muted-foreground">เพื่อใช้บริการ {boosterCfg?.brandName || "HightX Follower Booster"}</p>
        </div>
      </div>
    );
  }

  // ไม่เปิดใช้งาน
  if (boosterCfg && !boosterCfg.enabled) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card text-center p-8">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-foreground font-medium mb-2">บริการ Booster ปิดให้บริการชั่วคราว</p>
          <p className="text-sm text-muted-foreground">กรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม</p>
        </div>
      </div>
    );
  }

  // โหมดปิดปรับปรุง
  if (boosterCfg?.maintenanceMode) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card text-center p-8">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-amber-500" />
          <p className="text-foreground font-medium mb-2">🔧 ปิดปรับปรุงระบบ</p>
          <p className="text-sm text-muted-foreground">{boosterCfg.maintenanceMessage || "ระบบ Booster อยู่ระหว่างปรับปรุง กรุณารอสักครู่"}</p>
        </div>
      </div>
    );
  }

  // เช็คสิทธิ์ยศ
  if (boosterCfg?.allowedRoles && profile && !boosterCfg.allowedRoles.includes(profile.role) && !isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="glass-card text-center p-8">
          <Rocket className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-foreground font-medium mb-2">ไม่มีสิทธิ์เข้าถึง</p>
          <p className="text-sm text-muted-foreground">ยศของคุณไม่สามารถใช้บริการ Booster ได้ กรุณาติดต่อแอดมิน</p>
        </div>
      </div>
    );
  }

  /* ── breadcrumb ── */
  const renderBreadcrumb = () => {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: "แพลตฟอร์ม", onClick: () => { setSelectedPlatform(null); setSelectedCategory(null); } },
    ];
    if (selectedPlatform) parts.push({ label: selectedPlatform, onClick: () => setSelectedCategory(null) });
    if (selectedCategory) parts.push({ label: selectedCategory });
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            {p.onClick ? (
              <button onClick={p.onClick} className="hover:text-primary transition-colors underline-offset-2 hover:underline">{p.label}</button>
            ) : (
              <span className="text-foreground font-medium">{p.label}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  /* ── service card ── */
  const renderServiceCard = (service: BoosterService) => {
    const sellingRate = getRate(service);
    const exampleLink = getExampleLink(service);
    return (
      <motion.div key={service.service} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card-hover !p-0 group">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/10">
                {service.category}
              </span>
              {service.refill && (
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                  <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Refill
                </span>
              )}
              {service.cancel && (
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/10">
                  ✕ Cancel
                </span>
              )}
            </div>
            <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {service.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ขั้นต่ำ {parseInt(service.min).toLocaleString()}</span>
              <span className="text-border">|</span>
              <span>สูงสุด {parseInt(service.max).toLocaleString()}</span>
            </div>
            {/* Example link hint */}
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/70">
              <Link2 className="w-3 h-3" />
              <span className="truncate">{exampleLink}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="text-right">
              <p className="text-xl font-bold gradient-text leading-none">฿{sellingRate.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ต่อ 1,000</p>
            </div>
            <Button size="sm" className="btn-gradient !rounded-lg !px-4 gap-1.5" onClick={() => { setOrderDialog(service); setOrderQty(service.min); setOrderLink(""); }}>
              <Zap className="w-3.5 h-3.5" /> สั่งซื้อ
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <PageBreadcrumb
        items={[{ label: boosterCfg?.brandName || "HightX Follower Booster", path: "/hightxfollowerbooster" }]}
        title={boosterCfg?.brandName || "HightX Follower Booster"}
        subtitle={boosterCfg?.description || "บริการปั๊มผู้ติดตาม ยอดไลก์ และยอดวิว โซเชียลมีเดียทุกแพลตฟอร์ม"}
        icon={Rocket}
      />

      {/* Notice Banner */}
      {boosterCfg?.notice && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm flex items-start gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <span className="text-foreground">{boosterCfg.notice}</span>
        </div>
      )}
      {/* Action Buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="glass-panel gap-1.5"
          onClick={() => navigate("/booster-orders")}
        >
          <ClipboardList className="w-3.5 h-3.5" /> ประวัติออเดอร์
        </Button>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="glass-panel gap-1.5 text-muted-foreground"
            onClick={() => navigate("/boosteradminpanel")}
          >
            <Settings className="w-3.5 h-3.5" /> จัดการ
          </Button>
        )}
      </div>

      {/* Stats Bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">เครดิตคงเหลือ</p>
            <p className="text-lg font-bold gradient-text">฿{balance.toFixed(2)}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><Layers className="w-5 h-5 text-accent" /></div>
          <div>
            <p className="text-xs text-muted-foreground">บริการทั้งหมด</p>
            <p className="text-lg font-bold text-foreground">{services.length.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Hash className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">แพลตฟอร์ม</p>
            <p className="text-lg font-bold text-foreground">{platforms.length}</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 !p-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0"><TrendingUp className="w-5 h-5 text-accent" /></div>
          <div>
            <p className="text-xs text-muted-foreground">แสดงอยู่</p>
            <p className="text-lg font-bold text-foreground">{(globalSearchResults ?? filteredServices).length.toLocaleString()}</p>
          </div>
        </div>
      </motion.div>

      {/* Search + Budget */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card !p-3 mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ค้นหาบริการทุกแพลตฟอร์ม..." value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)} className="pl-10 bg-background/50 border-border/50" />
          </div>
          <Button
            variant={budgetFilterEnabled ? "default" : "outline"} size="sm"
            onClick={() => setBudgetFilterEnabled(!budgetFilterEnabled)}
            className={budgetFilterEnabled ? "btn-gradient shrink-0" : "glass-panel shrink-0"}
          >
            <DollarSign className="w-3.5 h-3.5 mr-1" />
            {budgetFilterEnabled ? `≤ ฿${budgetRange}` : "กรองตามงบ"}
          </Button>
          <Button variant="outline" size="icon" onClick={loadServices} disabled={loading} className="shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <AnimatePresence>
          {budgetFilterEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-2 pb-1 px-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">งบสูงสุด (ต่อ 1,000)</span>
                <Input type="number" min={1} value={budgetRange} onChange={(e) => setBudgetRange(Math.max(1, parseInt(e.target.value) || 1))} className="bg-background/50 w-28 text-center font-bold" />
                <span className="text-xs text-muted-foreground">฿</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">กำลังโหลดรายการบริการ...</p>
        </div>
      ) : (
        <>
          {renderBreadcrumb()}

          {/* Global search results */}
          {globalSearchResults && globalSearchResults.length > 0 && !selectedPlatform ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">ผลการค้นหา "{debouncedSearch}"</span>
                <Badge variant="outline" className="text-[10px]">{globalSearchResults.length}</Badge>
              </div>
              {globalSearchResults.slice(0, 50).map(renderServiceCard)}
              {globalSearchResults.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">แสดง 50 จาก {globalSearchResults.length} — เลือกแพลตฟอร์มเพื่อดูทั้งหมด</p>
              )}
            </div>
          ) : globalSearchResults && globalSearchResults.length === 0 && !selectedPlatform ? (
            <div className="glass-card text-center py-14">
              <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-foreground font-medium">ไม่พบบริการ</p>
              <p className="text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหา</p>
            </div>
          ) : !selectedPlatform ? (
            /* ═══ Step 1: Platform Grid ═══ */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {platforms.map(({ name, count, categoryCount }) => {
                const colorClass = platformColors[name] || "from-primary/15 to-accent/15 text-primary";
                return (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="glass-card-hover cursor-pointer group !p-4 relative"
                    onClick={() => { setSelectedPlatform(name); setSelectedCategory(null); }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-3`}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{name}</h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[11px] text-muted-foreground">{count} บริการ</span>
                      <span className="text-border">•</span>
                      <span className="text-[11px] text-muted-foreground">{categoryCount} หมวด</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground absolute top-4 right-4 group-hover:text-primary transition-colors" />
                  </motion.div>
                );
              })}
            </div>
          ) : !selectedCategory ? (
            /* ═══ Step 2: Categories ═══ */
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedPlatform(null)} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" /> กลับไปเลือกแพลตฟอร์ม
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {platformCategories.map(({ name, count }) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass-card-hover cursor-pointer group !p-3"
                    onClick={() => setSelectedCategory(name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{name}</h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{count} บริการ</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            /* ═══ Step 3: Services ═══ */
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" /> กลับไปเลือกหมวดหมู่
              </Button>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">{selectedCategory}</h3>
                <Badge variant="outline" className="text-[10px]">{filteredServices.length}</Badge>
              </div>
              {filteredServices.length === 0 ? (
                <div className="glass-card text-center py-14">
                  <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-foreground font-medium">ไม่พบบริการ</p>
                </div>
              ) : (
                <div className="space-y-2">{filteredServices.map(renderServiceCard)}</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Order Dialog ═══ */}
      <Dialog open={!!orderDialog} onOpenChange={(open) => !open && setOrderDialog(null)}>
        <DialogContent className="sm:max-w-md glass-panel !border-primary/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="w-4 h-4 text-primary" /></div>
              สั่งซื้อบริการ
            </DialogTitle>
            <DialogDescription className="line-clamp-2">{orderDialog?.name}</DialogDescription>
          </DialogHeader>

          {orderDialog && (() => {
            const exampleLink = getExampleLink(orderDialog);
            return (
              <div className="space-y-4">
                <div className="glass-card !p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">หมวดหมู่</span>
                    <span className="font-medium text-foreground">{orderDialog.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ราคา</span>
                    <span className="font-semibold text-primary">฿{orderSellingRate.toFixed(2)} / 1,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">จำนวน</span>
                    <span className="text-foreground">{parseInt(orderDialog.min).toLocaleString()} - {parseInt(orderDialog.max).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm"><Link2 className="w-3.5 h-3.5" /> ลิงก์ (URL)</Label>
                  <Input placeholder={exampleLink} value={orderLink} onChange={(e) => setOrderLink(e.target.value)} className="bg-background/50" />
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3 shrink-0" /> ตัวอย่าง: {exampleLink}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm"><Hash className="w-3.5 h-3.5" /> จำนวน</Label>
                  <Input type="number" min={orderDialog.min} max={orderDialog.max} value={orderQty} onChange={(e) => setOrderQty(e.target.value)} className="bg-background/50" />
                </div>

                {totalCostPreview > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl p-4 bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/15">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">ราคารวม</span>
                      <span className="text-2xl font-bold gradient-text">฿{totalCostPreview.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">เครดิตคงเหลือ</span>
                      <span className={`text-xs font-medium ${balance >= totalCostPreview ? "text-emerald-500" : "text-destructive"}`}>
                        ฿{balance.toFixed(2)} {balance >= totalCostPreview ? "✓ พอ" : "✕ ไม่พอ"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOrderDialog(null)} className="glass-panel">ยกเลิก</Button>
            <Button onClick={handleOrder} disabled={ordering || (totalCostPreview > 0 && balance < totalCostPreview)} className="btn-gradient gap-1.5">
              {ordering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              ยืนยันสั่งซื้อ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoosterStorePage;
