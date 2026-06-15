import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, Timestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";

// Auto-cleanup: delete activity logs older than 7 days
// Runs occasionally (1 in 10 chance per log call) to avoid extra reads every time
const cleanupOldLogs = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const q = query(
      collection(db, "activityLogs"),
      where("timestamp", "<", Timestamp.fromDate(thirtyDaysAgo))
    );
    const snap = await getDocs(q);
    
    if (snap.empty) return;
    
    // Delete in batches of 50 to avoid overloading
    const batch = snap.docs.slice(0, 50);
    await Promise.all(batch.map(d => deleteDoc(doc(db, "activityLogs", d.id))));
    console.log(`Cleaned up ${batch.length} old activity logs`);
  } catch (err) {
    console.error("Activity log cleanup failed:", err);
  }
};

// Cache the public IP — in-memory + localStorage (30 minutes) to avoid hammering ipify
const IP_CACHE_MS = 30 * 60 * 1000;
const IP_STORAGE_KEY = "public_ip_cache_v1";
let cachedIp: { ip: string; at: number } | null = null;

const loadIpFromStorage = (): { ip: string; at: number } | null => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(IP_STORAGE_KEY) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.ip === "string" && typeof parsed.at === "number") return parsed;
  } catch {}
  return null;
};
const saveIpToStorage = (entry: { ip: string; at: number }) => {
  try { localStorage.setItem(IP_STORAGE_KEY, JSON.stringify(entry)); } catch {}
};

const getPublicIp = async (): Promise<string> => {
  if (cachedIp && Date.now() - cachedIp.at < IP_CACHE_MS) return cachedIp.ip;
  const stored = loadIpFromStorage();
  if (stored && Date.now() - stored.at < IP_CACHE_MS) {
    cachedIp = stored;
    return stored.ip;
  }
  const tryFetch = async (url: string, asJson: boolean): Promise<string | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return null;
      if (asJson) {
        const j = await res.json();
        return (j.ip || j.query || "").toString().trim() || null;
      }
      return (await res.text()).trim() || null;
    } catch { return null; }
  };
  const ip =
    (await tryFetch("https://api.ipify.org?format=json", true)) ||
    (await tryFetch("https://api64.ipify.org?format=json", true)) ||
    (await tryFetch("https://checkip.amazonaws.com/", false)) ||
    "Unknown";
  cachedIp = { ip, at: Date.now() };
  if (ip !== "Unknown") saveIpToStorage(cachedIp);
  return ip;
};

export const logActivity = async (
  user: User,
  profile: UserProfile | null,
  action: string,
  details: string
) => {
  try {
    const ip = await getPublicIp();
    const userAgent = typeof navigator !== "undefined" ? (navigator.userAgent || "") : "";

    // Optional PII masking — controlled by `logMaskPii` flag in siteSettings/main.
    // Always store full uid, but mask email + ip in the human-readable fields when enabled.
    let maskEnabled = false;
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "settings", "site"));
      maskEnabled = !!(snap.exists() && (snap.data() as any).logMaskPii);
    } catch { /* default false */ }

    const { maskEmail, maskIp } = await import("@/lib/webhookTemplates");
    const emailOut = maskEnabled ? maskEmail(user.email || "") : (user.email || "");
    const ipOut = maskEnabled ? maskIp(ip) : ip;

    await addDoc(collection(db, "activityLogs"), {
      action,
      userId: user.uid,
      userEmail: emailOut,
      userName: profile?.displayName || emailOut || "",
      details,
      ip: ipOut,
      userAgent,
      piiMasked: maskEnabled,
      timestamp: serverTimestamp(),
    });

    // 10% chance to trigger cleanup (reduces read usage)
    if (Math.random() < 0.1) {
      cleanupOldLogs();
    }
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

// Cleanup failed/duplicate topUpHistory older than 30 days
export const cleanupOldTopUpHistory = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const statuses = ["failed", "duplicate"];
    let totalDeleted = 0;

    for (const status of statuses) {
      const q = query(
        collection(db, "topUpHistory"),
        where("status", "==", status),
        where("createdAt", "<", Timestamp.fromDate(thirtyDaysAgo))
      );
      const snap = await getDocs(q);
      const batch = snap.docs.slice(0, 50);
      await Promise.all(batch.map(d => deleteDoc(doc(db, "topUpHistory", d.id))));
      totalDeleted += batch.length;
    }

    return totalDeleted;
  } catch (err) {
    console.error("TopUp history cleanup failed:", err);
    return 0;
  }
};
