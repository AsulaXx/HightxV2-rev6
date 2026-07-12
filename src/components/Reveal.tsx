import { HTMLAttributes, forwardRef, useEffect, useRef } from "react";
import { useReveal } from "@/hooks/useReveal";

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  /** ms delay before animating in — use for stagger */
  delay?: number;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Wraps children in a div that fades + slides up on scroll into view.
 * Use `delay` (or the `<RevealGroup>` wrapper) for stagger.
 */
const Reveal = forwardRef<HTMLDivElement, RevealProps>(
  ({ delay = 0, className = "", style, children, ...rest }, forwardedRef) => {
    const localRef = useReveal<HTMLDivElement>();
    // merge external ref
    useEffect(() => {
      if (!forwardedRef || !localRef.current) return;
      if (typeof forwardedRef === "function") forwardedRef(localRef.current);
      else (forwardedRef as any).current = localRef.current;
    }, [forwardedRef, localRef]);

    return (
      <div
        ref={localRef}
        className={`reveal ${className}`}
        style={{ ["--reveal-delay" as any]: `${delay}ms`, ...style }}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
Reveal.displayName = "Reveal";

export default Reveal;

/**
 * Applies stagger to direct .reveal children by setting per-child delay.
 * Usage:
 *   <RevealGroup step={80}>
 *     <Reveal>...</Reveal>
 *     <Reveal>...</Reveal>
 *   </RevealGroup>
 */
export const RevealGroup = ({
  step = 80,
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { step?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const items = root.querySelectorAll<HTMLElement>(":scope > .reveal");
    items.forEach((el, i) => {
      el.style.setProperty("--reveal-delay", `${i * step}ms`);
    });
  }, [step, children]);
  return (
    <div ref={ref} className={className} {...rest}>
      {children}
    </div>
  );
};
