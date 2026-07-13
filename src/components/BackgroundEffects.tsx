import { useEffect, useRef, memo } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";

/**
 * Non-particle background effects (grid, dots, waves, aurora, matrix).
 * Reads settings.theme.bgEffect and renders alongside BackgroundParticles.
 */
const BackgroundEffects = memo(() => {
  const { settings } = useSiteSettings();
  const { mode: perfMode } = usePerformanceMode();
  const cfg = settings.theme.bgEffect;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const getAutoColor = (): string => {
    try {
      const parts = (settings.theme.primaryColor || "234 85% 65%").match(/[\d.]+/g);
      if (!parts) return "255,255,255";
      const h = (parseFloat(parts[0]) + 180) % 360;
      const s = parseFloat(parts[1]) / 100;
      const l = Math.min(parseFloat(parts[2]) / 100 + 0.2, 0.95);
      const a2 = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
      };
      return `${f(0)},${f(8)},${f(4)}`;
    } catch { return "255,255,255"; }
  };

  const hexToRgb = (hex: string): string => {
    const m = hex.replace("#", "").match(/.{1,2}/g);
    if (!m || m.length < 3) return "255,255,255";
    return `${parseInt(m[0], 16)},${parseInt(m[1], 16)},${parseInt(m[2], 16)}`;
  };

  const effect = cfg?.effect || "none";
  const opacity = cfg?.opacity ?? 0.35;
  const perfSpeedMul = perfMode === "balanced" ? 0.6 : 1;
  const speed = (cfg?.speed ?? 1) * perfSpeedMul;
  const rawColor = cfg?.color || "auto";
  const color = !rawColor || rawColor === "auto"
    ? getAutoColor()
    : (rawColor.startsWith("#") ? hexToRgb(rawColor) : rawColor);

  useEffect(() => {
    const canvasEffects = ["waves", "matrix", "aurora", "starfield", "ripple"];
    if (!canvasEffects.includes(effect)) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    let tick = 0;
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.random() * -100);
    const chars = "アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF".split("");

    // Starfield 3D — parallax stars flying toward the viewer
    const starCount = perfMode === "saver" ? 0 : perfMode === "balanced" ? 90 : 180;
    const stars = Array.from({ length: starCount }, () => ({
      x: (Math.random() - 0.5) * canvas.width,
      y: (Math.random() - 0.5) * canvas.height,
      z: Math.random() * canvas.width,
    }));

    // Ripple pulse — expanding rings from random origins
    const ripples: { x: number; y: number; r: number; life: number }[] = [];

    const animate = () => {
      tick++;
      if (effect === "waves") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          const amp = 30 + l * 15;
          const yBase = canvas.height * (0.55 + l * 0.15);
          const wl = 200 + l * 60;
          ctx.moveTo(0, yBase);
          for (let x = 0; x <= canvas.width; x += 8) {
            const y = yBase + Math.sin((x / wl) + tick * 0.01 * speed + l) * amp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(canvas.width, canvas.height);
          ctx.lineTo(0, canvas.height);
          ctx.closePath();
          ctx.fillStyle = `rgba(${color}, ${opacity * (0.15 + l * 0.08)})`;
          ctx.fill();
        }
      } else if (effect === "matrix") {
        ctx.fillStyle = `rgba(0,0,0,${0.08 * speed})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = `rgba(${color}, ${opacity})`;
        for (let i = 0; i < drops.length; i++) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 0.5 * speed;
        }
      } else if (effect === "aurora") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const t = tick * 0.003 * speed;
        for (let i = 0; i < 3; i++) {
          const g = ctx.createRadialGradient(
            canvas.width * (0.3 + 0.4 * Math.sin(t + i)),
            canvas.height * (0.4 + 0.3 * Math.cos(t * 0.7 + i)),
            0,
            canvas.width * 0.5, canvas.height * 0.5,
            canvas.width * 0.6
          );
          g.addColorStop(0, `rgba(${color}, ${opacity * 0.6})`);
          g.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else if (effect === "starfield") {
        ctx.fillStyle = `rgba(0,0,0,${0.25})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        for (const s of stars) {
          s.z -= 2 * speed;
          if (s.z <= 1) {
            s.x = (Math.random() - 0.5) * canvas.width;
            s.y = (Math.random() - 0.5) * canvas.height;
            s.z = canvas.width;
          }
          const k = 128 / s.z;
          const sx = s.x * k + cx;
          const sy = s.y * k + cy;
          if (sx < 0 || sx >= canvas.width || sy < 0 || sy >= canvas.height) continue;
          const size = (1 - s.z / canvas.width) * 2.4;
          ctx.fillStyle = `rgba(${color}, ${opacity * (1 - s.z / canvas.width)})`;
          ctx.fillRect(sx, sy, size, size);
        }
      } else if (effect === "ripple") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (tick % Math.max(20, Math.floor(60 / speed)) === 0 && ripples.length < 6) {
          ripples.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: 0, life: 1,
          });
        }
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.r += 2.5 * speed;
          r.life -= 0.008 * speed;
          if (r.life <= 0) { ripples.splice(i, 1); continue; }
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${color}, ${opacity * r.life})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [effect, opacity, speed, color, perfMode]);

  if (!effect || effect === "none") return null;

  if (effect === "grid") {
    return (
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          opacity,
          backgroundImage: `linear-gradient(rgba(${color}, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(${color}, 0.5) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />
    );
  }
  if (effect === "dots") {
    return (
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          opacity,
          backgroundImage: `radial-gradient(rgba(${color}, 0.8) 1.5px, transparent 1.5px)`,
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 90%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
});

BackgroundEffects.displayName = "BackgroundEffects";
export default BackgroundEffects;
