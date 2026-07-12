import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteSettingsProvider, useSiteSettings } from "@/contexts/SiteSettingsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CartProvider, useCart } from "@/contexts/CartContext";
import Navbar from "@/components/Navbar";
import V2Navbar from "@/components/v2/V2Navbar";
import V2Footer from "@/components/v2/V2Footer";
import AnnouncementTicker from "@/components/AnnouncementTicker";
import BackgroundParticles from "@/components/BackgroundParticles";
import GlowOrbs from "@/components/GlowOrbs";
import Footer from "@/components/Footer";
import GlobalMusicPlayer from "@/components/GlobalMusicPlayer";
import GlobalCartPanel from "@/components/GlobalCartPanel";
import NotificationPanel, { NotificationProvider, useNotifications } from "@/components/NotificationPanel";
import { useAuth } from "@/contexts/AuthContext";
import PageTransition from "@/components/PageTransition";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AnimatePresence } from "framer-motion";
import AtomLoader from "@/components/AtomLoader";


// Eagerly loaded (critical path)
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import StorePage from "./pages/StorePage";

// Lazy loaded (less frequently used)
const AdminPage = lazy(() => import("./pages/AdminPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ClaimHistoryPage = lazy(() => import("./pages/ClaimHistoryPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const StockPage = lazy(() => import("./pages/StockPage"));
const KeyManagementPage = lazy(() => import("./pages/KeyManagementPage"));
const PermissionsPage = lazy(() => import("./pages/PermissionsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ActivityLogPage = lazy(() => import("./pages/ActivityLogPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const AllClaimHistoryPage = lazy(() => import("./pages/AllClaimHistoryPage"));
const LinkTreePage = lazy(() => import("./pages/LinkTreePage"));
const LinkViewPage = lazy(() => import("./pages/LinkViewPage"));
const LinkClickAnalyticsPage = lazy(() => import("./pages/LinkClickAnalyticsPage"));
const HubPage = lazy(() => import("./pages/HubPage"));
const TopUpPage = lazy(() => import("./pages/TopUpPage"));
const WalletHistoryPage = lazy(() => import("./pages/WalletHistoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const ArchivedKeysPage = lazy(() => import("./pages/ArchivedKeysPage"));
const AllTopUpHistoryPage = lazy(() => import("./pages/AllTopUpHistoryPage"));
const CustomerBalancesPage = lazy(() => import("./pages/CustomerBalancesPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const BannedUsersPage = lazy(() => import("./pages/BannedUsersPage"));

const SetupGuidePage = lazy(() => import("./pages/SetupGuidePage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const ProductStatusPage = lazy(() => import("./pages/ProductStatusPage"));
const ReferralDashboardPage = lazy(() => import("./pages/ReferralDashboardPage"));
const ReferralLeaderboardPage = lazy(() => import("./pages/ReferralLeaderboardPage"));
const WheelPage = lazy(() => import("./pages/WheelPage"));
const WheelHubPage = lazy(() => import("./pages/WheelHubPage"));
const WheelHistoryPage = lazy(() => import("./pages/WheelHistoryPage"));
const HistoryHubPage = lazy(() => import("./pages/HistoryHubPage"));
const AdminReconcilePage = lazy(() => import("./pages/AdminReconcilePage"));
const AttemptStatusPage = lazy(() => import("./pages/AttemptStatusPage"));
const AllWheelHistoryPage = lazy(() => import("./pages/AllWheelHistoryPage"));
const AllUserHistoryPage = lazy(() => import("./pages/AllUserHistoryPage"));
const RuzienBypassPage = lazy(() => import("./pages/RuzienBypassPage"));

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const CartCleaner = () => {
  const { pathname } = useLocation();
  const { clearCart, setShowCart } = useCart();
  useEffect(() => {
    const isCartPage = pathname.startsWith("/store") || pathname.startsWith("/product/");
    if (!isCartPage) {
      clearCart();
      setShowCart(false);
    }
  }, [pathname, clearCart, setShowCart]);
  return null;
};

/** Syncs Firebase auth user ID → NotificationContext */
const NotificationAuthBridge = () => {
  const { user } = useAuth();
  const { setUserId } = useNotifications();
  useEffect(() => {
    setUserId(user?.uid ?? null);
  }, [user?.uid, setUserId]);
  return null;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const isLinkView = location.pathname.startsWith("/l/");
  const { settings } = useSiteSettings();
  const isV2 = settings.uiVersion === "v2";
  const NavComponent = isV2 ? V2Navbar : Navbar;
  const FooterComponent = isV2 ? V2Footer : Footer;
  return (
    <>
      {!isLinkView && <NavComponent />}
      
      {!isLinkView && <AnnouncementTicker />}
      <main className="flex-1">
        <Suspense fallback={<AtomLoader fullscreen label="กำลังโหลด..." />}>
        <ErrorBoundary compact resetKey={location.pathname} label={location.pathname}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><Index /></PageTransition>} />
            <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
            <Route path="/admin" element={<PageTransition><AdminPage /></PageTransition>} />
            <Route path="/dashboard" element={<PageTransition><DashboardPage /></PageTransition>} />
            <Route path="/store" element={<PageTransition><StorePage /></PageTransition>} />
            <Route path="/store/:categoryId" element={<PageTransition><StorePage /></PageTransition>} />
            <Route path="/product/:productId" element={<PageTransition><ProductDetailPage /></PageTransition>} />
            <Route path="/history" element={<PageTransition><HistoryHubPage /></PageTransition>} />
            <Route path="/history/claims" element={<PageTransition><ClaimHistoryPage /></PageTransition>} />
            <Route path="/analytics" element={<PageTransition><AnalyticsPage /></PageTransition>} />
            <Route path="/stock" element={<PageTransition><StockPage /></PageTransition>} />
            <Route path="/keys" element={<PageTransition><KeyManagementPage /></PageTransition>} />
            <Route path="/permissions" element={<PageTransition><PermissionsPage /></PageTransition>} />
            <Route path="/profile" element={<PageTransition><ProfilePage /></PageTransition>} />
            <Route path="/activity-log" element={<PageTransition><ActivityLogPage /></PageTransition>} />
            <Route path="/announcements" element={<PageTransition><AnnouncementsPage /></PageTransition>} />
            <Route path="/all-claims" element={<PageTransition><AllClaimHistoryPage /></PageTransition>} />
            <Route path="/links" element={<PageTransition><LinkTreePage /></PageTransition>} />
            <Route path="/links/analytics" element={<PageTransition><LinkClickAnalyticsPage /></PageTransition>} />
            <Route path="/l/:slug" element={<PageTransition><LinkViewPage /></PageTransition>} />
            <Route path="/hub" element={<PageTransition><HubPage /></PageTransition>} />
            <Route path="/topup" element={<PageTransition><TopUpPage /></PageTransition>} />
            <Route path="/wallet" element={<PageTransition><WalletHistoryPage /></PageTransition>} />
            <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route path="/archived-keys" element={<PageTransition><ArchivedKeysPage /></PageTransition>} />
            <Route path="/all-topup" element={<PageTransition><AllTopUpHistoryPage /></PageTransition>} />
            <Route path="/customer-balances" element={<PageTransition><CustomerBalancesPage /></PageTransition>} />
            <Route path="/leaderboard" element={<PageTransition><LeaderboardPage /></PageTransition>} />
            <Route path="/banned-users" element={<PageTransition><BannedUsersPage /></PageTransition>} />
            
            <Route path="/setup-guide" element={<PageTransition><SetupGuidePage /></PageTransition>} />
            <Route path="/status" element={<PageTransition><StatusPage /></PageTransition>} />
            <Route path="/product-status" element={<PageTransition><ProductStatusPage /></PageTransition>} />
            <Route path="/referral" element={<PageTransition><ReferralDashboardPage /></PageTransition>} />
            <Route path="/referral-leaderboard" element={<PageTransition><ReferralLeaderboardPage /></PageTransition>} />
            <Route path="/wheel" element={<PageTransition><WheelHubPage /></PageTransition>} />
            <Route path="/wheel/:slug" element={<PageTransition><WheelPage /></PageTransition>} />
            <Route path="/wheel-history" element={<PageTransition><WheelHistoryPage /></PageTransition>} />
            <Route path="/admin/reconcile" element={<PageTransition><AdminReconcilePage /></PageTransition>} />
            <Route path="/attempt-status" element={<PageTransition><AttemptStatusPage /></PageTransition>} />
            <Route path="/all-wheel" element={<PageTransition><AllWheelHistoryPage /></PageTransition>} />
            <Route path="/all-history" element={<PageTransition><AllUserHistoryPage /></PageTransition>} />
            <Route path="/Ruzien-bypass-uid" element={<PageTransition><RuzienBypassPage /></PageTransition>} />
            <Route path="/ruzien-bypass-uid" element={<PageTransition><RuzienBypassPage /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
        </ErrorBoundary>
        </Suspense>
      </main>
      {!isLinkView && <FooterComponent />}
    </>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <SiteSettingsProvider>
              <CartProvider>
              <NotificationProvider>
              <Toaster />
              <Sonner />
                <BrowserRouter>
                  <ScrollToTop />
                  <CartCleaner />
                  <NotificationAuthBridge />
                   <GlowOrbs />
                   <BackgroundParticles />
                   <div className="relative z-10 flex flex-col min-h-screen">
                     <AnimatedRoutes />
                   <GlobalMusicPlayer />
                   <GlobalCartPanel />
                   <NotificationPanel />
                 </div>
              </BrowserRouter>
              </NotificationProvider>
              </CartProvider>
            </SiteSettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
