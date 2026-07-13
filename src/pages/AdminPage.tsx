import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, UserRole, ROLE_HIERARCHY, ROLE_LABELS } from "@/contexts/AuthContext";
import { useSiteSettings, Product, ProductDuration, ProductCategory, DEFAULT_PERMISSIONS_LIST, DEFAULT_ROLE_PERMISSIONS_MAP, type PermissionItem, type RolePermissions, type SocialLink, type ParticlesConfig, type BannerLayout, type LayoutConfig, type HeroBannerConfig, type QuickNavItem, type TickerConfig, type ServiceItem, type TopUpSettings, type GiftCode, type DiscountSettings, type BgMusicConfig, type LeaderboardSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Save, Settings, Users, Palette, Key, Image, Plus, Trash2, Package, Eye, Sparkles, Search, Clock, Shield, CheckCircle, XCircle, ArrowUpDown, Filter, Crown, ChevronDown, ChevronUp, Megaphone, ExternalLink, GripVertical, RotateCcw, FolderOpen, LayoutGrid, Columns, Rows, MoveUp, MoveDown, Monitor, Wallet, Navigation, DollarSign, CreditCard, Receipt, Volume2, Link2, Globe, EyeOff, MousePointerClick, Wrench, Percent, Gift, Tag, Copy, Music, FileText, Upload, Ban, ShieldOff, Ticket, UserPlus, Star, AlertTriangle, Trophy, DatabaseZap, Database, Rocket, Power, AlertCircle, RefreshCw, Bell, FileDown, ClipboardList, CircleDot, Zap, Pin, PinOff, TrendingUp, LayoutDashboard, BarChart3, Share2, KeyRound, ScrollText, Archive, ShieldBan, History } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
// Lazy-load every admin tab so one broken tab doesn't block AdminPage from mounting,
// and initial JS shrinks dramatically for admins who only use a few tabs.
const AdminWebhooks = lazy(() => import("@/components/admin/AdminWebhooks"));
const AdminCoupons = lazy(() => import("@/components/admin/AdminCoupons"));
const AdminReferral = lazy(() => import("@/components/admin/AdminReferral"));
const AdminVipTiers = lazy(() => import("@/components/admin/AdminVipTiers"));
const AdminLeaderboard = lazy(() => import("@/components/admin/AdminLeaderboard"));
const AdminDataReset = lazy(() => import("@/components/admin/AdminDataReset"));
const AdminFinanceCleanup = lazy(() => import("@/components/admin/AdminFinanceCleanup"));
const AdminBackup = lazy(() => import("@/components/admin/AdminBackup"));
const AdminGeneralTab = lazy(() => import("@/components/admin/AdminGeneralTab"));
const AdminUsersTab = lazy(() => import("@/components/admin/AdminUsersTab"));
const AdminBrandingTab = lazy(() => import("@/components/admin/AdminBrandingTab"));
const AdminThemeTab = lazy(() => import("@/components/admin/AdminThemeTab"));
const AdminCategoriesTab = lazy(() => import("@/components/admin/AdminCategoriesTab"));
const AdminProductsTab = lazy(() => import("@/components/admin/AdminProductsTab"));
const AdminTopUpTab = lazy(() => import("@/components/admin/AdminTopUpTab"));
const AdminLayoutTab = lazy(() => import("@/components/admin/AdminLayoutTab"));
const AdminMusicTab = lazy(() => import("@/components/admin/AdminMusicTab"));
const AdminLegalTab = lazy(() => import("@/components/admin/AdminLegalTab"));
const AdminKeysTab = lazy(() => import("@/components/admin/AdminKeysTab"));
const AdminQuickNavTab = lazy(() => import("@/components/admin/AdminQuickNavTab"));
const AdminServicesTab = lazy(() => import("@/components/admin/AdminServicesTab"));
const AdminWheelsTab = lazy(() => import("@/components/admin/AdminWheelsTab"));
const AdminWheelClaimsTab = lazy(() => import("@/components/admin/AdminWheelClaimsTab"));
const AdminDiscountTab = lazy(() => import("@/components/admin/AdminDiscountTab"));
const AdminTransactionsTab = lazy(() => import("@/components/admin/AdminTransactionsTab"));
const AdminLinkPagesTab = lazy(() => import("@/components/admin/AdminLinkPagesTab"));
const AdminAuditLogTab = lazy(() => import("@/components/admin/AdminAuditLogTab"));
const AdminPermissionsTab = lazy(() => import("@/components/admin/AdminPermissionsTab"));
const AdminRuzienBypassTab = lazy(() => import("@/components/admin/AdminRuzienBypassTab"));
const AdminRoleAccessTab = lazy(() => import("@/components/admin/AdminRoleAccessTab"));
const AdminEffectsTab = lazy(() => import("@/components/admin/AdminEffectsTab"));


