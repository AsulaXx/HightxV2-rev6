import { motion } from "framer-motion";

interface AtomLoaderProps {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}

/**
 * AtomLoader — particle-style atom spinner.
 * Nucleus + 3 orbiting electrons on tilted SVG ellipses.
 * Uses semantic tokens (primary / accent) so it adapts to theme.
 */
const AtomLoader = ({ size = 96, label, fullscreen = false }: AtomLoaderProps) => {
  const orbits = [
    { rotate: 0, color: "hsl(var(--primary))" },
    { rotate: 60, color: "hsl(var(--accent))" },
    { rotate: -60, color: "hsl(var(--primary))" },
  ];

  const spinDurations = [2.2, 1.6, 2.8];

  const node = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className="relative"
        style={{ width: size, height: size }}
        aria-label="Loading"
        role="status"
      >
        {/* Soft glow */}
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-50"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.45), transparent 65%)",
          }}
        />

        {/* Orbits */}
        {orbits.map((orbit, i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${orbit.rotate}deg)` }}
            animate={{ rotate: orbit.rotate + 360 }}
            transition={{
              duration: spinDurations[i],
              ease: "linear",
              repeat: Infinity,
            }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              <ellipse
                cx="50"
                cy="50"
                rx="46"
                ry="18"
                fill="none"
                stroke={orbit.color}
                strokeOpacity="0.35"
                strokeWidth="1.2"
              />
              {/* Electron */}
              <circle cx="96" cy="50" r="3.5" fill={orbit.color}>
                <animate
                  attributeName="r"
                  values="3.5;4.5;3.5"
                  dur="1.6s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          </motion.div>
        ))}

        {/* Nucleus */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: size * 0.18,
            height: size * 0.18,
            background:
              "radial-gradient(circle, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 0 18px hsl(var(--primary) / 0.7)",
          }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

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

  if (fullscreen) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        {node}
      </div>
    );
  }

  return node;
};

export default AtomLoader;
