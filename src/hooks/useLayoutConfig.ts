import { useSiteSettings, type LayoutConfig } from "@/contexts/SiteSettingsContext";

const DEFAULT_LAYOUT: LayoutConfig = {
  categoryCols: { mobile: 1, tablet: 2, desktop: 4 },
  productCols: { mobile: 1, tablet: 2, desktop: 2 },
  featuredCols: { mobile: 2, tablet: 3, desktop: 4 },
  cardStyle: "default",
  sectionSpacing: "normal",
  cardRadius: "xl",
  showProductImage: true,
  productImageRatio: "3:2",
  maxWidth: "7xl",
  hubCols: { mobile: 1, tablet: 2, desktop: 3 },
  productOptionsCollapseAfter: 4,
};

export const useLayoutConfig = () => {
  const { settings } = useSiteSettings();
  const layout = { ...DEFAULT_LAYOUT, ...(settings.layout || {}) };

  const colsToClass = (cols: { mobile: number; tablet: number; desktop: number }) => {
    return `grid-cols-${cols.mobile} sm:grid-cols-${cols.tablet} lg:grid-cols-${cols.desktop}`;
  };

  // Generate inline grid styles for dynamic columns (safer than Tailwind dynamic classes)
  const colsToStyle = (cols: { mobile: number; tablet: number; desktop: number }) => ({
    "--grid-cols-mobile": cols.mobile,
    "--grid-cols-tablet": cols.tablet,
    "--grid-cols-desktop": cols.desktop,
  } as React.CSSProperties);

  const spacingClass = () => {
    switch (layout.sectionSpacing) {
      case "compact": return "py-6";
      case "spacious": return "py-16";
      default: return "py-12";
    }
  };

  const gapClass = () => {
    switch (layout.cardStyle) {
      case "compact": return "gap-2";
      case "spacious": return "gap-5";
      default: return "gap-3";
    }
  };

  const radiusClass = () => {
    switch (layout.cardRadius) {
      case "sm": return "!rounded-lg";
      case "md": return "!rounded-xl";
      case "lg": return "!rounded-2xl";
      case "xl": return "!rounded-3xl";
      default: return "!rounded-xl";
    }
  };

  const maxWidthClass = () => {
    switch (layout.maxWidth) {
      case "4xl": return "max-w-4xl";
      case "5xl": return "max-w-5xl";
      case "6xl": return "max-w-6xl";
      case "7xl": return "max-w-7xl";
      case "full": return "max-w-full";
      default: return "max-w-6xl";
    }
  };

  const imageRatioClass = () => {
    switch (layout.productImageRatio) {
      case "1:1": return "aspect-square";
      case "4:3": return "aspect-[4/3]";
      case "3:2": return "aspect-[3/2]";
      case "16:9": return "aspect-video";
      default: return "aspect-[3/2]";
    }
  };

  const cardPaddingClass = () => {
    switch (layout.cardStyle) {
      case "compact": return "p-2.5";
      case "spacious": return "p-5";
      default: return "p-3.5";
    }
  };

  return {
    layout,
    colsToClass,
    colsToStyle,
    spacingClass,
    gapClass,
    radiusClass,
    maxWidthClass,
    imageRatioClass,
    cardPaddingClass,
  };
};
