import { useCallback, useRef, useState } from "react";

/**
 * useSubmitGuard
 *
 * Prevents double-submits caused by rapid clicks.
 * - Synchronous ref guard blocks re-entrancy in the same tick (faster than setState).
 * - Optional cooldownMs adds a post-success lockout to absorb trackpad/double-tap bursts.
 *
 * Usage:
 *   const { isSubmitting, run } = useSubmitGuard();
 *   <Button disabled={isSubmitting} onClick={() => run(async () => doThing())} />
 */
export function useSubmitGuard(cooldownMs = 800) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false);
  const lastEndRef = useRef(0);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (lockRef.current) return undefined;
      if (Date.now() - lastEndRef.current < cooldownMs) return undefined;
      lockRef.current = true;
      setIsSubmitting(true);
      try {
        return await fn();
      } finally {
        lockRef.current = false;
        lastEndRef.current = Date.now();
        setIsSubmitting(false);
      }
    },
    [cooldownMs]
  );

  return { isSubmitting, run };
}
