import { useState, useCallback } from "react";

/**
 * Hook for managing collapsible section state with localStorage persistence.
 * @param key Unique key for localStorage
 * @param defaultOpen Default open state
 * Returns [isOpen, toggle, setOpen]
 */
export function useCollapsible(key: string, defaultOpen: boolean = true): [boolean, () => void, (open: boolean) => void] {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(`hx-collapse-${key}`);
      return stored !== null ? stored === "1" : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`hx-collapse-${key}`, next ? "1" : "0"); } catch {}
      return next;
    });
  }, [key]);

  const setOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    try { localStorage.setItem(`hx-collapse-${key}`, open ? "1" : "0"); } catch {}
  }, [key]);

  return [isOpen, toggle, setOpen];
}
