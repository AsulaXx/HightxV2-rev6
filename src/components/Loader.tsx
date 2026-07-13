import { memo } from "react";
import { motion } from "framer-motion";
import { useSiteSettings, type LoaderStyle } from "@/contexts/SiteSettingsContext";
import AtomLoader from "./AtomLoader";

interface LoaderProps {
  size?: number;
  label?: string;
  fullscreen?: boolean;
  style?: LoaderStyle;
}

const Loader = memo(({ size = 96, label, fullscreen = false, style }: LoaderProps) => {
  const { settings } = useSiteSettings();
  const kind: LoaderStyle = style || settings.theme.loaderStyle || "atom";

  const wrap = (node: React.ReactNode) => {
    const inner = (
      <div className="flex flex-col items-center justify-center gap-4">
        {node}
        {label && (
          <motion.p
            className="text-xs text-muted-foreground tracking-wide"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            {label}
          </motion.p>
        )}
      </div>
    );
    return fullscreen ? <div className="min-h-[60vh] flex items-center justify-center">{inner}</div> : inner;
  };

  if (kind === "atom") return <AtomLoader size={size} label={label} fullscreen={fullscreen} />;

  if (kind === "ring") {
    return wrap(
      <div style={{ width: size, height: size }} className="relative" role="status" aria-label="Loading">
        <div className="absolute inset-0 rounded-full border-[3px] border-primary/15" />
        <motion.div
          className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-primary border-r-accent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
        />
      </div>
    );
  }

  if (kind === "dots") {
    return wrap(
      <div className="flex gap-2" style={{ height: size / 3 }} role="status" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="rounded-full bg-primary"
            style={{ width: size / 6, height: size / 6 }}
            animate={{ y: [0, -size / 5, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  if (kind === "bars") {
    return wrap(
      <div className="flex items-end gap-1.5" style={{ height: size / 2 }} role="status" aria-label="Loading">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-gradient-to-t from-primary to-accent"
            animate={{ height: [size / 6, size / 2, size / 6] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  if (kind === "pulse") {
    return wrap(
      <div className="relative" style={{ width: size, height: size }} role="status" aria-label="Loading">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{ scale: [0.4, 1.1], opacity: [0.8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
          />
        ))}
        <div className="absolute inset-1/3 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary))]" />
      </div>
    );
  }

  if (kind === "orbit") {
    return wrap(
      <div className="relative" style={{ width: size, height: size }} role="status" aria-label="Loading">
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
        >
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
        </motion.div>
        <motion.div
          className="absolute inset-2"
          animate={{ rotate: -360 }}
          transition={{ duration: 1.9, ease: "linear", repeat: Infinity }}
        >
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_hsl(var(--accent))]" />
        </motion.div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-primary to-accent" />
      </div>
    );
  }

  return <AtomLoader size={size} label={label} fullscreen={fullscreen} />;
});

Loader.displayName = "Loader";
export default Loader;
