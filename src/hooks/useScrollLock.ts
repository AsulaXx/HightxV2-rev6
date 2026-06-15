import { useEffect } from "react";

/**
 * Centralized scroll lock with reference counting.
 *
 * Multiple overlays (mobile menu, cart, notification panel, sheets) may request
 * a scroll lock simultaneously. Without coordination they would clobber each
 * other's saved style state and break scroll restoration on iOS Safari.
 *
 * This module keeps a single locker active at a time:
 *  - First locker: snapshots html/body styles + current scrollY, applies lock.
 *  - Subsequent lockers: just increment the counter (no DOM writes).
 *  - Last unlocker: restores styles and scrollY synchronously to avoid flicker.
 */

type Snapshot = {
  scrollY: number;
  htmlOverflow: string;
  htmlScrollBehavior: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverscroll: string;
  bodyTouch: string;
  bodyPaddingRight: string;
};

let lockCount = 0;
let snapshot: Snapshot | null = null;

function applyLock() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const scrollbarW = window.innerWidth - html.clientWidth;

  snapshot = {
    scrollY,
    htmlOverflow: html.style.overflow,
    htmlScrollBehavior: html.style.scrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverscroll: body.style.overscrollBehavior,
    bodyTouch: (body.style as any).touchAction || "",
    bodyPaddingRight: body.style.paddingRight,
  };

  html.style.scrollBehavior = "auto";
  html.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  (body.style as any).touchAction = "none";
  if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;
}

function releaseLock() {
  if (typeof document === "undefined" || !snapshot) return;
  const html = document.documentElement;
  const body = document.body;
  const s = snapshot;

  html.style.overflow = s.htmlOverflow;
  body.style.overflow = s.bodyOverflow;
  body.style.position = s.bodyPosition;
  body.style.top = s.bodyTop;
  body.style.left = s.bodyLeft;
  body.style.right = s.bodyRight;
  body.style.width = s.bodyWidth;
  body.style.overscrollBehavior = s.bodyOverscroll;
  (body.style as any).touchAction = s.bodyTouch;
  body.style.paddingRight = s.bodyPaddingRight;

  // Restore scroll position synchronously before paint to avoid flicker
  window.scrollTo(0, s.scrollY);

  // Re-enable smooth scrolling on the next frame
  const prevBehavior = s.htmlScrollBehavior;
  requestAnimationFrame(() => {
    html.style.scrollBehavior = prevBehavior;
  });

  snapshot = null;
}

/** Imperative acquire/release for non-hook callers. Returns release fn. */
export function acquireScrollLock(): () => void {
  if (lockCount === 0) applyLock();
  lockCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
}

/** React hook: locks page scroll while `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const release = acquireScrollLock();
    return release;
  }, [active]);
}
