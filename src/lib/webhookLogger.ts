/**
 * Webhook send log — persistent (localStorage), keeps last 200 entries
 */

export interface WebhookLogEntry {
  id: string;
  type: string;
  url: string;
  status: "success" | "failed" | "skipped";
  httpStatus?: number;
  error?: string;
  timestamp: string;
  embedTitle?: string;
  attempts?: number;
  reason?: string; // for "skipped"
}

const STORAGE_KEY = "webhook_log_v2";
const MAX_ENTRIES = 200;

const loadLog = (): WebhookLogEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveLog = (entries: WebhookLogEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {}
};

export const addWebhookLog = (entry: Omit<WebhookLogEntry, "id" | "timestamp">) => {
  const log = loadLog();
  log.unshift({
    ...entry,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: new Date().toISOString(),
  });
  saveLog(log);
};

export const getWebhookLog = (): WebhookLogEntry[] => loadLog();

export const clearWebhookLog = () => {
  localStorage.removeItem(STORAGE_KEY);
};
