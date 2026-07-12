import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

/**
 * Countdown badge — shown after a rate-limited action.
 * Pass `retryAfterMs` from serverRateLimit result. Auto-hides at 0.
 */
const CooldownBadge = ({ retryAfterMs, label = "ลองใหม่ได้ใน" }: { retryAfterMs: number; label?: string }) => {
  const [remaining, setRemaining] = useState(retryAfterMs);

  useEffect(() => {
    setRemaining(retryAfterMs);
    if (retryAfterMs <= 0) return;
    const iv = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [retryAfterMs]);

  if (remaining <= 0) return null;

  const s = Math.ceil(remaining / 1000);
  const display = s < 60 ? `${s}s` : s < 3600 ? `${Math.ceil(s / 60)}m` : `${Math.ceil(s / 3600)}h`;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-400/30 text-amber-400 text-[10px] font-semibold">
      <Clock size={10} /> {label} {display}
    </span>
  );
};

export default CooldownBadge;
