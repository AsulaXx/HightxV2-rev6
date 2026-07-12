import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Upload, Database, Package, Users, Receipt, Settings, CheckCircle, AlertTriangle, FileJson, FileSpreadsheet, FileText, Loader2, Shield, Clock, RefreshCw, Timer, Key as KeyIcon, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, setDoc, writeBatch, serverTimestamp, getDoc } from "firebase/firestore";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import * as XLSX from "xlsx";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";

interface AdminBackupProps {
  user: User;
  profile: UserProfile | null;
}

type CollectionKey = "users" | "keys" | "wallets" | "walletTransactions" | "topUpHistory" | "announcements" | "linkPages" | "archivedKeys" | "settings";

const COLLECTIONS: { key: CollectionKey; label: string; icon: React.ElementType; group: string }[] = [
  { key: "settings", label: "ตั้งค่าระบบ", icon: Settings, group: "ตั้งค่าระบบ" },
  { key: "announcements", label: "ประกาศ", icon: Settings, group: "ตั้งค่าระบบ" },
  { key: "linkPages", label: "ลิ้งค์รวม", icon: Settings, group: "ตั้งค่าระบบ" },
  { key: "users", label: "ผู้ใช้", icon: Users, group: "ข้อมูลผู้ใช้/ยอดเงิน" },
  { key: "wallets", label: "กระเป๋าเงิน", icon: Users, group: "ข้อมูลผู้ใช้/ยอดเงิน" },
  { key: "keys", label: "คีย์สินค้า", icon: Package, group: "ข้อมูลสินค้า/คีย์" },
  { key: "archivedKeys", label: "คีย์ที่เก็บถาวร", icon: Package, group: "ข้อมูลสินค้า/คีย์" },
  { key: "topUpHistory", label: "ประวัติเติมเงิน", icon: Receipt, group: "ประวัติธุรกรรม" },
  { key: "walletTransactions", label: "ธุรกรรมกระเป๋า", icon: Receipt, group: "ประวัติธุรกรรม" },
];

const AUTO_BACKUP_INTERVALS = [
  { value: 0, label: "ปิด" },
  { value: 6, label: "ทุก 6 ชั่วโมง" },
  { value: 12, label: "ทุก 12 ชั่วโมง" },
  { value: 24, label: "ทุกวัน" },
  { value: 72, label: "ทุก 3 วัน" },
  { value: 168, label: "ทุกสัปดาห์" },
];

const serializeFirestoreData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (data?.toDate && typeof data.toDate === "function") return { __type: "timestamp", value: data.toDate().toISOString() };
  if (Array.isArray(data)) return data.map(serializeFirestoreData);
  if (typeof data === "object") {
    const result: any = {};
    for (const [k, v] of Object.entries(data)) result[k] = serializeFirestoreData(v);
    return result;
  }
  return data;
};

const deserializeFirestoreData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (data?.__type === "timestamp" && data?.value) return new Date(data.value);
  if (Array.isArray(data)) return data.map(deserializeFirestoreData);
  if (typeof data === "object") {
    const result: any = {};
    for (const [k, v] of Object.entries(data)) result[k] = deserializeFirestoreData(v);
    return result;
  }
  return data;
};

