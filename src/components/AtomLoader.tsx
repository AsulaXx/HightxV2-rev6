import { motion } from "framer-motion";

interface AtomLoaderProps {
  size?: number;
  label?: string;
  fullscreen?: boolean;
}

/**
 * AtomLoader v2 — modern particle-atom.
 * Layered rings + counter-spinning orbitals + pulsating gradient nucleus
 * with an electron trail glow. Semantic-token themed.
 */
const AtomLoader = ({ size = 96, label, fullscreen = false }: AtomLoaderProps) => {
  const rings = [
    { rotate: 0,   dur: 2.4, color: "hsl(var(--primary))",   dir: 1 },
    { rotate: 60,  dur: 1.7, color: "hsl(var(--accent))",    dir: -1 },
    { rotate: 120, dur: 3.1, color: "hsl(var(--secondary))", dir: 1 },
  ];

  const node = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role="status"
        aria-label="Loading"
      >
        {/* outer halo */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.55), hsl(var(--accent) / 0.25) 45%, transparent 70%)",
          }}
          animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* dashed field ring */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
          <motion.circle
            cx="50" cy="50" r="46"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity="0.18"
            strokeWidth="0.6"
            strokeDasharray="2 4"
            style={{ transformOrigin: "50% 50%" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 12, ease: "linear", repeat: Infinity }}
          />
        </svg>

        {/* Orbital rings */}
        {rings.map((r, i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${r.rotate}deg)`, transformStyle: "preserve-3d" }}
            animate={{ rotate: r.rotate + 360 * r.dir }}
            transition={{ duration: r.dur, ease: "linear", repeat: Infinity }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"  stopColor={r.color} stopOpacity="0" />
                  <stop offset="60%" stopColor={r.color} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={r.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <ellipse
                cx="50" cy="50" rx="46" ry="16"
                fill="none"
                stroke={r.color}
                strokeOpacity="0.32"
                strokeWidth="0.9"
              />
              {/* Glowing arc following the electron */}
              <path
                d="M 4 50 A 46 16 0 0 1 96 50"
                fill="none"
                stroke={`url(#grad-${i})`}
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.9"
              />
              {/* Electron with tail */}
              <circle cx="96" cy="50" r="3.6" fill={r.color}>
                <animate attributeName="r" values="3.2;4.4;3.2" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle cx="96" cy="50" r="7" fill={r.color} opacity="0.25">
                <animate attributeName="r" values="6;9;6" dur="1.4s" repeatCount="indefinite" />
              </circle>
            </svg>
          </motion.div>
        ))}

        {/* Nucleus */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            background:
              "radial-gradient(circle at 30% 30%, hsl(var(--accent)), hsl(var(--primary)) 60%, hsl(var(--secondary)))",
            boxShadow:
              "0 0 22px hsl(var(--primary) / 0.85), 0 0 40px hsl(var(--accent) / 0.5), inset 0 0 8px rgba(255,255,255,0.35)",
          }}
          animate={{ scale: [1, 1.18, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Inner white highlight */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: size * 0.08,
            height: size * 0.08,
            background: "radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%)",
          }}
        />
      </div>

      {label && (
        <motion.p
          className="text-xs text-muted-foreground tracking-wide font-numeric"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );

  if (fullscreen) {
    return <div className="min-h-[60vh] flex items-center justify-center">{node}</div>;
  }
  return node;
};

export default AtomLoader;
