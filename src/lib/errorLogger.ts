/**
 * Centralized Error Logger
 * Replaces scattered catch {} blocks with consistent error handling
 */

type ErrorSeverity = "info" | "warn" | "error" | "critical";

interface ErrorLogEntry {
  context: string;
  message: string;
  severity: ErrorSeverity;
  timestamp: string;
  extra?: Record<string, unknown>;
}

// In-memory log buffer (last 100 errors)
const errorBuffer: ErrorLogEntry[] = [];
const MAX_BUFFER = 100;

/**
 * Log an error with context information
 */
export const logError = (
  context: string,
  error: unknown,
  severity: ErrorSeverity = "error",
  extra?: Record<string, unknown>
): string => {
  const message = error instanceof Error ? error.message : String(error);

  const entry: ErrorLogEntry = {
    context,
    message,
    severity,
    timestamp: new Date().toISOString(),
    extra,
  };

  // Always log to console
  const consoleMethod = severity === "critical" || severity === "error" ? "error" : severity === "warn" ? "warn" : "log";
  console[consoleMethod](`[${severity.toUpperCase()}] ${context}:`, message, extra || "");

  // Add to buffer
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_BUFFER) {
    errorBuffer.shift();
  }

  return message;
};

/**
 * Get recent error logs (for admin debug panel)
 */
export const getRecentErrors = (): ErrorLogEntry[] => {
  return [...errorBuffer].reverse();
};

/**
 * Clear error buffer
 */
export const clearErrorBuffer = (): void => {
  errorBuffer.length = 0;
};

/**
 * Extract error message from unknown error
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
};
