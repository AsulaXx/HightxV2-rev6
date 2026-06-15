import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Get date key string (YYYY-MM-DD) in Thai timezone (Asia/Bangkok, UTC+7) */
export function toThaiDateKey(date?: Date | null): string {
  const d = date || new Date();
  // Use Intl to get Thai timezone parts
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d); // returns YYYY-MM-DD
}

/** Get a Date object representing "today" in Thai timezone at midnight */
export function thaiNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
}
