import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCircle, AlertTriangle, Info, ShoppingCart, CreditCard, Shield, Megaphone, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot, doc, updateDoc, writeBatch, where, Timestamp, deleteDoc } from "firebase/firestore";
import { logError } from "@/lib/errorLogger";

export interface AppNotification {
  id: string;
  type: "success" | "warning" | "info" | "purchase" | "credit" | "security" | "announcement";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  /** Optional link to navigate to when clicked */
  link?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (type: AppNotification["type"], title: string, message: string, link?: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  /** Set the current user id — notifications are per-user */
  setUserId: (uid: string | null) => void;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  addNotification: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearAll: () => {},
  setUserId: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

/* ─────────── Provider ─────────── */

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Realtime listener on user's notifications sub-collection
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    const colRef = collection(db, "users", userId, "notifications");
    const q = query(colRef, orderBy("timestamp", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const items: AppNotification[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type ?? "info",
          title: data.title ?? "",
          message: data.message ?? "",
          timestamp: data.timestamp?.toDate?.() ?? new Date(),
          read: data.read ?? false,
          link: data.link,
        };
      });
      setNotifications(items);
    }, (err) => {
      logError("NotificationPanel.onSnapshot", err, "warn");
    });
    return () => unsub();
  }, [userId]);

  const addNotification = useCallback(
    async (type: AppNotification["type"], title: string, message: string, link?: string) => {
      if (!userId) return;
      try {
        const colRef = collection(db, "users", userId, "notifications");
        await addDoc(colRef, {
          type,
          title,
          message,
          link: link || null,
          read: false,
          timestamp: Timestamp.now(),
        });
      } catch (err) {
        logError("NotificationPanel.addNotification", err, "warn");
      }
    },
    [userId]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        const docRef = doc(db, "users", userId, "notifications", id);
        await updateDoc(docRef, { read: true });
      } catch (err) {
        logError("NotificationPanel.markAsRead", err, "warn");
      }
    },
    [userId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      notifications.filter((n) => !n.read).forEach((n) => {
        batch.update(doc(db, "users", userId, "notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      logError("NotificationPanel.markAllAsRead", err, "warn");
    }
  }, [userId, notifications]);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, "users", userId, "notifications", n.id));
      });
      await batch.commit();
    } catch (err) {
      logError("NotificationPanel.clearAll", err, "warn");
    }
  }, [userId, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll, setUserId }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

/* ─────────── UI ─────────── */

const typeConfig = {
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  purchase: { icon: ShoppingCart, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
  credit: { icon: CreditCard, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  security: { icon: Shield, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  announcement: { icon: Megaphone, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
};

const NotificationPanel = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    document.addEventListener("toggle-notifications", handler);
    return () => document.removeEventListener("toggle-notifications", handler);
  }, []);

  const formatTime = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "เมื่อสักครู่";
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
    return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  };

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[9998]"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="fixed top-16 right-4 z-[9999] w-80 max-h-[70vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Bell size={14} className="text-primary" />
                  การแจ้งเตือน
                  {unreadCount > 0 && (
                    <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <div className="flex gap-1.5 items-center">
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-[10px] text-primary hover:underline">
                      อ่านทั้งหมด
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={clearAll} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="ล้างทั้งหมด">
                      <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="ml-1 p-1 rounded hover:bg-muted/40 transition-colors">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Bell size={28} className="opacity-20 mb-2" />
                    <p className="text-xs">ไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const config = typeConfig[n.type] || typeConfig.info;
                    const Icon = config.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id);
                          if (n.link) window.location.href = n.link;
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-border/20 transition-colors ${
                          n.read ? "opacity-60" : "bg-accent/5"
                        } hover:bg-accent/10`}
                      >
                        <div className="flex gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg ${config.bg} border flex items-center justify-center shrink-0 mt-0.5`}
                          >
                            <Icon size={14} className={config.color} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-1">{formatTime(n.timestamp)}</p>
                          </div>
                          {!n.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default NotificationPanel;
