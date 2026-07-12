import { useEffect, useRef } from "react";

/**
 * IntersectionObserver hook that toggles `data-visible="true"` on the element
 * when it enters the viewport. Pair with `.reveal` class in index.css.
 *
 * Respects prefers-reduced-motion: elements are shown immediately.
 */
export function useReveal<T extends HTMLElement = HTMLElement>(options?: {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const { threshold = 0.12, rootMargin = "0px 0px -8% 0px", once = true } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.setAttribute("data-visible", "true");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).setAttribute("data-visible", "true");
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            (entry.target as HTMLElement).setAttribute("data-visible", "false");
          }
        }
      },
      { threshold, rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}
