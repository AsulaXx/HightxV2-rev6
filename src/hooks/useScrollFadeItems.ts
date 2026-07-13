import { RefObject, useEffect } from "react";

export function useScrollFadeItems(rootRef: RefObject<HTMLElement>, deps: any[] = []) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const items = Array.from(root.querySelectorAll<HTMLElement>("[data-scroll-fade]"));
    if (!items.length) return;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    items.forEach((el, index) => {
      el.style.setProperty("--scroll-fade-delay", `${Math.min((index % 4) * 45, 135)}ms`);
      el.setAttribute("data-scroll-visible", "false");
    });

    if (reduceMotion) {
      items.forEach((el) => {
        el.setAttribute("data-scroll-visible", "true");
        el.style.setProperty("--scroll-fade-opacity", "1");
        el.style.setProperty("--scroll-fade-y", "0px");
        el.style.setProperty("--scroll-fade-scale", "1");
        el.style.setProperty("--scroll-fade-blur", "0px");
      });
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const fadeTop = 86;
      const fadeRange = 150;
      const enterStart = viewportHeight - 40;
      const enterRange = 220;

      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const entering = Math.max(0, Math.min(1, (enterStart - rect.top) / enterRange));
        const leaving = Math.max(0, Math.min(1, (rect.bottom - fadeTop) / fadeRange));
        const progress = Math.min(entering, leaving);
        const opacity = Math.max(0, Math.min(1, progress));

        el.setAttribute("data-scroll-visible", opacity > 0.04 ? "true" : "false");
        el.style.setProperty("--scroll-fade-opacity", opacity.toFixed(3));
        el.style.setProperty("--scroll-fade-y", `${((1 - opacity) * 22).toFixed(1)}px`);
        el.style.setProperty("--scroll-fade-scale", (0.985 + opacity * 0.015).toFixed(3));
        el.style.setProperty("--scroll-fade-blur", `${((1 - opacity) * 6).toFixed(1)}px`);
      });
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, deps);
}