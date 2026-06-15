import { useEffect, useRef, memo } from "react";
import { useSiteSettings, type ParticleMode } from "@/contexts/SiteSettingsContext";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

const BackgroundParticles = memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const { settings } = useSiteSettings();

  const config = settings.theme.particles;

  // Compute contrasting color from primary theme color
  const getContrastColor = (): string => {
    try {
      const primary = settings.theme.primaryColor || "234 85% 65%";
      const parts = primary.match(/[\d.]+/g);
      if (!parts || parts.length < 3) return "255, 255, 255";
      const h = (parseFloat(parts[0]) + 180) % 360; // opposite hue
      const s = parseFloat(parts[1]) / 100;
      const l = Math.min(parseFloat(parts[2]) / 100 + 0.2, 0.95); // brighter for visibility
      // HSL to RGB
      const a2 = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return Math.round(255 * (l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1)));
      };
      return `${f(0)}, ${f(8)}, ${f(4)}`;
    } catch {
      return "255, 255, 255";
    }
  };

  useEffect(() => {
    if (!config?.enabled) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mode: ParticleMode = config.mode || "default";
    const count = config.count ?? 40;
    const speed = config.speed ?? 0.5;
    const size = config.size ?? 2;
    const rawColor = config.color || "auto";
    const color = rawColor === "auto" ? getContrastColor() : rawColor;
    const maxOpacity = config.opacity ?? 0.5;
    const linked = config.linked ?? false;
    const linkDistance = config.linkDistance ?? 120;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Init particles based on mode
    particlesRef.current = Array.from({ length: count }, () => {
      const p: Particle = {
        x: Math.random() * canvas.width,
        y: mode === "snow" ? Math.random() * canvas.height - canvas.height : Math.random() * canvas.height,
        vx: 0,
        vy: 0,
        size: 0,
        opacity: 0,
        baseOpacity: 0,
        twinkleSpeed: 0.01 + Math.random() * 0.03,
        twinklePhase: Math.random() * Math.PI * 2,
      };

      switch (mode) {
        case "snow":
          p.vx = (Math.random() - 0.5) * speed * 0.5;
          p.vy = Math.random() * speed + 0.3;
          p.size = Math.random() * size + 1;
          p.opacity = Math.random() * maxOpacity * 0.7 + maxOpacity * 0.3;
          p.baseOpacity = p.opacity;
          p.y = Math.random() * canvas.height;
          break;
        case "stars":
          p.vx = 0;
          p.vy = 0;
          p.size = Math.random() * size * 0.8 + 0.3;
          p.baseOpacity = Math.random() * maxOpacity;
          p.opacity = p.baseOpacity;
          break;
        case "bubbles":
          p.vx = (Math.random() - 0.5) * speed * 0.3;
          p.vy = -(Math.random() * speed * 0.5 + 0.2);
          p.size = Math.random() * size * 2 + 1;
          p.opacity = Math.random() * maxOpacity * 0.5 + maxOpacity * 0.1;
          p.baseOpacity = p.opacity;
          p.y = Math.random() * canvas.height;
          break;
        default:
          p.vx = (Math.random() - 0.5) * speed;
          p.vy = (Math.random() - 0.5) * speed;
          p.size = Math.random() * size + 0.5;
          p.opacity = Math.random() * maxOpacity;
          p.baseOpacity = p.opacity;
          break;
      }

      return p;
    });

    let tick = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      tick++;

      for (const p of particles) {
        switch (mode) {
          case "snow":
            p.x += p.vx + Math.sin(tick * 0.01 + p.twinklePhase) * 0.3;
            p.y += p.vy;
            if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width; }
            if (p.x < -10) p.x = canvas.width + 10;
            if (p.x > canvas.width + 10) p.x = -10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
            ctx.fill();
            break;

          case "stars":
            p.opacity = p.baseOpacity * (0.4 + 0.6 * Math.abs(Math.sin(tick * p.twinkleSpeed + p.twinklePhase)));
            ctx.beginPath();
            // Draw a 4-point star
            const s = p.size;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
              const angle = (i * Math.PI) / 2;
              ctx.moveTo(0, 0);
              ctx.lineTo(Math.cos(angle) * s * 2, Math.sin(angle) * s * 2);
            }
            ctx.strokeStyle = `rgba(${color}, ${p.opacity})`;
            ctx.lineWidth = s * 0.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
            ctx.fill();
            ctx.restore();
            break;

          case "bubbles":
            p.x += p.vx + Math.sin(tick * 0.008 + p.twinklePhase) * 0.4;
            p.y += p.vy;
            if (p.y < -p.size * 2) { p.y = canvas.height + p.size * 2; p.x = Math.random() * canvas.width; }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${color}, ${p.opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Highlight
            ctx.beginPath();
            ctx.arc(p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${p.opacity * 0.8})`;
            ctx.fill();
            break;

          default:
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, ${p.opacity})`;
            ctx.fill();
            break;
        }
      }

      if (linked && mode === "default") {
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < linkDistance) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.strokeStyle = `rgba(${color}, ${(1 - dist / linkDistance) * maxOpacity * 0.4})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [config?.enabled, config?.mode, config?.count, config?.speed, config?.size, config?.color, config?.opacity, config?.linked, config?.linkDistance, settings.theme.primaryColor]);

  if (!config?.enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
});

BackgroundParticles.displayName = "BackgroundParticles";

export default BackgroundParticles;
