import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, UserRole, ROLE_HIERARCHY, ROLE_LABELS } from "@/contexts/AuthContext";
import { useSiteSettings, Product, ProductDuration, ProductCategory, DEFAULT_PERMISSIONS_LIST, DEFAULT_ROLE_PERMISSIONS_MAP, type PermissionItem, type RolePermissions, type SocialLink, type ParticlesConfig, type BannerLayout, type LayoutConfig, type HeroBannerConfig, type QuickNavItem, type TickerConfig, type ServiceItem, type TopUpSettings, type GiftCode, type DiscountSettings, type BgMusicConfig, type LeaderboardSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Save, Settings, Users, Palette, Key, Image, Plus, Trash2, Package, Eye, Sparkles, Search, Clock, Shield, CheckCircle, XCircle, ArrowUpDown, Filter, Crown, ChevronDown, ChevronUp, Megaphone, ExternalLink, GripVertical, RotateCcw, FolderOpen, LayoutGrid, Columns, Rows, MoveUp, MoveDown, Monitor, Wallet, Navigation, DollarSign, CreditCard, Receipt, Volume2, Link2, Globe, EyeOff, MousePointerClick, Wrench, Percent, Gift, Tag, Copy, Music, FileText, Upload, Ban, ShieldOff, Ticket, UserPlus, Star, AlertTriangle, Trophy, DatabaseZap, Database, Rocket, Power, AlertCircle, RefreshCw, Bell, FileDown, ClipboardList, CircleDot, Zap } from "lucide-react";
import AdminWebhooks from "@/components/admin/AdminWebhooks";
import AdminCoupons from "@/components/admin/AdminCoupons";
import AdminSection from "@/components/admin/AdminSection";
import AdminReferral from "@/components/admin/AdminReferral";
import AdminVipTiers from "@/components/admin/AdminVipTiers";
import AdminLeaderboard from "@/components/admin/AdminLeaderboard";
import AdminDataReset from "@/components/admin/AdminDataReset";
import AdminBackup from "@/components/admin/AdminBackup";
import ErrorBoundary from "@/components/ErrorBoundary";
import AdminGeneralTab from "@/components/admin/AdminGeneralTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AdminBrandingTab from "@/components/admin/AdminBrandingTab";
import AdminThemeTab from "@/components/admin/AdminThemeTab";
import AdminCategoriesTab from "@/components/admin/AdminCategoriesTab";
import AdminProductsTab from "@/components/admin/AdminProductsTab";
import AdminTopUpTab from "@/components/admin/AdminTopUpTab";
import AdminLayoutTab from "@/components/admin/AdminLayoutTab";
import AdminMusicTab from "@/components/admin/AdminMusicTab";
import AdminLegalTab from "@/components/admin/AdminLegalTab";
import AdminKeysTab from "@/components/admin/AdminKeysTab";
import AdminQuickNavTab from "@/components/admin/AdminQuickNavTab";
import AdminServicesTab from "@/components/admin/AdminServicesTab";
import AdminWheelsTab from "@/components/admin/AdminWheelsTab";
import AdminWheelClaimsTab from "@/components/admin/AdminWheelClaimsTab";
import AdminDiscountTab from "@/components/admin/AdminDiscountTab";
import AdminTransactionsTab from "@/components/admin/AdminTransactionsTab";
import AdminLinkPagesTab from "@/components/admin/AdminLinkPagesTab";
import AdminAuditLogTab from "@/components/admin/AdminAuditLogTab";
import AdminPermissionsTab from "@/components/admin/AdminPermissionsTab";

import AdminRuzienBypassTab from "@/components/admin/AdminRuzienBypassTab";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import AdminStatusWidget from "@/components/admin/AdminStatusWidget";
import PermIcon from "@/components/PermIcon";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { sendDailySummary, useDailySummaryScheduler } from "@/hooks/useDailySummaryScheduler";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

interface FirestoreUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

// sendDailySummary moved to src/hooks/useDailySummaryScheduler.ts

const CreditDisplay = ({ userId }: { userId: string }) => {
  const [bal, setBal] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "wallets", userId), (snap) => {
      setBal(snap.exists() ? (snap.data().balance || 0) : 0);
    });
    return () => unsub();
  }, [userId]);
  if (bal === null) return <span className="text-xs text-muted-foreground">กำลังโหลด...</span>;
  return <span className="font-bold text-foreground">฿{bal.toLocaleString()}</span>;
};

const AdminPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const { settings, updateSettings, loading: settingsLoading } = useSiteSettings();

  const isOwner = profile?.role === "owner";
  const isAdmin = hasPermission("admin");
  const isMod = hasPermission("moderator");

  const getDefaultTab = (): string => {
    if (isOwner) return "general";
    if (isAdmin) return "users";
    return "products";
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());
  const [form, setForm] = useState(settings);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [saved, setSaved] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subTabSheetOpen, setSubTabSheetOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [menuQuery, setMenuQuery] = useState("");
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const subTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [formInitialized, setFormInitialized] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      setUsers(snapshot.docs.map((d) => ({ ...(d.data() as FirestoreUser), uid: (d.data() as any).uid || d.id })));
    } catch (err) { console.error("Failed to load users:", err); }
  }, []);

  useEffect(() => {
    if (!formInitialized && !settingsLoading && settings) {
      setForm(settings);
      setFormInitialized(true);
    }
  }, [settings, settingsLoading, formInitialized]);
  useEffect(() => { if (isAdmin && user) loadUsers(); }, [isAdmin, user, loadUsers]);
  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  useDailySummaryScheduler(settings, updateSettings);

  // ─── Categories / tabs (computed every render — must be defined before any hooks that depend on them) ───
  const categories = useMemo(() => [
    ...(isOwner ? [{
      id: "cat-general",
      label: "ทั่วไป",
      icon: Settings,
      tabs: [{ id: "general", label: "ทั่วไป", icon: Settings }],
    }] : []),
    ...(isOwner ? [{
      id: "cat-appearance",
      label: "รูปลักษณ์",
      icon: Palette,
      tabs: [
        { id: "branding", label: "Branding", icon: Image },
        { id: "theme", label: "ธีม", icon: Palette },
        { id: "layout", label: "เลย์เอาท์", icon: Monitor },
        { id: "music", label: "เพลง", icon: Music },
        { id: "legal", label: "ข้อตกลง", icon: FileText },
      ],
    }] : []),
    {
      id: "cat-catalog",
      label: "แคตตาล็อก",
      icon: Package,
      tabs: [
        { id: "categories", label: "หมวดหมู่", icon: LayoutGrid },
        { id: "products", label: "สินค้า", icon: Package },
        { id: "keys", label: "ระบบคีย์", icon: Key },
        { id: "quicknav", label: "Quick Nav", icon: Navigation },
        { id: "services", label: "บริการ", icon: Wrench },
        { id: "wheels", label: "วงล้อสุ่ม", icon: CircleDot },
        ...(isAdmin ? [{ id: "wheelclaims", label: "ตรวจ Wheel Claims", icon: ClipboardList }] : []),
        
        ...(isOwner ? [{ id: "ruzienbypass", label: "Ruizen Bypass", icon: Zap }] : []),
      ],
    },
    ...(isOwner ? [{
      id: "cat-commerce",
      label: "การขาย",
      icon: Wallet,
      tabs: [
        { id: "topup", label: "เติมเงิน", icon: Wallet },
        { id: "discount", label: "ส่วนลด", icon: Percent },
        { id: "coupons", label: "คูปอง", icon: Ticket },
        { id: "viptier", label: "VIP Tier", icon: Star },
      ],
    }] : []),
    ...(isOwner ? [{
      id: "cat-growth",
      label: "การเติบโต",
      icon: Trophy,
      tabs: [
        { id: "referral", label: "Referral", icon: UserPlus },
        { id: "leaderboard", label: "Leaderboard", icon: Trophy },
      ],
    }] : []),
    ...(isAdmin ? [{
      id: "cat-users",
      label: "ผู้ใช้",
      icon: Users,
      tabs: [
        { id: "users", label: "จัดการยศ", icon: Users },
        ...(isOwner ? [{ id: "permissions", label: "ตารางสิทธิ์", icon: Shield }] : []),
      ],
    }] : []),
    ...(isAdmin ? [{
      id: "cat-logs",
      label: "บันทึก",
      icon: ClipboardList,
      tabs: [
        { id: "transactions", label: "ธุรกรรม", icon: Receipt },
        { id: "linkpages", label: "ลิ้งค์รวม", icon: Link2 },
        { id: "auditlog", label: "Audit Log", icon: ClipboardList },
        { id: "webhook", label: "Webhook", icon: Bell },
      ],
    }] : []),
    ...(isOwner ? [{
      id: "cat-system",
      label: "ระบบ",
      icon: Database,
      tabs: [
        { id: "datareset", label: "รีเซ็ตข้อมูล", icon: DatabaseZap },
        { id: "backup", label: "สำรองข้อมูล", icon: Database },
      ],
    }] : []),
  ], [isOwner, isAdmin]);

  const tabs = useMemo(() => categories.flatMap(c => c.tabs), [categories]);
  const activeCategory = useMemo(
    () => categories.find(c => c.tabs.some(t => t.id === activeTab)) || categories[0],
    [categories, activeTab]
  );

  const handleSubTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const subTabs = activeCategory?.tabs || [];
    if (!subTabs.length) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % subTabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + subTabs.length) % subTabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = subTabs.length - 1;
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveTab(subTabs[idx].id);
      return;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      setActiveTab(subTabs[nextIdx].id);
      const btn = subTabRefs.current[nextIdx];
      btn?.focus();
      btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCategory]);

  const swipeTo = useCallback((dir: "left" | "right") => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    if (idx === -1) return;
    const next = dir === "left" ? idx + 1 : idx - 1;
    if (next >= 0 && next < tabs.length) {
      setSlideDir(dir);
      setActiveTab(tabs[next].id);
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [activeTab, tabs]);

  const { onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd } = useSwipeNavigation({
    onSwipeLeft: () => swipeTo("left"),
    onSwipeRight: () => swipeTo("right"),
  });

  // ─── Early returns AFTER all hooks (Rules of Hooks) ───
  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!isMod) return <Navigate to="/" replace />;

  const handleSave = (overrideForm?: any) => {
    if (settingsLoading || !formInitialized) {
      toast.error("ยังโหลดค่าระบบไม่เสร็จ กรุณารอสักครู่");
      return;
    }
    const nextForm = overrideForm && typeof overrideForm === "object" && !("nativeEvent" in overrideForm) ? overrideForm : form;
    updateSettings(nextForm);
    setSaved(true);
    toast.success("บันทึกสำเร็จ!");
    setTimeout(() => setSaved(false), 2000);
  };

  // (categories / tabs / swipe handlers are defined above before early returns)

  const filteredCategories = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({ ...c, tabs: c.tabs.filter((t) => t.label.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)) }))
      .filter((c) => c.tabs.length > 0);
  }, [categories, menuQuery]);

  const currentTab = tabs.find((t) => t.id === activeTab);
  const hideSaveTabs = ["users", "permissions", "transactions", "linkpages", "auditlog", "wheelclaims", "datareset", "backup", "keys"];
  const showSave = !hideSaveTabs.includes(activeTab);

  return (
    <div className="relative z-10 h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'} h-full shrink-0 transition-all duration-300 hidden md:flex flex-col border-r border-border/40 bg-card/30`}>
          <div className="p-3 border-b border-border/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Settings size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">ตั้งค่าเว็บไซต์</div>
                <div className="text-[10px] text-muted-foreground truncate">Admin Panel</div>
              </div>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="ค้นหาเมนู..."
                className="w-full h-8 pl-7 pr-2 rounded-lg bg-muted/40 border border-border/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1 pb-24">
            {filteredCategories.map((cat) => {
              const isCatActive = cat.tabs.some((t) => t.id === activeTab);
              const collapsed = collapsedCats[cat.id] ?? false;
              return (
                <div key={cat.id} className="space-y-0.5">
                  <button
                    onClick={() => setCollapsedCats((s) => ({ ...s, [cat.id]: !collapsed }))}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      isCatActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <cat.icon size={12} />
                    <span className="flex-1 text-left">{cat.label}</span>
                    <ChevronDown size={12} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
                  </button>
                  {!collapsed && (
                    <div className="space-y-0.5">
                      {cat.tabs.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id);
                              contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className={`w-full flex items-center gap-2.5 pl-6 pr-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              active
                                ? 'bg-primary/12 text-foreground border-l-2 border-primary'
                                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-2 border-transparent'
                            }`}
                          >
                            <tab.icon size={13} className={active ? 'text-primary' : ''} />
                            <span className="truncate">{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredCategories.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">ไม่พบเมนู</div>
            )}
            {isAdmin && !menuQuery && (
              <Link to="/announcements" className="mt-3 w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all">
                <Megaphone size={13} /> ประกาศ
              </Link>
            )}
            <div className="pt-3">
              <AdminStatusWidget />
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Header */}
          <header className="shrink-0 border-b border-border/40 bg-background/60 backdrop-blur-md">
            <div className="flex items-center gap-2 px-3 sm:px-5 h-14">
              <button
                onClick={() => setSidebarOpen((s) => !s)}
                className="hidden md:flex w-8 h-8 rounded-lg hover:bg-muted/40 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                title="ซ่อน/แสดง sidebar"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden flex w-8 h-8 rounded-lg hover:bg-muted/40 items-center justify-center text-muted-foreground"
              >
                <LayoutGrid size={15} />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {activeCategory && (
                  <>
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">{activeCategory.label}</span>
                    <ChevronDown size={12} className="text-muted-foreground -rotate-90 hidden sm:inline" />
                  </>
                )}
                {currentTab && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <currentTab.icon size={14} className="text-primary shrink-0" />
                    <span className="text-sm font-semibold truncate">{currentTab.label}</span>
                  </div>
                )}
              </div>
              {showSave && (
                <button
                  onClick={handleSave}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                    saved
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-400/40'
                      : 'btn-gradient text-white shadow-sm hover:brightness-110 active:scale-95'
                  }`}
                >
                  {saved ? <CheckCircle size={14} /> : <Save size={14} />}
                  <span className="hidden sm:inline">{saved ? 'บันทึกแล้ว' : 'บันทึก'}</span>
                </button>
              )}
            </div>
            {activeCategory.tabs.length > 1 && (
              <div className="px-3 sm:px-5 pb-2 -mt-1">
                <div
                  role="tablist"
                  aria-label={`${activeCategory.label} sub-tabs`}
                  className="flex items-center gap-1 overflow-x-auto scrollbar-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {activeCategory.tabs.map((tab, idx) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        ref={(el) => { subTabRefs.current[idx] = el; }}
                        role="tab"
                        aria-selected={active}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setActiveTab(tab.id)}
                        onKeyDown={(e) => handleSubTabKeyDown(e, idx)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
                          active
                            ? 'bg-primary/12 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                        }`}
                      >
                        <tab.icon size={12} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </header>

          {/* Content */}
          <div ref={contentScrollRef} className="flex-1 overflow-y-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 pb-24 md:pb-8">


                {/* Sub-tab overlay sheet (mobile) */}
                <AnimatePresence>
                  {subTabSheetOpen && (
                    <div className="md:hidden fixed inset-0 z-[70]" onClick={() => setSubTabSheetOpen(false)}>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                      />
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl rounded-t-3xl border-t border-border/40 max-h-[70vh] overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-center pt-3 pb-1">
                          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
                        </div>
                        <div className="px-4 pb-2 flex items-center justify-between">
                          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <activeCategory.icon size={16} className="text-primary" />
                            {activeCategory.label}
                          </h3>
                          <button onClick={() => setSubTabSheetOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors duration-200">
                            <XCircle size={20} />
                          </button>
                        </div>
                        <div className="px-3 pb-8 grid grid-cols-3 gap-1.5 overflow-y-auto max-h-[55vh]">
                          {activeCategory.tabs.map((tab) => {
                            const active = activeTab === tab.id;
                            return (
                              <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setSubTabSheetOpen(false); }}
                                className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl text-xs font-medium transition-all duration-200 ease-out active:scale-95 ${
                                  active
                                    ? "glass-panel text-primary"
                                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                }`}
                              >
                                <tab.icon size={18} />
                                <span className="truncate w-full text-center text-[11px]">{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, x: slideDir === "left" ? 80 : slideDir === "right" ? -80 : 0, y: slideDir ? 0 : 12 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  key={activeTab}
                  onAnimationComplete={() => setSlideDir(null)}
                >
                <ErrorBoundary compact resetKey={activeTab} label={tabs.find(t => t.id === activeTab)?.label}>

            {activeTab === "general" && (
              <AdminGeneralTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "branding" && (
              <AdminBrandingTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "theme" && (
              <AdminThemeTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "layout" && isOwner && (
              <AdminLayoutTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "users" && isAdmin && (
              <AdminUsersTab form={form} setForm={setForm} handleSave={handleSave} user={user} profile={profile!} users={users} loadUsers={loadUsers} isOwner={isOwner} isAdmin={isAdmin} />
            )}

            {activeTab === "categories" && (
              <AdminCategoriesTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "quicknav" && (
              <AdminQuickNavTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "services" && (
              <AdminServicesTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "wheels" && (
              <AdminWheelsTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "wheelclaims" && isAdmin && (
              <AdminWheelClaimsTab />
            )}


            {activeTab === "ruzienbypass" && isOwner && (
              <AdminRuzienBypassTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "products" && (
              <AdminProductsTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "keys" && (
              <AdminKeysTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "webhook" && (
              <AdminWebhooks
                form={form}
                setForm={setForm}
                settings={settings}
                updateSettings={updateSettings}
                handleSave={handleSave}
                sendDailySummary={sendDailySummary}
              />
            )}

            {activeTab === "transactions" && isAdmin && (
              <AdminTransactionsTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "linkpages" && isAdmin && (
              <AdminLinkPagesTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "topup" && isOwner && (
              <AdminTopUpTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "discount" && isOwner && (
              <AdminDiscountTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "music" && isOwner && (
              <AdminMusicTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "coupons" && isOwner && (
              <AdminCoupons
                coupons={form.coupons || []}
                products={(form.products || []).filter((p: any) => p.enabled && p.name)}
                onUpdate={(coupons) => setForm({ ...form, coupons })}
                onSave={handleSave}
              />
            )}

            {activeTab === "referral" && isOwner && (
              <AdminReferral
                referral={form.referral || { enabled: false, referrerReward: 10, refereeReward: 10, maxReferrals: 50, rewardType: "credit", leaderboardEnabled: true, rewardTiers: [] }}
                onUpdate={(referral) => setForm({ ...form, referral })}
                onSave={handleSave}
              />
            )}

            {activeTab === "viptier" && isOwner && (
              <AdminVipTiers
                vipTiers={form.vipTiers || { enabled: false, tiers: [] }}
                onUpdate={(vipTiers) => setForm({ ...form, vipTiers })}
                onSave={handleSave}
              />
            )}

            {activeTab === "leaderboard" && isOwner && (
              <AdminLeaderboard
                leaderboard={form.leaderboard || { enabled: true, rewards: [] }}
                onUpdate={(leaderboard) => setForm({ ...form, leaderboard })}
                onSave={handleSave}
              />
            )}

            {activeTab === "datareset" && isOwner && user && (
              <AdminDataReset user={user} profile={profile} />
            )}

            {activeTab === "backup" && isOwner && user && (
              <AdminBackup user={user} profile={profile} />
            )}

            {activeTab === "legal" && isOwner && (
              <AdminLegalTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "auditlog" && isAdmin && (
              <AdminAuditLogTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "permissions" && isOwner && (
              <AdminPermissionsTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

                </ErrorBoundary>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Save & Scroll-to-top */}
      {!["users", "permissions", "transactions", "linkpages", "auditlog"].includes(activeTab) && (
        <>
          <button
            onClick={() => contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-20 right-4 md:bottom-28 md:right-8 z-50 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all shadow-lg flex items-center justify-center"
            title="กลับขึ้นด้านบน"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={handleSave}
            className={`fixed bottom-[4.5rem] right-4 md:bottom-8 md:right-8 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full btn-gradient shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${saved ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-background' : ''}`}
            title={saved ? "บันทึกแล้ว" : "บันทึกการตั้งค่า"}
          >
            {saved ? <CheckCircle size={22} className="text-white" /> : <Save size={22} className="text-white" />}
          </button>
        </>
      )}
    </div>
  );
};

export default AdminPage;