const AdminBackup = ({ user, profile }: AdminBackupProps) => {
  const [selectedCollections, setSelectedCollections] = useState<Set<CollectionKey>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ fileName: string; collections: { name: string; count: number }[] } | null>(null);
  const [importData, setImportData] = useState<Record<string, any[]> | null>(null);
  const [confirmText, setConfirmText] = useState("");

  // Auto backup state
  const [autoBackupInterval, setAutoBackupInterval] = useState(0);
  const [autoBackupCollections, setAutoBackupCollections] = useState<Set<CollectionKey>>(new Set(COLLECTIONS.map(c => c.key)));
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [nextAutoBackup, setNextAutoBackup] = useState<string | null>(null);
  const [autoBackupRunning, setAutoBackupRunning] = useState(false);

  // Load auto backup settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "autoBackup"));
        if (snap.exists()) {
          const data = snap.data();
          setAutoBackupInterval(data.intervalHours || 0);
          setAutoBackupCollections(new Set((data.collections as CollectionKey[]) || COLLECTIONS.map(c => c.key)));
          setLastAutoBackup(data.lastBackupAt || null);
        }
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("AdminBackup.loadSettings", err, "warn"); }
    };
    loadSettings();
  }, []);

  // Auto backup timer
  useEffect(() => {
    if (autoBackupInterval <= 0) {
      setNextAutoBackup(null);
      return;
    }

    const checkAutoBackup = async () => {
      const now = Date.now();
      const lastTime = lastAutoBackup ? new Date(lastAutoBackup).getTime() : 0;
      const intervalMs = autoBackupInterval * 60 * 60 * 1000;
      const nextTime = lastTime + intervalMs;

      setNextAutoBackup(new Date(nextTime).toISOString());

      if (now >= nextTime && !autoBackupRunning) {
        await runAutoBackup();
      }
    };

    checkAutoBackup();
    const timer = setInterval(checkAutoBackup, 60000);
    return () => clearInterval(timer);
  }, [autoBackupInterval, lastAutoBackup, autoBackupRunning]);

  const saveAutoBackupSettings = async (interval: number, cols?: Set<CollectionKey>) => {
    const colsToSave = cols || autoBackupCollections;
    try {
      await setDoc(doc(db, "settings", "autoBackup"), {
        intervalHours: interval,
        collections: [...colsToSave],
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setAutoBackupInterval(interval);
      if (cols) setAutoBackupCollections(cols);
      toast.success("บันทึกตั้งค่า Auto Backup สำเร็จ");
    } catch (err) {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const runAutoBackup = async () => {
    if (autoBackupRunning) return;
    setAutoBackupRunning(true);
    try {
      const backup: Record<string, any> = {
        __meta: { exportedAt: new Date().toISOString(), exportedBy: "auto-backup", version: "1.0", type: "auto" },
      };
      for (const col of autoBackupCollections) {
        backup[col] = await fetchCollectionData(col);
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auto-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      setLastAutoBackup(now);
      await setDoc(doc(db, "settings", "autoBackup"), { lastBackupAt: now }, { merge: true });
      toast.success("Auto Backup สำเร็จ!");
      await logActivity(user, profile, "auto_backup", `Auto Backup: ${[...autoBackupCollections].join(", ")}`);
    } catch (err: any) {
      console.error("Auto backup failed:", err);
      toast.error("Auto Backup ล้มเหลว");
    } finally {
      setAutoBackupRunning(false);
    }
  };

  const toggleCollection = (key: CollectionKey) => {
    setSelectedCollections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedCollections.size === COLLECTIONS.length) {
      setSelectedCollections(new Set());
    } else {
      setSelectedCollections(new Set(COLLECTIONS.map(c => c.key)));
    }
  };

  const fetchCollectionData = async (colName: string) => {
    const snap = await getDocs(collection(db, colName));
    return snap.docs.map(d => ({ __docId: d.id, ...serializeFirestoreData(d.data()) }));
  };

  const exportJSON = async () => {
    if (selectedCollections.size === 0) { toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export"); return; }
    setExporting(true);
    try {
      const backup: Record<string, any> = { __meta: { exportedAt: new Date().toISOString(), exportedBy: user.email, version: "1.0" } };
      for (const col of selectedCollections) {
        backup[col] = await fetchCollectionData(col);
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export สำเร็จ! (${selectedCollections.size} คอลเลกชัน)`);
      await logActivity(user, profile, "backup_export", `Export JSON: ${[...selectedCollections].join(", ")}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Export ล้มเหลว: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (selectedCollections.size === 0) { toast.error("กรุณาเลือกข้อมูลที่ต้องการ Export"); return; }
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      for (const col of selectedCollections) {
        const data = await fetchCollectionData(col);
        const flatData = data.map(item => {
          const flat: any = {};
          for (const [k, v] of Object.entries(item)) {
            if (v && typeof v === "object" && (v as any).__type === "timestamp") {
              flat[k] = (v as any).value;
            } else if (typeof v === "object" && v !== null) {
              flat[k] = JSON.stringify(v);
            } else {
              flat[k] = v;
            }
          }
          return flat;
        });
        const ws = XLSX.utils.json_to_sheet(flatData);
        XLSX.utils.book_append_sheet(wb, ws, col.substring(0, 31));
      }
      XLSX.writeFile(wb, `backup-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success(`Export Excel สำเร็จ! (${selectedCollections.size} ชีท)`);
      await logActivity(user, profile, "backup_export", `Export Excel: ${[...selectedCollections].join(", ")}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Export ล้มเหลว: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) { toast.error("รองรับเฉพาะไฟล์ .json เท่านั้น"); return; }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (!data || typeof data !== "object") throw new Error("Invalid format");
        const collections: { name: string; count: number }[] = [];
        const importable: Record<string, any[]> = {};
        for (const [key, value] of Object.entries(data)) {
          if (key === "__meta") continue;
          if (Array.isArray(value)) {
            collections.push({ name: key, count: value.length });
            importable[key] = value;
          }
        }
        if (collections.length === 0) { toast.error("ไฟล์ไม่มีข้อมูลที่สามารถ Import ได้"); return; }
        setImportPreview({ fileName: file.name, collections });
        setImportData(importable);
        setConfirmText("");
      } catch {
        toast.error("ไฟล์ JSON ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const executeImport = async () => {
    if (!importData || confirmText !== "IMPORT") return;
    setImporting(true);
    try {
      let totalDocs = 0;
      for (const [colName, docs] of Object.entries(importData)) {
        const batchSize = 400;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + batchSize);
          for (const item of chunk) {
            const docId = item.__docId || item.id || Math.random().toString(36).substring(2, 14);
            const { __docId, ...rest } = item;
            const deserialized = deserializeFirestoreData(rest);
            batch.set(doc(db, colName, docId), deserialized, { merge: true });
          }
          await batch.commit();
          totalDocs += chunk.length;
        }
      }
      toast.success(`Import สำเร็จ! (${totalDocs} รายการ)`);
      await logActivity(user, profile, "backup_import", `Import ${Object.keys(importData).join(", ")} (${totalDocs} docs)`);
      setImportPreview(null);
      setImportData(null);
      setConfirmText("");
    } catch (err: any) {
      console.error(err);
      toast.error("Import ล้มเหลว: " + (err.message || "Unknown error"));
    } finally {
      setImporting(false);
    }
  };

  const groups = [...new Set(COLLECTIONS.map(c => c.group))];

  const formatTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "เมื่อสักครู่";
    if (mins < 60) return `${mins} นาทีที่แล้ว`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Database size={20} className="text-primary" /> สำรองข้อมูล (Backup)
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Export และ Import ข้อมูลระบบทั้งหมด เพื่อสำรองข้อมูลหรือย้ายระบบ</p>
      </div>

      {/* Auto Backup Section */}
      <div className="glass-card !p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Timer size={16} className="text-primary" /> Auto Backup อัตโนมัติ
        </h3>
        <p className="text-[10px] text-muted-foreground">ระบบจะสำรองข้อมูลอัตโนมัติตามเวลาที่กำหนด (ดาวน์โหลดเป็น JSON)</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AUTO_BACKUP_INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => saveAutoBackupSettings(opt.value)}
              className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                autoBackupInterval === opt.value
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card/50 border-border/30 text-muted-foreground hover:bg-muted/30"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {autoBackupInterval > 0 && (
          <div className="space-y-3">
            {/* Auto backup collection selection */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">ข้อมูลที่สำรองอัตโนมัติ</p>
              <div className="flex flex-wrap gap-1.5">
                {COLLECTIONS.map(col => {
                  const selected = autoBackupCollections.has(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => {
                        const next = new Set(autoBackupCollections);
                        next.has(col.key) ? next.delete(col.key) : next.add(col.key);
                        saveAutoBackupSettings(autoBackupInterval, next);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                        selected
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-card/50 border-border/30 text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <CheckCircle size={10} className={selected ? "text-primary" : "text-muted-foreground/30"} />
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 border border-border/30">
              <div className="flex-1 space-y-1">
                {lastAutoBackup && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <CheckCircle size={10} className="text-emerald-400" />
                    สำรองล่าสุด: {formatTimeAgo(lastAutoBackup)}
                  </p>
                )}
                {nextAutoBackup && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} className="text-primary" />
                    ครั้งถัดไป: {new Date(nextAutoBackup).toLocaleString("th-TH")}
                  </p>
                )}
              </div>
              <button
                onClick={runAutoBackup}
                disabled={autoBackupRunning}
                className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {autoBackupRunning ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                สำรองเดี๋ยวนี้
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Collection Selection */}
      <div className="glass-card !p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">เลือกข้อมูลที่ต้องการ (Manual)</h3>
          <button onClick={selectAll} className="text-xs text-primary hover:underline">
            {selectedCollections.size === COLLECTIONS.length ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
          </button>
        </div>

        {groups.map(group => (
          <div key={group}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLLECTIONS.filter(c => c.group === group).map(col => {
                const selected = selectedCollections.has(col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleCollection(col.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      selected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card/50 border-border/30 text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    <CheckCircle size={14} className={selected ? "text-primary" : "text-muted-foreground/30"} />
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Export Section */}
      <div className="glass-card !p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Download size={16} className="text-emerald-400" /> Export ข้อมูล
        </h3>
        <p className="text-[10px] text-muted-foreground">ดาวน์โหลดข้อมูลที่เลือกเป็นไฟล์สำรอง</p>
        <div className="flex gap-2">
          <button
            onClick={exportJSON}
            disabled={exporting || selectedCollections.size === 0}
            className="btn-glass px-4 py-2.5 text-xs flex items-center gap-2 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} className="text-blue-400" />}
            Export JSON
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting || selectedCollections.size === 0}
            className="btn-glass px-4 py-2.5 text-xs flex items-center gap-2 disabled:opacity-40"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} className="text-emerald-400" />}
            Export Excel
          </button>
        </div>
        {selectedCollections.size > 0 && (
          <p className="text-[10px] text-muted-foreground">
            เลือกแล้ว {selectedCollections.size} คอลเลกชัน: {[...selectedCollections].join(", ")}
          </p>
        )}
      </div>

      {/* Import Section */}
      <div className="glass-card !p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Upload size={16} className="text-orange-400" /> Import ข้อมูล
        </h3>
        <p className="text-[10px] text-muted-foreground">นำเข้าข้อมูลจากไฟล์ JSON Backup (ข้อมูลที่มี ID ซ้ำจะถูกเขียนทับ)</p>

        <div className="flex items-center gap-3">
          <label className="btn-glass px-4 py-2.5 text-xs flex items-center gap-2 cursor-pointer">
            <Upload size={14} />
            เลือกไฟล์ JSON
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>

        <AnimatePresence>
          {importPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
                <p className="text-xs font-medium text-foreground mb-2">📄 {importPreview.fileName}</p>
                <div className="space-y-1">
                  {importPreview.collections.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span className="font-mono text-foreground">{c.count.toLocaleString()} รายการ</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-destructive font-medium">คำเตือน: การ Import จะเขียนทับข้อมูลที่มี ID ซ้ำ</p>
                    <p className="text-[10px] text-muted-foreground">พิมพ์ <strong>IMPORT</strong> เพื่อยืนยัน</p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="พิมพ์ IMPORT"
                      className="input-glass w-full px-3 py-2 text-sm font-mono"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={executeImport}
                        disabled={confirmText !== "IMPORT" || importing}
                        className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 flex items-center gap-2"
                      >
                        {importing ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                        ยืนยัน Import
                      </button>
                      <button
                        onClick={() => { setImportPreview(null); setImportData(null); setConfirmText(""); }}
                        className="btn-glass px-4 py-2 text-xs"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminBackup;
