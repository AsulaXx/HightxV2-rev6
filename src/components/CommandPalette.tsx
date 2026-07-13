import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, Package, User as UserIcon, Compass, X } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, limit } from "firebase/firestore";

type Item = {
  id: string;
  label: string;
  sub?: string;
  group: "route" | "product" | "user";
  action: () => void;
};

const ROUTES: Array<{ label: string; path: string; role?: "any" | "auth" | "admin" }> = [
  { label: "หน้าแรก", path: "/" },
  { label: "ร้านค้า", path: "/store" },
  { label: "Hub", path: "/hub" },
  { label: "เติมเงิน", path: "/topup", role: "auth" },
  { label: "กระเป๋าเงิน", path: "/wallet", role: "auth" },
  { label: "ประวัติ", path: "/history", role: "auth" },
  { label: "โปรไฟล์", path: "/profile", role: "auth" },
  { label: "Dashboard", path: "/dashboard", role: "auth" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Referral", path: "/referral", role: "auth" },
  { label: "วงล้อสุ่ม", path: "/wheel" },
  { label: "Admin", path: "/admin", role: "admin" },
];

const CommandPalette = () => {
  const { settings } = useSiteSettings();
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<Array<{ uid: string; email: string; displayName?: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAdmin = hasPermission("admin");
  const enabled = settings.theme.commandPaletteEnabled !== false;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setQ("");
  }, [open]);

  useEffect(() => {
    if (!open || !isAdmin || users.length) return;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(200)));
        setUsers(snap.docs.map((d) => {
          const x = d.data() as any;
          return { uid: x.uid || d.id, email: x.email || "", displayName: x.displayName };
        }));
      } catch { /* ignore */ }
    })();
  }, [open, isAdmin, users.length]);

  const items = useMemo<Item[]>(() => {
    const results: Item[] = [];
    const term = q.trim().toLowerCase();

    ROUTES.forEach((r) => {
      if (r.role === "auth" && !user) return;
      if (r.role === "admin" && !isAdmin) return;
      if (!term || r.label.toLowerCase().includes(term) || r.path.includes(term)) {
        results.push({
          id: `r-${r.path}`,
          label: r.label,
          sub: r.path,
          group: "route",
          action: () => navigate(r.path),
        });
      }
    });

    (settings.products || []).forEach((p) => {
      if (!p.enabled) return;
      if (!term || p.name.toLowerCase().includes(term)) {
        results.push({
          id: `p-${p.id}`,
          label: p.name,
          sub: "สินค้า",
          group: "product",
          action: () => navigate(`/product/${p.id}`),
        });
      }
    });

    if (isAdmin) {
      users.forEach((u) => {
        const name = u.displayName || "";
        if (!term || u.email.toLowerCase().includes(term) || name.toLowerCase().includes(term)) {
          results.push({
            id: `u-${u.uid}`,
            label: name || u.email,
            sub: u.email,
            group: "user",
            action: () => navigate("/admin"),
          });
        }
      });
    }

    return results.slice(0, 40);
  }, [q, settings.products, users, isAdmin, user, navigate]);

  if (!enabled) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-xl glass-card !p-0 !rounded-2xl overflow-hidden shadow-2xl border border-border/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
              <Search size={16} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาสินค้า / ผู้ใช้ / หน้า..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/60"
              />
              <kbd className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">ESC</kbd>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted/40 text-muted-foreground">
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {items.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8">ไม่พบผลลัพธ์</div>
              )}
              {items.map((it) => {
                const Icon = it.group === "product" ? Package : it.group === "user" ? UserIcon : Compass;
                return (
                  <button
                    key={it.id}
                    onClick={() => { it.action(); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-primary/10 transition-colors group"
                  >
                    <Icon size={14} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{it.label}</div>
                      {it.sub && <div className="text-[11px] text-muted-foreground truncate">{it.sub}</div>}
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase opacity-0 group-hover:opacity-100">
                      {it.group}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>เปิดด้วย <kbd className="bg-muted/40 px-1 rounded">Ctrl</kbd>+<kbd className="bg-muted/40 px-1 rounded">K</kbd></span>
              <span>{items.length} ผลลัพธ์</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
