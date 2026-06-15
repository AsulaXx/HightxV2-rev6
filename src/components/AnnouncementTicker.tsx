import { useState, useEffect } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as fbLimit } from "firebase/firestore";
import { Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
}

const AnnouncementTicker = () => {
  const { settings } = useSiteSettings();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), fbLimit(10));
        const snap = await getDocs(q);
        setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      } catch (err) {
        console.error("Ticker load error:", err);
      }
    };
    load();
  }, []);

  if (settings.ticker?.enabled === false) return null;
  
  const selectedIds = settings.ticker?.selectedIds || [];
  const filtered = selectedIds.length > 0
    ? announcements.filter(a => selectedIds.includes(a.id))
    : announcements;

  if (filtered.length === 0) return null;

  const speed = settings.ticker?.speed || 30;
  // Duplicate enough for seamless loop
  const repeated = [...filtered, ...filtered, ...filtered, ...filtered];

  return (
    <div className="ticker-bar w-full overflow-hidden relative z-30">
      <div className="flex items-center gap-3 px-4 py-2">
        <Megaphone size={12} className="text-primary shrink-0" />
        <div className="overflow-hidden flex-1">
          <div
            className="inline-flex whitespace-nowrap"
            style={{ animation: `ticker ${speed}s linear infinite` }}
          >
            {repeated.map((ann, i) => (
              <span key={`${ann.id}-${i}`} className="text-[11px] text-muted-foreground mx-6 inline-flex items-center gap-1.5">
                <Megaphone size={11} className="text-primary shrink-0" />
                {ann.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementTicker;
