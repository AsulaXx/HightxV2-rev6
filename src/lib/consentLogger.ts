import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const getIp = async (): Promise<string> => {
  try {
    const raw = localStorage.getItem("public_ip_cache_v1");
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.ip) return p.ip;
    }
  } catch {}
  try {
    const r = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    if (r.ok) return (await r.json()).ip || "Unknown";
  } catch {}
  return "Unknown";
};

export interface ConsentLogEntry {
  userId: string;
  userEmail: string;
  type: "terms" | "privacy" | "both";
  termsVersion: number;
  privacyVersion: number;
}

export const logConsent = async (entry: ConsentLogEntry) => {
  try {
    const ip = await getIp();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    await addDoc(collection(db, "consentLogs"), {
      ...entry,
      ip,
      userAgent: ua,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to log consent:", err);
  }
};
