import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import { useNotifications } from "@/components/NotificationPanel";
import { useScrollLock } from "@/hooks/useScrollLock";
import { prefetchRoute } from "@/lib/routePrefetch";
import ThemeToggle from "@/components/ThemeToggle";
import logo from "@/assets/logo.png";
import {
  LogOut, LogIn, Home, User, ExternalLink, Menu, X, ShoppingBag,
  History, Wallet, Bell, Compass, Settings, ChevronDown, Shield, Plus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * NavbarV2 — Tactical Command Bar
 * Awang-style dark violet nav: solid bg, angular pills, neon underline on active,
 * wallet chip + prominent CTA. No glass blur.
 */
const NotificationBellV2 = () => {
  const { unreadCount } = useNotifications();
  return (
    <button
      onClick={() => document.dispatchEvent(new CustomEvent("toggle-notifications"))}
      className="v2-nav-icon-btn relative"
      aria-label="การแจ้งเตือน"
    >
      <Bell size={16} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-[hsl(340_85%_58%)] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[hsl(270_45%_6%)]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

const NavbarV2 = () => {
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

  useScrollLock(mobileMenuOpen);

  const currentPath = location.pathname;
  const navSocialLinks = settings.socialLinks?.filter(l => l.showOnNavbar !== false) || [];

  const navItems = [
    { path: "/", label: "หน้าหลัก", icon: Home },
    ...(user ? [{ path: "/store", label: "ร้านค้า", icon: ShoppingBag }] : []),
    ...(user ? [{ path: "/history", label: "ประวัติ", icon: History }] : []),
    ...(user ? [{ path: "/hub", label: "เมนู", icon: Compass }] : []),
  ];

  return (
    <>
      <nav
        className={`v2-navbar sticky top-0 z-50 ${scrolled ? "v2-navbar--scrolled" : ""}`}
      >
        <div className={`mx-auto flex items-center justify-between gap-4 transition-all duration-300 ${scrolled ? "h-14 max-w-6xl px-4 sm:px-6" : "h-16 max-w-[1400px] px-4 sm:px-8"}`}>
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className={`v2-nav-logo rounded-[10px] overflow-hidden transition-all duration-300 group-hover:scale-105 ${scrolled ? "w-8 h-8" : "w-10 h-10"}`}>
              <img src={settings.logoUrl || logo} alt={settings.brandName} className="w-full h-full object-contain" />
            </div>
            <span
              className={`hidden sm:block font-bold tracking-tight transition-all duration-300 ${scrolled ? "text-sm" : "text-base"}`}
              style={{ color: "hsl(272 95% 78%)", fontFamily: "'Kanit', 'Prompt', sans-serif" }}
            >
              {settings.brandName}
            </span>
          </Link>

          {/* Desktop Nav — segmented pills */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={() => prefetchRoute(item.path)}
                  className={`v2-nav-pill ${active ? "v2-nav-pill--active" : ""}`}
                >
                  <item.icon size={14} strokeWidth={2.2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right cluster */}
          <div className="hidden lg:flex items-center gap-1.5 shrink-0">
            {user && (
              <>
                <Link to="/wallet" className="v2-wallet-chip" title="Wallet">
                  <Wallet size={14} />
                  <span className="v2-wallet-amount">
                    {walletLoading ? "…" : `฿${balance.toLocaleString()}`}
                  </span>
                </Link>
                <Link to="/topup" className="v2-topup-btn" title="เติมเงิน">
                  <Plus size={14} strokeWidth={2.6} />
                  เติมเงิน
                </Link>
              </>
            )}
            {navSocialLinks.slice(0, 3).map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
                className="v2-nav-icon-btn"
              >
                {link.iconUrl ? (
                  <img src={link.iconUrl} alt={link.label} className="w-4 h-4 object-contain rounded-sm" />
                ) : (
                  <ExternalLink size={14} />
                )}
              </a>
            ))}
            <ThemeToggle />
            <NotificationBellV2 />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="v2-user-btn" aria-label="เมนูผู้ใช้">
                    <div className="v2-user-avatar">
                      <User size={13} />
                    </div>
                    <span className="text-xs font-semibold max-w-[100px] truncate" style={{ color: "hsl(270 20% 92%)" }}>
                      {profile?.displayName || "โปรไฟล์"}
                    </span>
                    <ChevronDown size={12} style={{ color: "hsl(270 30% 60%)" }} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} className="w-[280px] p-1.5">
                  <DropdownMenuLabel className="p-2 mb-1 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15">
                    <div className="flex items-center gap-2">
                      <div className="v2-user-avatar shrink-0" style={{ width: 30, height: 30, borderRadius: 8 }}>
                        <User size={13} />
                      </div>
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="text-[12.5px] font-semibold text-foreground truncate">
                          {profile?.displayName || "ผู้ใช้"}
                        </div>
                        <div className="text-[10.5px] text-muted-foreground truncate mt-0.5 font-normal">
                          {profile?.email}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild><Link to="/profile" className="flex items-center gap-2 whitespace-nowrap"><User size={14} className="shrink-0" /><span>โปรไฟล์</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/history" className="flex items-center gap-2 whitespace-nowrap"><History size={14} className="shrink-0" /><span>ประวัติ</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/wallet" className="flex items-center gap-2 whitespace-nowrap"><Wallet size={14} className="shrink-0" /><span>Wallet</span></Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/permissions" className="flex items-center gap-2 whitespace-nowrap"><Shield size={14} className="shrink-0" /><span>สิทธิ์ของฉัน</span></Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/hub" className="flex items-center gap-2 whitespace-nowrap"><Compass size={14} className="shrink-0" /><span>เมนูทั้งหมด</span></Link></DropdownMenuItem>
                  {isMod && <DropdownMenuItem asChild><Link to="/admin" className="flex items-center gap-2 whitespace-nowrap"><Settings size={14} className="shrink-0" /><span>ตั้งค่าเว็บไซต์</span></Link></DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => logout()} className="flex items-center gap-2 whitespace-nowrap text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut size={14} className="shrink-0" /><span>ออกจากระบบ</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/login" className="v2-nav-pill">
                  <LogIn size={14} /> เข้าสู่ระบบ
                </Link>
                <Link to="/login?mode=signup" className="v2-nav-cta">
                  <User size={14} /> สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex lg:hidden items-center gap-1">
            {user && (
              <Link to="/wallet" className="v2-wallet-chip !h-8 !px-2">
                <Wallet size={12} />
                <span className="text-[11px] font-bold">
                  {walletLoading ? "…" : `฿${balance.toLocaleString()}`}
                </span>
              </Link>
            )}
            <NotificationBellV2 />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="v2-nav-icon-btn"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`lg:hidden fixed inset-x-0 bottom-0 z-40 ${scrolled ? "top-14" : "top-16"}`}
              style={{ background: "hsl(270 55% 4% / 0.85)" }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className={`lg:hidden fixed inset-x-3 z-40 v2-mobile-panel p-2 max-h-[calc(100vh-5rem)] overflow-y-auto ${scrolled ? "top-[calc(3.5rem+0.5rem)]" : "top-[calc(4rem+0.5rem)]"}`}
            >
              <div className="space-y-0.5">
                {navItems.map((item) => {
                  const active = currentPath === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`v2-mobile-item ${active ? "v2-mobile-item--active" : ""}`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}

                {user && (
                  <>
                    <Link to="/topup" onClick={() => setMobileMenuOpen(false)} className="v2-mobile-item">
                      <Plus size={16} /> เติมเงิน
                    </Link>
                  </>
                )}

                <div className="v2-mobile-divider" />

                {user ? (
                  <>
                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="v2-mobile-item">
                      <User size={16} /> {profile?.displayName || "โปรไฟล์"}
                    </Link>
                    <Link to="/permissions" onClick={() => setMobileMenuOpen(false)} className="v2-mobile-item">
                      <Shield size={16} /> สิทธิ์ของฉัน
                    </Link>
                    {isMod && (
                      <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="v2-mobile-item">
                        <Settings size={16} /> ตั้งค่าเว็บไซต์
                      </Link>
                    )}
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="v2-mobile-item w-full text-left"
                      style={{ color: "hsl(0 82% 68%)" }}
                    >
                      <LogOut size={16} /> ออกจากระบบ
                    </button>
                  </>
                ) : (
                  <div className="flex gap-2 px-1 pt-1">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="v2-nav-pill flex-1 justify-center">
                      <LogIn size={14} /> เข้าสู่ระบบ
                    </Link>
                    <Link to="/login?mode=signup" onClick={() => setMobileMenuOpen(false)} className="v2-nav-cta flex-1 justify-center">
                      <User size={14} /> สมัครสมาชิก
                    </Link>
                  </div>
                )}

                {navSocialLinks.length > 0 && (
                  <>
                    <div className="v2-mobile-divider" />
                    <div className="flex flex-wrap gap-1.5 px-2 pb-1">
                      {navSocialLinks.map((link) => (
                        <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="v2-mobile-social">
                          {link.iconUrl ? (
                            <img src={link.iconUrl} alt={link.label} className="w-3.5 h-3.5 object-contain rounded-sm" />
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

export default NavbarV2;
