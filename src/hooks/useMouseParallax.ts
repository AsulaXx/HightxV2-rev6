import { useEffect, useRef } from "react";

/**
 * Mouse-parallax hook. Attach the returned ref to a container element.
 * Any child with class `.parallax-layer` will move based on cursor position.
 *
 * Tune per-layer intensity with inline style: `style={{ "--depth": 30 }}`.
 * Respects prefers-reduced-motion.
 */
export function useMouseParallax<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    let px = 0;
    let py = 0;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      px = ((e.clientX - cx) / r.width) * 2; // -1..1
      py = ((e.clientY - cy) / r.height) * 2;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty("--px", String(Math.max(-1, Math.min(1, px))));
          el.style.setProperty("--py", String(Math.max(-1, Math.min(1, py))));
          raf = 0;
        });
      }
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
