import { useCallback, useRef } from "react";

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Min horizontal distance (px) to trigger swipe. Default 60. */
  minDistance?: number;
  /** Max duration (ms) to count as swipe. Default 500. */
  maxDuration?: number;
}

/**
 * Lightweight touch swipe handler. Returns onTouchStart / onTouchEnd handlers
 * that detect horizontal swipes (ignoring mostly-vertical drags).
 */
export const useSwipeNavigation = ({
  onSwipeLeft,
  onSwipeRight,
  minDistance = 60,
  maxDuration = 500,
}: SwipeOptions) => {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;
      if (dt > maxDuration) return;
      if (Math.abs(dx) < minDistance) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    },
    [onSwipeLeft, onSwipeRight, minDistance, maxDuration],
  );

  return { onTouchStart, onTouchEnd };
};
