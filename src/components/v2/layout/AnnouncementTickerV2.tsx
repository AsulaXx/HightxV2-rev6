import { useState, useEffect } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as fbLimit } from "firebase/firestore";
import { Zap, ChevronRight } from "lucide-react";

interface Announcement { id: string; title: string; content: string; }

/**
 * AnnouncementTickerV2 — Tactical alert bar
 * Dark bg with neon violet accent stripe, angular icon, marquee.
 */
const AnnouncementTickerV2 = () => {
  const { settings } = useSiteSettings();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), fbLimit(10));
        const snap = await getDocs(q);
        setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      } catch (err) { console.error("Ticker load error:", err); }
    })();
  }, []);

  if (settings.ticker?.enabled === false) return null;
  const selectedIds = settings.ticker?.selectedIds || [];
  const filtered = selectedIds.length > 0
    ? announcements.filter(a => selectedIds.includes(a.id))
    : announcements;
  if (filtered.length === 0) return null;

  const speed = settings.ticker?.speed || 30;
  const repeated = [...filtered, ...filtered, ...filtered, ...filtered];

  return (
    <div className="v2-ticker w-full overflow-hidden relative z-30">
      <div className="flex items-stretch">
        {/* Fixed left label */}
        <div className="v2-ticker-label shrink-0">
          <Zap size={12} strokeWidth={2.6} />
          <span>LIVE</span>
        </div>
        {/* Marquee */}
        <div className="overflow-hidden flex-1 flex items-center">
          <div
            className="inline-flex whitespace-nowrap items-center"
            style={{ animation: `ticker ${speed}s linear infinite` }}
          >
            {repeated.map((ann, i) => (
              <span key={`${ann.id}-${i}`} className="v2-ticker-item">
                <ChevronRight size={10} strokeWidth={2.6} />
                {ann.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementTickerV2;
