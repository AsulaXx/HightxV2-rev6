import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getSellingRate,
  type BoosterService,
  type BoosterProfitConfig,
} from "@/lib/boosterApi";
import {
  Search, Loader2, Layers, Filter, RefreshCw, ArrowLeft,
  DollarSign, Hash, Clock, CheckCircle, ChevronRight, Link2, Eye, Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/** Extract platform name from category string, e.g. "Instagram - Followers" → "Instagram" */
function extractPlatform(category: string): string {
  // Common patterns: "Platform - Type", "Platform Type", "Platform"
  const dashIdx = category.indexOf(" - ");
  if (dashIdx > 0) return category.substring(0, dashIdx).trim();

  // Try matching known platforms
  const knownPlatforms = [
    "Instagram", "TikTok", "YouTube", "Facebook", "Twitter", "X",
    "Telegram", "Spotify", "SoundCloud", "Threads", "Snapchat",
    "LinkedIn", "Pinterest", "Twitch", "Discord", "LINE",
    "Clubhouse", "Reddit", "Kwai", "Likee", "VK", "Tumblr",
    "Google", "Apple Music", "Deezer", "Shazam", "Website",
    "Reviews", "SEO", "Traffic", "Emoji",
  ];
  for (const p of knownPlatforms) {
    if (category.toLowerCase().startsWith(p.toLowerCase())) return p;
  }
  return category.split(" ")[0] || category;
}

/** Generate example link based on service name / category */
function getExampleLink(service: BoosterService): string {
  const name = (service.name + " " + service.category).toLowerCase();
  if (name.includes("instagram")) return "https://www.instagram.com/username";
  if (name.includes("tiktok")) return "https://www.tiktok.com/@username/video/1234567890";
  if (name.includes("youtube") && (name.includes("view") || name.includes("watch")))
    return "https://www.youtube.com/watch?v=VIDEO_ID";
  if (name.includes("youtube") && name.includes("subscri"))
    return "https://www.youtube.com/channel/CHANNEL_ID";
  if (name.includes("youtube"))
    return "https://www.youtube.com/watch?v=VIDEO_ID";
  if (name.includes("facebook") && name.includes("page"))
    return "https://www.facebook.com/PageName";
  if (name.includes("facebook"))
    return "https://www.facebook.com/post/123456789";
  if (name.includes("twitter") || name.includes(" x "))
    return "https://twitter.com/username/status/1234567890";
  if (name.includes("telegram"))
    return "https://t.me/channel_name";
  if (name.includes("spotify") && name.includes("playlist"))
    return "https://open.spotify.com/playlist/PLAYLIST_ID";
  if (name.includes("spotify"))
    return "https://open.spotify.com/track/TRACK_ID";
  if (name.includes("soundcloud"))
    return "https://soundcloud.com/artist/track-name";
  if (name.includes("threads"))
    return "https://www.threads.net/@username";
  if (name.includes("linkedin"))
    return "https://www.linkedin.com/in/username";
  if (name.includes("pinterest"))
    return "https://www.pinterest.com/pin/PIN_ID";
  if (name.includes("twitch"))
    return "https://www.twitch.tv/username";
  if (name.includes("discord"))
    return "https://discord.gg/invite_code";
  if (name.includes("snapchat"))
    return "https://www.snapchat.com/add/username";
  if (name.includes("reddit"))
    return "https://www.reddit.com/r/subreddit/comments/POST_ID";
  return "https://example.com/your-link";
}

/** Platform icon colors */
const platformColors: Record<string, string> = {
  Instagram: "from-pink-500/20 to-purple-500/20 text-pink-500",
  TikTok: "from-slate-500/20 to-pink-500/20 text-foreground",
  YouTube: "from-red-500/20 to-red-600/20 text-red-500",
  Facebook: "from-blue-500/20 to-blue-600/20 text-blue-500",
  Twitter: "from-sky-400/20 to-sky-500/20 text-sky-500",
  X: "from-slate-400/20 to-slate-500/20 text-foreground",
  Telegram: "from-sky-400/20 to-blue-400/20 text-sky-500",
  Spotify: "from-green-500/20 to-green-600/20 text-green-500",
  SoundCloud: "from-orange-400/20 to-orange-500/20 text-orange-500",
  Threads: "from-slate-500/20 to-slate-600/20 text-foreground",
  LinkedIn: "from-blue-600/20 to-blue-700/20 text-blue-600",
  Twitch: "from-purple-500/20 to-purple-600/20 text-purple-500",
  Discord: "from-indigo-500/20 to-indigo-600/20 text-indigo-500",
  Google: "from-blue-400/20 to-green-400/20 text-blue-500",
};

interface Props {
  services: BoosterService[];
  profitConfig: BoosterProfitConfig;
  loading: boolean;
  onRefresh: () => void;
}

const BoosterCatalogPanel = ({ services, profitConfig, loading, onRefresh }: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailService, setDetailService] = useState<BoosterService | null>(null);
  const [budgetRange, setBudgetRange] = useState(500);
  const [budgetFilterEnabled, setBudgetFilterEnabled] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => setDebouncedSearch(value), 300);
    setSearchTimeout(t);
  }, [searchTimeout]);

  // Group services by platform
  const platforms = useMemo(() => {
    const map = new Map<string, { categories: Set<string>; count: number }>();
    services.forEach((s) => {
      const platform = extractPlatform(s.category);
      if (!map.has(platform)) map.set(platform, { categories: new Set(), count: 0 });
      const entry = map.get(platform)!;
      entry.categories.add(s.category);
      entry.count++;
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({
        name,
        count: data.count,
        categoryCount: data.categories.size,
      }));
  }, [services]);

  // Categories for selected platform
  const platformCategories = useMemo(() => {
    if (!selectedPlatform) return [];
    const catMap = new Map<string, number>();
    services.forEach((s) => {
      if (extractPlatform(s.category) === selectedPlatform) {
        catMap.set(s.category, (catMap.get(s.category) || 0) + 1);
      }
    });
    return Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [services, selectedPlatform]);

  // Filtered services for the selected category
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (selectedPlatform && extractPlatform(s.category) !== selectedPlatform) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
      }
      if (budgetFilterEnabled) {
        const rate = getSellingRate(parseFloat(s.rate), s.category, profitConfig);
        if (rate > budgetRange) return false;
      }
      return true;
    });
  }, [services, selectedPlatform, selectedCategory, debouncedSearch, budgetFilterEnabled, budgetRange, profitConfig]);

  // Search across all platforms
  const searchResults = useMemo(() => {
    if (!debouncedSearch && !budgetFilterEnabled) return null;
    if (!selectedPlatform && debouncedSearch) {
      return services.filter((s) => {
        const q = debouncedSearch.toLowerCase();
        const matchSearch = s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
        const matchBudget = !budgetFilterEnabled || getSellingRate(parseFloat(s.rate), s.category, profitConfig) <= budgetRange;
        return matchSearch && matchBudget;
      });
    }
    return null;
  }, [services, debouncedSearch, selectedPlatform, budgetFilterEnabled, budgetRange, profitConfig]);

  const getRate = (s: BoosterService) => getSellingRate(parseFloat(s.rate), s.category, profitConfig);

  const renderBreadcrumb = () => {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: "แพลตฟอร์ม", onClick: () => { setSelectedPlatform(null); setSelectedCategory(null); } },
    ];
    if (selectedPlatform) {
      parts.push({ label: selectedPlatform, onClick: () => setSelectedCategory(null) });
    }
    if (selectedCategory) {
      parts.push({ label: selectedCategory });
    }

    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3 flex-wrap">
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            {p.onClick ? (
              <button onClick={p.onClick} className="hover:text-primary transition-colors underline-offset-2 hover:underline">
                {p.label}
              </button>
            ) : (
              <span className="text-foreground font-medium">{p.label}</span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const renderServiceCard = (service: BoosterService) => {
    const sellRate = getRate(service);
    const baseRate = parseFloat(service.rate);
    const catMarkup = profitConfig.categoryMarkup[service.category] ?? profitConfig.globalMarkup;
    return (
      <motion.div
        key={service.service}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card-hover !p-0 cursor-pointer group"
        onClick={() => setDetailService(service)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/50">
                #{service.service}
              </span>
              {service.refill && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                  <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" /> Refill
                </span>
              )}
              {service.cancel && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/10">
                  ✕ Cancel
                </span>
              )}
              <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15">
                +{catMarkup}%
              </Badge>
            </div>
            <h4 className="text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {service.name}
            </h4>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {parseInt(service.min).toLocaleString()} - {parseInt(service.max).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground line-through">฿{baseRate.toFixed(2)}</p>
              <p className="text-base font-bold gradient-text">฿{sellRate.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">ต่อ 1,000</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Budget */}
      <div className="glass-card !p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาบริการทุกแพลตฟอร์ม..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 bg-background/50 border-border/50"
            />
          </div>
          <Button
            variant={budgetFilterEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setBudgetFilterEnabled(!budgetFilterEnabled)}
            className={budgetFilterEnabled ? "btn-gradient shrink-0" : "glass-panel shrink-0"}
          >
            <DollarSign className="w-3.5 h-3.5 mr-1" />
            {budgetFilterEnabled ? `≤ ฿${budgetRange}` : "กรองตามงบ"}
          </Button>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} className="shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <AnimatePresence>
          {budgetFilterEnabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-2 pb-1 px-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">งบสูงสุด (ต่อ 1,000)</span>
                <Input
                  type="number"
                  min={1}
                  value={budgetRange}
                  onChange={(e) => setBudgetRange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="bg-background/50 w-28 text-center font-bold"
                />
                <span className="text-xs text-muted-foreground">฿</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
        </div>
      ) : (
        <>
          {renderBreadcrumb()}

          {/* Global search results */}
          {searchResults && searchResults.length > 0 && !selectedPlatform ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">ผลการค้นหา "{debouncedSearch}"</span>
                <Badge variant="outline" className="text-[10px]">{searchResults.length}</Badge>
              </div>
              {searchResults.slice(0, 50).map(renderServiceCard)}
              {searchResults.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">แสดง 50 จาก {searchResults.length} รายการ — ลองเลือกแพลตฟอร์มเพื่อดูทั้งหมด</p>
              )}
            </div>
          ) : searchResults && searchResults.length === 0 && !selectedPlatform ? (
            <div className="glass-card text-center py-10">
              <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
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
                    className="glass-card-hover cursor-pointer group !p-4"
                    onClick={() => { setSelectedPlatform(name); setSelectedCategory(null); }}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center mb-3`}>
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">
                      {name}
                    </h3>
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
            /* ═══ Step 2: Category list for selected platform ═══ */
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlatform(null)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> กลับไปเลือกแพลตฟอร์ม
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {platformCategories.map(({ name, count }) => {
                  const catMarkup = profitConfig.categoryMarkup[name] ?? profitConfig.globalMarkup;
                  return (
                    <motion.div
                      key={name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-card-hover cursor-pointer group !p-3"
                      onClick={() => setSelectedCategory(name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {name}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{count} บริการ</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15">
                            +{catMarkup}%
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ═══ Step 3: Services list ═══ */
            <div className="space-y-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategory(null)}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> กลับไปเลือกหมวดหมู่
              </Button>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-foreground text-sm">{selectedCategory}</h3>
                <Badge variant="outline" className="text-[10px]">{filteredServices.length}</Badge>
              </div>
              {filteredServices.length === 0 ? (
                <div className="glass-card text-center py-10">
                  <Filter className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-foreground font-medium">ไม่พบบริการ</p>
                  <p className="text-sm text-muted-foreground">ลองเปลี่ยนเงื่อนไขการกรอง</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredServices.map(renderServiceCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Service Detail Dialog ═══ */}
      <Dialog open={!!detailService} onOpenChange={(open) => !open && setDetailService(null)}>
        <DialogContent className="sm:max-w-lg glass-panel !border-primary/15">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-primary" />
              </div>
              รายละเอียดบริการ
            </DialogTitle>
            <DialogDescription className="line-clamp-3">{detailService?.name}</DialogDescription>
          </DialogHeader>

          {detailService && (() => {
            const baseRate = parseFloat(detailService.rate);
            const sellRate = getRate(detailService);
            const catMarkup = profitConfig.categoryMarkup[detailService.category] ?? profitConfig.globalMarkup;
            const exampleLink = getExampleLink(detailService);
            return (
              <div className="space-y-4">
                {/* Info grid */}
                <div className="glass-card !p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service ID</span>
                    <span className="font-mono text-foreground">#{detailService.service}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">หมวดหมู่</span>
                    <span className="font-medium text-foreground">{detailService.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ประเภท</span>
                    <span className="text-foreground">{detailService.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">จำนวน</span>
                    <span className="text-foreground">
                      {parseInt(detailService.min).toLocaleString()} - {parseInt(detailService.max).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Refill</span>
                    {detailService.refill ? (
                      <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> รองรับ</span>
                    ) : (
                      <span className="text-muted-foreground">ไม่รองรับ</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Cancel</span>
                    {detailService.cancel ? (
                      <span className="text-amber-500">รองรับ</span>
                    ) : (
                      <span className="text-muted-foreground">ไม่รองรับ</span>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="rounded-xl p-4 bg-gradient-to-r from-primary/5 to-accent/5 border border-primary/15 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">ราคาต้นทุน</span>
                    <span className="text-sm text-muted-foreground line-through">฿{baseRate.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">กำไร</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15">
                      +{catMarkup}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">ราคาขาย</span>
                    <span className="text-xl font-bold gradient-text">฿{sellRate.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-right">ต่อ 1,000</p>
                </div>

                {/* Example Link */}
                <div className="glass-card !p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground">ตัวอย่างลิงก์ที่ถูกต้อง</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted/50 px-3 py-2 rounded-lg border border-border/50 text-primary break-all font-mono">
                      {exampleLink}
                    </code>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ลูกค้าต้องใส่ลิงก์ในรูปแบบนี้เพื่อให้ระบบทำงานได้ถูกต้อง
                  </p>
                </div>

                {/* Description */}
                {detailService.description && (
                  <div className="glass-card !p-3">
                    <p className="text-sm text-muted-foreground">{detailService.description}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoosterCatalogPanel;
