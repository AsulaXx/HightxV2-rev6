// Feature-flag hook: gate any UI on `settings.roleFeatures[role]` (see permissionRegistry).
// Owner is always granted, so the app can never lock itself out.

import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { DEFAULT_FEATURE_MAP } from "@/lib/permissionRegistry";

/** True when the current user's role has `permId`. */
export function useHasFeature(permId: string): boolean {
  const { profile } = useAuth();
  const { settings } = useSiteSettings();
  if (!profile) return false;
  if (profile.role === "owner") return true;
  const overrides = (settings as any)?.roleFeatures?.[profile.role] as string[] | undefined;
  if (overrides && Array.isArray(overrides)) return overrides.includes(permId);
  const defaults = DEFAULT_FEATURE_MAP[permId];
  return defaults ? defaults.includes(profile.role) : false;
}

/** Returns a checker that answers many perms without re-subscribing. */
export function useFeatureChecker(): (permId: string) => boolean {
  const { profile } = useAuth();
  const { settings } = useSiteSettings();
  return (permId: string) => {
    if (!profile) return false;
    if (profile.role === "owner") return true;
    const overrides = (settings as any)?.roleFeatures?.[profile.role] as string[] | undefined;
    if (overrides && Array.isArray(overrides)) return overrides.includes(permId);
    const defaults = DEFAULT_FEATURE_MAP[permId];
    return defaults ? defaults.includes(profile.role) : false;
  };
}
