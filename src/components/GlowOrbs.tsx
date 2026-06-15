import { motion } from "framer-motion";

const orbs = [
  {
    size: 600,
    color: "hsl(var(--glow-1))",
    initial: { x: -100, y: -200 },
    animate: {
      x: [-100, -40, -130, -100],
      y: [-200, -160, -120, -200],
      scale: [1, 1.15, 0.95, 1],
    },
    duration: 20,
  },
  {
    size: 500,
    color: "hsl(var(--glow-2))",
    initial: { x: 100, y: 150 },
    animate: {
      x: [100, 50, 140, 100],
      y: [150, 120, 180, 150],
      scale: [1, 1.1, 0.9, 1],
    },
    duration: 25,
  },
  {
    size: 350,
    color: "hsl(var(--primary))",
    initial: { x: 0, y: 0 },
    animate: {
      x: [0, 40, -30, 0],
      y: [0, -40, 30, 0],
      scale: [1, 1.3, 0.85, 1],
      opacity: [0.06, 0.1, 0.04, 0.06],
    },
    duration: 18,
  },
  {
    size: 250,
    color: "hsl(var(--accent))",
    initial: { x: -200, y: 300 },
    animate: {
      x: [-200, -150, -250, -200],
      y: [300, 250, 350, 300],
      scale: [0.8, 1.1, 0.9, 0.8],
      opacity: [0.04, 0.08, 0.03, 0.04],
    },
    duration: 22,
  },
];

const GlowOrbs = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    {orbs.map((orb, i) => (
      <motion.div
        key={i}
        initial={{
          ...orb.initial,
          opacity: i < 2 ? 0.15 : 0.06,
        }}
        animate={{
          ...orb.animate,
          opacity: orb.animate.opacity || (i < 2 ? [0.15, 0.2, 0.12, 0.15] : [0.06, 0.1, 0.04, 0.06]),
        }}
        transition={{
          duration: orb.duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute rounded-full dark:opacity-50"
        style={{
          width: orb.size,
          height: orb.size,
          background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
          filter: `blur(${80 + i * 20}px)`,
          top: i === 2 ? "50%" : i === 0 ? "0" : "auto",
          bottom: i === 1 ? "0" : i === 3 ? "10%" : "auto",
          left: i === 0 || i === 3 ? "0" : i === 2 ? "50%" : "auto",
          right: i === 1 ? "0" : "auto",
          transform: i === 2 ? "translate(-50%, -50%)" : undefined,
        }}
      />
    ))}

    {/* Floating micro particles */}
    {Array.from({ length: 6 }).map((_, i) => (
      <motion.div
        key={`particle-${i}`}
        className="absolute w-1 h-1 rounded-full bg-primary/20"
        initial={{
          x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 1200),
          y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 800),
          opacity: 0,
        }}
        animate={{
          y: [null, -100 - Math.random() * 200],
          opacity: [0, 0.4, 0],
          scale: [0.5, 1.2, 0.5],
        }}
        transition={{
          duration: 8 + Math.random() * 6,
          repeat: Infinity,
          delay: i * 2,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

export default GlowOrbs;
