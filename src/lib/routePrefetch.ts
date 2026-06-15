/**
 * Route prefetch helpers — lazily kick off the dynamic import for a route's
 * chunk on hover/focus so the first click feels instant.
 *
 * Each entry mirrors the lazy() import in App.tsx. Calling a prefetcher
 * starts the network fetch but does NOT mount the component.
 */
const prefetchers: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Index"),
  "/store": () => import("@/pages/StorePage"),
  "/history": () => import("@/pages/HistoryHubPage"),
  "/history/claims": () => import("@/pages/ClaimHistoryPage"),
  "/hub": () => import("@/pages/HubPage"),
  "/topup": () => import("@/pages/TopUpPage"),
  "/wallet": () => import("@/pages/WalletHistoryPage"),
  "/profile": () => import("@/pages/ProfilePage"),
  "/login": () => import("@/pages/LoginPage"),
  "/dashboard": () => import("@/pages/DashboardPage"),
  "/admin": () => import("@/pages/AdminPage"),
  "/leaderboard": () => import("@/pages/LeaderboardPage"),
  "/wheel": () => import("@/pages/WheelHubPage"),
  "/wheel-history": () => import("@/pages/WheelHistoryPage"),
  "/announcements": () => import("@/pages/AnnouncementsPage"),
  "/terms": () => import("@/pages/TermsPage"),
  "/referral": () => import("@/pages/ReferralDashboardPage"),
};

const seen = new Set<string>();

export function prefetchRoute(path: string) {
  // Match dynamic prefixes (e.g. /store/:cat → /store)
  const key = prefetchers[path]
    ? path
    : Object.keys(prefetchers).find((k) => path.startsWith(k + "/"));
  if (!key || seen.has(key)) return;
  seen.add(key);
  // Fire & forget; swallow errors silently (will surface on real navigation)
  prefetchers[key]().catch(() => seen.delete(key));
}
