import { useEffect, useMemo, useState } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export type PerformanceMode = "auto" | "high" | "balanced" | "saver";
export type EffectivePerfMode = "high" | "balanced" | "saver";

/**
 * Detect device capability -> pick "high" / "balanced" / "saver".
 * Considers hardware cores, memory, reduced-motion, save-data, slow network, mobile UA.
 */
function detectDeviceMode(): EffectivePerfMode {
  if (typeof window === "undefined") return "high";
  try {
    const nav: any = navigator;
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory || 4;
    const conn = nav.connection || {};
    const saveData = !!conn.saveData;
    const slowNet = /(^|-)(2g|slow-2g)$/.test(String(conn.effectiveType || ""));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(nav.userAgent || "");

    if (reduce || saveData || slowNet || mem <= 2 || cores <= 2) return "saver";
    if (mobile || mem <= 4 || cores <= 4) return "balanced";
    return "high";
  } catch {
    return "high";
  }
}

export function usePerformanceMode() {
  const { settings } = useSiteSettings();
  const setting = (settings.theme.performanceMode || "auto") as PerformanceMode;

  const [detected, setDetected] = useState<EffectivePerfMode>(() => detectDeviceMode());

  useEffect(() => {
    setDetected(detectDeviceMode());
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const on = () => setDetected(detectDeviceMode());
    mq?.addEventListener?.("change", on);
    return () => mq?.removeEventListener?.("change", on);
  }, []);

  const effective: EffectivePerfMode = useMemo(() => {
    if (setting === "auto") return detected;
    return setting;
  }, [setting, detected]);

  useEffect(() => {
    document.documentElement.dataset.perfMode = effective;
  }, [effective]);

  return {
    setting,
    detected,
    mode: effective,
    isSaver: effective === "saver",
    isBalanced: effective === "balanced",
    isHigh: effective === "high",
    /** multiplier for counts/densities: saver 0, balanced 0.5, high 1 */
    factor: effective === "saver" ? 0 : effective === "balanced" ? 0.5 : 1,
  };
}
