import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Home, ShoppingBag, Compass, LogIn, LogOut, User, Wallet, Bell, Menu, X, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import { useNotifications } from "@/components/NotificationPanel";
import { useScrollLock } from "@/hooks/useScrollLock";
import logo from "@/assets/logo.png";

/**
 * V2 Navbar — TACTICAL: full-width hard bar, hazard stripe under,
 * mono uppercase tabs, oxide-red accents.
 */
const V2Navbar = () => {
  const location = useLocation();
  const { user, profile, logout, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const { balance } = useWallet();
  const { unreadCount } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  const isMod = !!user && hasPermission("moderator");
  const path = location.pathname;
  const links = [
    { to: "/", label: "HOME", icon: Home },
    ...(user ? [{ to: "/store", label: "STORE", icon: ShoppingBag }] : []),
    ...(user ? [{ to: "/hub", label: "TOOLS", icon: Compass }] : []),
  ];

  const brand = (settings.brandName || "STORE").toUpperCase();
  const brandHead = brand.split(" ")[0] || brand;
  const brandTail = brand.slice(brandHead.length).trim();

  return (
    <header className="v2-tac-bar sticky top-0 z-50">
      <div className="max-w-[1320px] mx-auto px-4 h-14 flex items-center gap-4">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 overflow-hidden border border-white/20" style={{ borderRadius: 2 }}>
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="v2-brand hidden sm:flex items-center gap-1">
            <span style={{ color: "hsl(var(--primary))" }}>//</span>
            {brandHead}
            {brandTail && <span className="text-white/55 ml-1 text-[12px] tracking-[0.2em]">{brandTail}</span>}
          </div>
        </Link>

        {/* Center tabs */}
        <nav className="hidden md:flex items-center h-full ml-4">
          {links.map((l) => {
            const active = path === l.to || (l.to !== "/" && path.startsWith(l.to));
            return (
              <Link key={l.to} to={l.to} data-active={active} className="v2-tab h-full">
                <l.icon size={13} />
                <span>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {user && <span className="v2-status hidden sm:inline-flex">ONLINE</span>}

          {user && (
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("toggle-notifications"))}
              className="v2-ghost relative !px-2 !py-2"
              aria-label="Notifications"
            >
              <Bell size={13} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-0.5 bg-primary text-white text-[9px] font-bold flex items-center justify-center" style={{ borderRadius: 2 }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}

          {user && (
            <Link to="/wallet" className="v2-ghost hidden sm:inline-flex">
              <Wallet size={13} />
              <span className="tabular-nums">฿{Math.round(balance ?? 0).toLocaleString()}</span>
            </Link>
          )}

          {isMod && (
            <Link to="/admin" className="v2-ghost !px-2 !py-2" aria-label="Admin">
              <Shield size={13} />
            </Link>
          )}

          {user ? (
            <>
              <Link to="/profile" className="v2-ghost">
                <User size={13} />
                <span className="hidden lg:inline truncate max-w-[110px]">
                  {(profile?.displayName || profile?.email || "USER").toUpperCase()}
                </span>
              </Link>
              <button onClick={logout} className="v2-ghost !px-2 !py-2" aria-label="Logout">
                <LogOut size={13} />
              </button>
            </>
          ) : (
            <Link to="/login" className="v2-cta">
              <LogIn size={13} /> SIGN IN
            </Link>
          )}

          <button
            className="v2-ghost md:hidden !px-2 !py-2"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={14} /> : <Menu size={14} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0a0a0a]">
          <div className="max-w-[1320px] mx-auto px-4 py-2 flex flex-col">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)} className="v2-tab justify-start w-full">
                <l.icon size={13} />
                <span>{l.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default V2Navbar;
