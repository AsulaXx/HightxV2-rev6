import { icons, type LucideIcon } from "lucide-react";

interface PermIconProps {
  name: string;
  size?: number;
  className?: string;
}

// Map permission icon keys to Lucide icon names
const ICON_MAP: Record<string, string> = {
  store: "ShoppingCart",
  store_reseller_price: "Gem",
  store_free_claim: "BadgeCheck",
  history: "ScrollText",
  topup: "CreditCard",
  wallet: "Wallet",
  dashboard: "LayoutDashboard",
  dashboard_recent_keys: "KeyRound",
  analytics: "TrendingUp",
  stock: "Package",
  key_management: "Key",
  link_pages: "Link",
  announcement_manage: "Megaphone",
  user_management: "Users",
  activity_log: "ClipboardList",
  all_claim_history: "FileStack",
  site_settings: "Settings",
};

const PermIcon = ({ name, size = 16, className = "" }: PermIconProps) => {
  // Try mapped name first, then direct Lucide icon name
  const lucideName = ICON_MAP[name] || name;
  const IconComponent = (icons as Record<string, LucideIcon>)[lucideName];

  if (IconComponent) {
    return <IconComponent size={size} className={className} />;
  }

  // Fallback: render as text (for legacy emoji or unknown)
  return <span className={className} style={{ fontSize: size * 0.75, lineHeight: 1 }}>{name}</span>;
};

export default PermIcon;
