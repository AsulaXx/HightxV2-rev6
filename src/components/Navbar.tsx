import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import logo from "@/assets/logo.png";
import { LogOut, LogIn, Home, User, ExternalLink, Menu, X, ShoppingBag, History, Wallet, Bell, Compass, Settings, ChevronDown, Shield } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useNotifications } from "@/components/NotificationPanel";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
import { prefetchRoute } from "@/lib/routePrefetch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Shared token classes for consistent dark-glass styling
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0";
const TRANSITION = "transition-all duration-200 ease-out";
const ICON_BTN = `inline-flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 active:bg-white/10 active:scale-95 ${TRANSITION} ${FOCUS_RING}`;

const NotificationBellInline = () => {
  const { unreadCount } = useNotifications();
  return (
    <button
      onClick={() => document.dispatchEvent(new CustomEvent('toggle-notifications'))}
      className={`relative ${ICON_BTN}`}
      aria-label="Notifications"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-background">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

const Navbar = () => {
  const location = useLocation();
  const { user, profile, logout, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const { balance, loading: walletLoading } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isMod = !!user && hasPermission("moderator");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Centralized, reference-counted scroll lock (iOS-safe). See useScrollLock.
  useScrollLock(mobileMenuOpen);



  const currentPath = location.pathname;
  const navSocialLinks = settings.socialLinks?.filter(l => l.showOnNavbar !== false) || [];

  const navItems = [
    { path: "/", label: "หน้าหลัก", icon: Home },
    ...(user ? [{ path: "/store", label: "ร้านค้า", icon: ShoppingBag }] : []),
    ...(user && !scrolled ? [{ path: "/history", label: "ประวัติการซื้อ", icon: History }] : []),
  ];

  const pillBase = `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${TRANSITION} ${FOCUS_RING}`;
  const pillActive = "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]";
  const pillIdle = "text-muted-foreground hover:text-foreground hover:bg-white/5 active:scale-[0.97]";

  return (
    <>
      <nav className={`nav-glass sticky top-0 z-50 transition-all duration-500 ease-out relative ${scrolled ? "shadow-lg shadow-primary/10" : ""}`}>
        <div className={`mx-auto flex items-center justify-between gap-4 transition-all duration-500 ease-out ${scrolled ? "h-14 max-w-6xl px-4 sm:px-8 lg:px-10" : "h-20 max-w-[1400px] px-4 sm:px-10 lg:px-16"}`}>
          {/* Brand */}
          <Link to="/" className={`flex items-center gap-3 shrink-0 group rounded-xl ${FOCUS_RING}`}>
            <div className={`rounded-2xl overflow-hidden transition-all duration-500 ease-out group-hover:scale-110 group-hover:rotate-6 ring-1 ring-border/30 group-hover:shadow-lg group-hover:shadow-primary/10 ${scrolled ? "w-9 h-9" : "w-12 h-12"}`}>
              <img src={logo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className={`font-bold gradient-text tracking-tight hidden sm:block transition-all duration-500 ${scrolled ? "text-sm" : "text-lg"}`}>
              {settings.brandName}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5 glass-panel rounded-full px-2 py-1.5 glass-shine">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onMouseEnter={() => prefetchRoute(item.path)}
                onFocus={() => prefetchRoute(item.path)}
                onTouchStart={() => prefetchRoute(item.path)}
                className={`${pillBase} ${currentPath === item.path ? pillActive : pillIdle}`}
              >
                <item.icon size={16} strokeWidth={2} />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {user && (
              <div className="flex items-center gap-1">
                <Link
                  to="/wallet"
                  onMouseEnter={() => prefetchRoute("/wallet")}
                  onFocus={() => prefetchRoute("/wallet")}
                  className={`flex items-center gap-1.5 px-3.5 h-9 rounded-xl text-sm font-medium ${TRANSITION} ${FOCUS_RING} ${
                    currentPath === "/wallet"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  title="ประวัติ Wallet"
                >
                  <Wallet size={16} />
                  <span className="font-bold text-primary">
                    {walletLoading ? "..." : `฿${balance.toLocaleString()}`}
                  </span>
                </Link>
                <Link
                  to="/topup"
                  onMouseEnter={() => prefetchRoute("/topup")}
                  onFocus={() => prefetchRoute("/topup")}
                  className={`px-3 h-9 inline-flex items-center rounded-xl text-xs font-bold ${TRANSITION} ${FOCUS_RING} ${
                    currentPath === "/topup"
                      ? "bg-primary/10 text-primary"
                      : "text-primary/80 hover:text-primary hover:bg-primary/10"
                  }`}
                  title="เติมเงิน"
                >
                  เติมเงิน
                </Link>
              </div>
            )}
            {navSocialLinks.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
                className={ICON_BTN}
              >
                {link.iconUrl ? (
                  <img src={link.iconUrl} alt={link.label} className="w-4 h-4 object-contain rounded" />
                ) : (
                  <ExternalLink size={16} />
                )}
              </a>
            ))}
            <ThemeToggle />
            <NotificationBellInline />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-2 px-2.5 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 ${TRANSITION} ${FOCUS_RING}`}
                    aria-label="เมนูผู้ใช้"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ring-1 ring-border/30">
                      <User size={14} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium text-foreground max-w-[100px] truncate">{profile?.displayName || "โปรไฟล์"}</span>
                    <ChevronDown size={14} className="text-muted-foreground/60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-60">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground truncate">{profile?.displayName || "ผู้ใช้"}</span>
                    <span className="text-[11px] font-normal text-muted-foreground truncate">{profile?.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer"><User size={14} className="mr-2" /> โปรไฟล์</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/history" className="cursor-pointer"><History size={14} className="mr-2" /> ประวัติ</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet" className="cursor-pointer"><Wallet size={14} className="mr-2" /> Wallet</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/permissions" className="cursor-pointer"><Shield size={14} className="mr-2" /> สิทธิ์ของฉัน</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/hub" className="cursor-pointer"><Compass size={14} className="mr-2" /> เมนูทั้งหมด</Link>
                  </DropdownMenuItem>
                  {isMod && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer"><Settings size={14} className="mr-2" /> ตั้งค่าเว็บไซต์</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => logout()}
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut size={14} className="mr-2" /> ออกจากระบบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/login" className={`px-4 h-9 inline-flex items-center text-sm gap-1.5 rounded-xl text-foreground hover:bg-white/5 ${TRANSITION} ${FOCUS_RING}`}>
                  <LogIn size={14} /> เข้าสู่ระบบ
                </Link>
                <Link to="/login?mode=signup" className={`btn-gradient px-4 h-9 inline-flex items-center text-sm gap-1.5 rounded-xl ${FOCUS_RING}`}>
                  <User size={14} /> สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Right */}
          <div className="flex lg:hidden items-center gap-1">
            <ThemeToggle />
            <NotificationBellInline />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={ICON_BTN}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={`lg:hidden fixed inset-x-0 bottom-0 bg-background/60 backdrop-blur-md z-40 ${scrolled ? "top-14" : "top-20"}`}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`lg:hidden fixed inset-x-3 z-40 glass-card p-2 max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain backdrop-blur-xl shadow-2xl ${scrolled ? "top-[calc(3.5rem+0.5rem)]" : "top-[calc(5rem+0.5rem)]"}`}
            >
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const active = currentPath === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium ${TRANSITION} ${FOCUS_RING} ${
                        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5 active:bg-white/10"
                      }`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}

                {user && (
                  <>
                    <Link
                      to="/wallet"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 h-11 rounded-xl text-sm font-medium ${TRANSITION} ${FOCUS_RING} ${
                        currentPath === "/wallet" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5 active:bg-white/10"
                      }`}
                    >
                      <span className="flex items-center gap-3"><Wallet size={16} /> Wallet</span>
                      <span className="text-xs font-bold text-primary">
                        {walletLoading ? "..." : `฿${balance.toLocaleString()}`}
                      </span>
                    </Link>
                    <Link
                      to="/topup"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium ${TRANSITION} ${FOCUS_RING} ${
                        currentPath === "/topup" ? "bg-primary/10 text-primary" : "text-foreground hover:bg-white/5 active:bg-white/10"
                      }`}
                    >
                      <Wallet size={16} /> เติมเงิน
                    </Link>
                  </>
                )}

                <div className="h-px bg-border/30 my-1.5" />

                {user ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium text-foreground hover:bg-white/5 active:bg-white/10 ${TRANSITION} ${FOCUS_RING}`}
                    >
                      <User size={16} /> {profile?.displayName || "โปรไฟล์"}
                    </Link>
                    <Link
                      to="/permissions"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium text-foreground hover:bg-white/5 active:bg-white/10 ${TRANSITION} ${FOCUS_RING}`}
                    >
                      <Shield size={16} /> สิทธิ์ของฉัน
                    </Link>
                    <Link
                      to="/hub"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium text-foreground hover:bg-white/5 active:bg-white/10 ${TRANSITION} ${FOCUS_RING}`}
                    >
                      <Compass size={16} /> เมนูทั้งหมด
                    </Link>
                    {isMod && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium text-foreground hover:bg-white/5 active:bg-white/10 ${TRANSITION} ${FOCUS_RING}`}
                      >
                        <Settings size={16} /> ตั้งค่าเว็บไซต์
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/20 text-left ${TRANSITION} ${FOCUS_RING}`}
                    >
                      <LogOut size={16} /> ออกจากระบบ
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 px-1">
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3.5 h-11 rounded-xl text-sm font-medium text-foreground bg-white/5 hover:bg-white/10 active:bg-white/15 ${TRANSITION} ${FOCUS_RING}`}
                    >
                      <LogIn size={16} /> เข้าสู่ระบบ
                    </Link>
                    <Link
                      to="/login?mode=signup"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex-1 btn-gradient flex items-center justify-center gap-2 px-3.5 h-11 rounded-xl text-sm font-medium ${FOCUS_RING}`}
                    >
                      <User size={16} /> สมัครสมาชิก
                    </Link>
                  </div>
                )}

                {navSocialLinks.length > 0 && (
                  <>
                    <div className="h-px bg-border/30 my-1.5" />
                    <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                      {navSocialLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-[11px] font-medium text-foreground ${TRANSITION} ${FOCUS_RING}`}
                        >
                          {link.iconUrl ? (
                            <img src={link.iconUrl} alt={link.label} className="w-3.5 h-3.5 object-contain rounded" />
                          ) : (
                            <ExternalLink size={11} />
                          )}
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