import PageBreadcrumb from "@/components/PageBreadcrumb";
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
  const isHightXCrew = hasPermission("hightxcrew");

  // Owner-defined per-tab visibility (from Role Access). Falls back to role-based defaults.
  const tabAllowed = (tabId: string): boolean => {
    if (isOwner) return true;
    const featId = `admin.tab.${tabId}`;
    const roleFeatures = (settings as any)?.roleFeatures?.[profile?.role || ""];
    if (Array.isArray(roleFeatures)) return roleFeatures.includes(featId);
    return true; // no overrides set — keep existing behaviour
  };


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
  const [pinnedTabs, setPinnedTabs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("admin_pinned_tabs") || "[]"); } catch { return []; }
  });
  const togglePin = useCallback((tabId: string) => {
    setPinnedTabs((prev) => {
      const next = prev.includes(tabId) ? prev.filter((t) => t !== tabId) : [...prev, tabId];
      try { localStorage.setItem("admin_pinned_tabs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

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
        { id: "effects", label: "เอฟเฟกต์", icon: Sparkles },
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
        ...(isOwner ? [{ id: "roleaccess", label: "Role Access", icon: Shield }] : []),
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
    // ─── ทางลัดไปหน้าอื่น (ย้ายมาจาก Hub) ───
    ...(isHightXCrew ? [{
      id: "cat-team-tools",
      label: "เครื่องมือทีมงาน",
      icon: TrendingUp,
      tabs: [
        { id: "goto-dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { id: "goto-analytics", label: "วิเคราะห์ยอดขาย", icon: BarChart3, href: "/analytics" },
        { id: "goto-stock", label: "จัดการสต็อก", icon: Package, href: "/stock" },
        { id: "goto-links", label: "Link รวม", icon: Share2, href: "/links" },
      ] as any,
    }] : []),
    ...(isMod ? [{
      id: "cat-mod-tools",
      label: "เครื่องมือผู้ดูแล",
      icon: Wrench,
      tabs: [
        { id: "goto-keymgmt", label: "จัดการคีย์", icon: KeyRound, href: "/keys" },
        { id: "goto-activitylog", label: "บันทึกกิจกรรม", icon: ScrollText, href: "/activity-log" },
      ] as any,
    }] : []),
    ...(isAdmin ? [{
      id: "cat-admin-tools",
      label: "จัดการระบบ",
      icon: Settings,
      tabs: [
        { id: "goto-allclaims", label: "ประวัติกดคีย์ทั้งหมด", icon: ClipboardList, href: "/all-claims" },
        { id: "goto-alltopup", label: "ประวัติเติมเงินทั้งหมด", icon: Wallet, href: "/all-topup" },
        { id: "goto-allwheel", label: "ประวัติวงล้อทั้งหมด", icon: History, href: "/all-wheel" },
        { id: "goto-allhistory", label: "ประวัติผู้ใช้ทั้งหมด", icon: Search, href: "/all-history" },
        { id: "goto-balances", label: "ยอดคงค้างลูกค้า", icon: Users, href: "/customer-balances" },
        { id: "goto-archived", label: "คีย์ Archive", icon: Archive, href: "/archived-keys" },
        { id: "goto-banned", label: "ผู้ถูกแบน", icon: ShieldBan, href: "/banned-users" },
      ] as any,
    }] : []),
  ], [isOwner, isAdmin, isMod, isHightXCrew]);

  // Apply per-role tab visibility overrides (Role Access tab)
  const roleFeaturesSetting = (settings as any)?.roleFeatures;
  const visibleCategories = useMemo(() => {
    return categories
      .map((c) => ({ ...c, tabs: c.tabs.filter((t) => tabAllowed(t.id)) }))
      .filter((c) => c.tabs.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, roleFeaturesSetting, profile?.role, isOwner]);

  const tabs = useMemo(() => visibleCategories.flatMap(c => c.tabs), [visibleCategories]);
  const activeCategory = useMemo(
    () => visibleCategories.find(c => c.tabs.some(t => t.id === activeTab)) || visibleCategories[0],
    [visibleCategories, activeTab]
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
    if (!q) return visibleCategories;
    return visibleCategories
      .map((c) => ({ ...c, tabs: c.tabs.filter((t) => t.label.toLowerCase().includes(q) || c.label.toLowerCase().includes(q)) }))
      .filter((c) => c.tabs.length > 0);
  }, [visibleCategories, menuQuery]);


  const currentTab = tabs.find((t) => t.id === activeTab);
  const hideSaveTabs = ["users", "permissions", "roleaccess", "transactions", "linkpages", "auditlog", "wheelclaims", "datareset", "backup", "keys"];
  const showSave = !hideSaveTabs.includes(activeTab);

  return (
    <><div className="relative z-10 h-[calc(100vh-4rem)] overflow-hidden flex">
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-border/40 bg-card/30 backdrop-blur-sm transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-14'
        }`}
      >
        {/* Sidebar header */}
        <div className="h-14 shrink-0 flex items-center gap-2 px-3 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Settings size={15} />
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">ตั้งค่าแอดมิน</p>
              <p className="text-[10px] text-muted-foreground truncate">{ROLE_LABELS[profile.role]}</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "ย่อเมนู" : "ขยายเมนู"}
            className="w-7 h-7 rounded-lg hover:bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0"
          >
            <ChevronDown size={13} className={`transition-transform ${sidebarOpen ? 'rotate-90' : '-rotate-90'}`} />
          </button>
        </div>

        {/* Search */}
        {sidebarOpen && (
          <div className="px-3 py-2 shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="ค้นหาเมนู..."
                className="w-full h-8 pl-7 pr-2 rounded-lg bg-muted/40 border border-border/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40"
              />
            </div>
          </div>
        )}

        {/* Pinned */}
        {sidebarOpen && pinnedTabs.length > 0 && !menuQuery && (
          <div className="px-3 pb-2 shrink-0">
            <p className="text-[10px] font-bold text-primary/70 uppercase tracking-wider px-1 py-1 flex items-center gap-1">
              <Pin size={9} /> ปักหมุด
            </p>
            <div className="space-y-0.5">
              {pinnedTabs
                .map((pid) => tabs.find((t) => t.id === pid))
                .filter((t): t is NonNullable<typeof t> => !!t)
                .map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={`pin-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full group flex items-center gap-2 px-2 h-7 rounded-md text-xs font-medium transition-all ${
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      <tab.icon size={12} className="shrink-0" />
                      <span className="truncate flex-1 text-left">{tab.label}</span>
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); togglePin(tab.id); }}
                        className="opacity-0 group-hover:opacity-70 hover:!opacity-100"
                        title="ยกเลิกปักหมุด"
                      >
                        <PinOff size={10} />
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* Categories & tabs */}
        <nav className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filteredCategories.map((cat) => {
            const isCollapsed = !!collapsedCats[cat.id] && !menuQuery;
            const catActive = activeCategory?.id === cat.id;
            if (!sidebarOpen) {
              // Collapsed sidebar: show only category icons, click sets first tab
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.tabs[0].id)}
                  title={cat.label}
                  className={`w-10 h-10 mx-auto mb-1 flex items-center justify-center rounded-xl transition-all ${
                    catActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <cat.icon size={15} />
                </button>
              );
            }
            return (
              <div key={cat.id} className="mb-1">
                <button
                  onClick={() => setCollapsedCats((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                  className={`w-full flex items-center gap-2 px-2 h-7 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    catActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <cat.icon size={11} />
                  <span className="flex-1 text-left">{cat.label}</span>
                  <ChevronDown size={11} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>
                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {cat.tabs.map((tab) => {
                      const active = activeTab === tab.id;
                      const pinned = pinnedTabs.includes(tab.id);
                      const href = (tab as any).href as string | undefined;
                      const commonCls = `w-full flex items-center gap-2 pl-6 pr-2 h-8 rounded-md text-xs font-medium transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`;
                      if (href) {
                        return (
                          <div key={tab.id} className="relative group">
                            <Link to={href} className={commonCls}>
                              <tab.icon size={12} className="shrink-0" />
                              <span className="truncate flex-1 text-left">{tab.label}</span>
                              <ExternalLink size={10} className="opacity-60 shrink-0" />
                            </Link>
                          </div>
                        );
                      }
                      return (
                        <div key={tab.id} className="relative group">
                          <button
                            onClick={() => setActiveTab(tab.id)}
                            className={commonCls}
                          >
                            <tab.icon size={12} className="shrink-0" />
                            <span className="truncate flex-1 text-left">{tab.label}</span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); togglePin(tab.id); }}
                              title={pinned ? "ยกเลิกปักหมุด" : "ปักหมุด"}
                              className={`p-0.5 rounded transition-opacity ${pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-70 hover:!opacity-100'}`}
                            >
                              {pinned ? <PinOff size={10} /> : <Pin size={10} />}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {isAdmin && sidebarOpen && (
            <Link
              to="/announcements"
              className="mt-2 flex items-center gap-2 px-2 h-8 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40"
            >
              <Megaphone size={12} /> ประกาศ
              <ExternalLink size={10} className="ml-auto opacity-60" />
            </Link>
          )}
        </nav>
      </aside>

      {/* ─── Main column ─── */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
      <header className="shrink-0 bg-transparent border-b border-border/40">
        <div className="px-3 sm:px-4 md:px-6">
          <div className="flex items-center gap-2 h-14">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden flex w-8 h-8 rounded-lg hover:bg-muted/40 items-center justify-center text-muted-foreground"
              title="เมนู"
            >
              <LayoutGrid size={15} />
            </button>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {activeCategory && (
                <>
                  <span className="text-[11px] text-muted-foreground hidden sm:inline">{activeCategory.label}</span>
                  <ChevronDown size={11} className="text-muted-foreground -rotate-90 hidden sm:inline shrink-0" />
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

          {/* Mobile: sub-tab pill row */}
          {activeCategory.tabs.length > 1 && (
            <div className="md:hidden pb-2 pt-1">
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
                      className={`flex items-center gap-1.5 pl-3 pr-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground'
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
        </div>
      </header>

      {/* Content */}
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 pb-24 md:pb-8">



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
                <Suspense fallback={<div className="py-16 flex items-center justify-center text-xs text-muted-foreground gap-2"><RefreshCw size={14} className="animate-spin" /> กำลังโหลดแท็บ...</div>}>

            {activeTab === "general" && (
              <AdminGeneralTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "branding" && (
              <AdminBrandingTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "theme" && (
              <AdminThemeTab form={form} setForm={setForm} handleSave={handleSave} />
            )}

            {activeTab === "effects" && isOwner && (
              <AdminEffectsTab form={form} setForm={setForm} handleSave={handleSave} />
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

            {activeTab === "roleaccess" && isOwner && (
              <AdminRoleAccessTab />
            )}


                </Suspense>
                </ErrorBoundary>
              </motion.div>
            </div>
          </div>
        </div>
      </div>




      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl border-t border-border/40 max-h-[80vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-4 pb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">เมนูตั้งค่า</h3>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
                <XCircle size={18} />
              </button>
            </div>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={menuQuery}
                  onChange={(e) => setMenuQuery(e.target.value)}
                  placeholder="ค้นหาเมนู..."
                  className="w-full h-9 pl-7 pr-2 rounded-lg bg-muted/40 border border-border/40 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[62vh] px-3 pb-8 space-y-3">
              {filteredCategories.map((cat) => (
                <div key={cat.id}>
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-1 py-1.5 flex items-center gap-1.5">
                    <cat.icon size={12} /> {cat.label}
                  </h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {cat.tabs.map((tab) => {
                      const href = (tab as any).href as string | undefined;
                      const cls = `flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                        activeTab === tab.id
                          ? 'bg-primary/12 text-primary border border-primary/30'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent'
                      }`;
                      if (href) {
                        return (
                          <Link
                            key={tab.id}
                            to={href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cls}
                          >
                            <tab.icon size={18} />
                            <span className="truncate w-full text-center text-[11px]">{tab.label}</span>
                          </Link>
                        );
                      }
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setMobileMenuOpen(false);
                            contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={cls}
                        >
                          <tab.icon size={18} />
                          <span className="truncate w-full text-center text-[11px]">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );


};

export default AdminPage;
