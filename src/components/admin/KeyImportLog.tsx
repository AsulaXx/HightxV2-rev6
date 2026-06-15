import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Trash2, ArrowRightLeft, Package, Clock, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, deleteDoc, doc, writeBatch, where, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface ImportLogEntry {
  id: string;
  productId: string;
  durationId: string;
  keys?: string[]; // may be stripped after 7 days
  keyCount: number;
  importedBy: string;
  importedByEmail: string;
  importedAt: string;
  source: string;
}

interface Props {
  onKeysChanged: () => void;
}

const KeyImportLog = ({ onKeysChanged }: Props) => {
  const { settings } = useSiteSettings();
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [movingLogId, setMovingLogId] = useState<string | null>(null);
  const [moveProductId, setMoveProductId] = useState("");
  const [moveDurationId, setMoveDurationId] = useState("");

  const products = settings.products || [];

  const cleanupOldLogs = async (allLogs: ImportLogEntry[]) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const log of allLogs) {
      if (log.keys && log.keys.length > 0) {
        const logTime = new Date(log.importedAt).getTime();
        if (logTime < cutoff) {
          try {
            await updateDoc(doc(db, "keyImportLogs", log.id), { keys: [] });
            log.keys = [];
          } catch (e) {
            console.error("Cleanup log failed:", e);
          }
        }
      }
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "keyImportLogs"), orderBy("importedAt", "desc"));
      const snap = await getDocs(q);
      const allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportLogEntry));
      // Auto-cleanup: strip keys from logs older than 7 days
      await cleanupOldLogs(allLogs);
      setLogs(allLogs);
    } catch (err) {
      console.error("Failed to load import logs:", err);
    }
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const getProductName = (pid: string) => products.find(p => p.id === pid)?.name || pid;
  const getDurationLabel = (pid: string, did: string) => {
    const p = products.find(p => p.id === pid);
    return p?.durations.find(d => d.id === did)?.label || did;
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString("th-TH");

  const sourceLabels: Record<string, string> = {
    manual: "เพิ่มทีละตัว",
    bulk: "เพิ่มหลายตัว",
    csv: "Import CSV",
    excel: "Import Excel",
  };

  const toggleLog = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const hasKeys = (log: ImportLogEntry) => log.keys && log.keys.length > 0;

  const handleDeleteBatch = async (log: ImportLogEntry) => {
    if (!hasKeys(log)) {
      // No keys data, just delete the log
      if (!confirm("ข้อมูลคีย์ถูกลบอัตโนมัติแล้ว (เกิน 7 วัน) ต้องการลบ log นี้?")) return;
      await deleteDoc(doc(db, "keyImportLogs", log.id));
      toast.success("ลบ log สำเร็จ");
      loadLogs();
      return;
    }

    if (!confirm(`ต้องการลบคีย์ที่เติมรอบนี้ทั้งหมด ${log.keyCount} คีย์? (เฉพาะคีย์ที่ยังไม่ถูกกด)`)) return;

    try {
      let deleted = 0;
      for (const keyVal of log.keys!) {
        const q = query(collection(db, "keys"), where("key", "==", keyVal), where("claimed", "==", false));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.docs.forEach(d => { batch.delete(d.ref); deleted++; });
        if (snap.docs.length > 0) await batch.commit();
      }
      await deleteDoc(doc(db, "keyImportLogs", log.id));
      toast.success(`ลบ ${deleted} คีย์สำเร็จ (ข้าม ${log.keyCount - deleted} คีย์ที่ถูกกดแล้ว)`);
      loadLogs();
      onKeysChanged();
    } catch (err) {
      console.error("Delete batch failed:", err);
      toast.error("ลบล้มเหลว");
    }
  };

  const handleMoveBatch = async (log: ImportLogEntry) => {
    if (!moveProductId || !moveDurationId) { toast.error("กรุณาเลือกสินค้าและตัวเลือกปลายทาง"); return; }
    if (moveProductId === log.productId && moveDurationId === log.durationId) { toast.error("สินค้าปลายทางเหมือนเดิม"); return; }
    if (!hasKeys(log)) { toast.error("ข้อมูลคีย์ถูกลบอัตโนมัติแล้ว (เกิน 7 วัน) ไม่สามารถย้ายได้"); return; }
    if (!confirm(`ย้ายคีย์ ${log.keyCount} คีย์ไปยัง ${getProductName(moveProductId)} - ${getDurationLabel(moveProductId, moveDurationId)}?`)) return;

    try {
      let moved = 0;
      for (const keyVal of log.keys!) {
        const q = query(collection(db, "keys"), where("key", "==", keyVal), where("claimed", "==", false));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(d.ref, { productId: moveProductId, durationId: moveDurationId });
          moved++;
        }
      }
      await updateDoc(doc(db, "keyImportLogs", log.id), { productId: moveProductId, durationId: moveDurationId });
      toast.success(`ย้าย ${moved} คีย์สำเร็จ`);
      setMovingLogId(null);
      setMoveProductId("");
      setMoveDurationId("");
      loadLogs();
      onKeysChanged();
    } catch (err) {
      console.error("Move batch failed:", err);
      toast.error("ย้ายล้มเหลว");
    }
  };

  const moveProductDurations = products.find(p => p.id === moveProductId)?.durations || [];

  const isExpired = (log: ImportLogEntry) => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(log.importedAt).getTime() < cutoff;
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">💡 ระบบจะลบรายละเอียดคีย์อัตโนมัติหลัง 7 วัน เพื่อประหยัดพื้นที่ (ยังเก็บสรุปจำนวนไว้)</p>
        <button onClick={(e) => { e.stopPropagation(); loadLogs(); }} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">กำลังโหลด...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีประวัติการเติมคีย์</p>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id);
            const isMoving = movingLogId === log.id;
            const expired = isExpired(log);

            return (
              <div key={log.id} className="rounded-xl border border-border bg-muted/10 overflow-hidden">
                <button onClick={() => toggleLog(log.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        รอบที่ {logs.length - logs.indexOf(log)}
                      </span>
                      <span className="badge-primary text-[10px] flex items-center gap-0.5">
                        <Package size={8} /> {getProductName(log.productId)}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock size={8} /> {getDurationLabel(log.productId, log.durationId)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {log.keyCount} คีย์
                      </span>
                      {expired && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground">
                          สรุปเท่านั้น
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{formatDate(log.importedAt)}</span>
                      <span>•</span>
                      <span>{log.importedByEmail}</span>
                      <span>•</span>
                      <span>{sourceLabels[log.source] || log.source}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      {hasKeys(log) && (
                        <button
                          onClick={() => {
                            if (isMoving) setMovingLogId(null);
                            else { setMovingLogId(log.id); setMoveProductId(""); setMoveDurationId(""); }
                          }}
                          className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1"
                        >
                          <ArrowRightLeft size={12} /> {isMoving ? "ยกเลิกย้าย" : "ย้ายสินค้า"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBatch(log)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={12} /> {hasKeys(log) ? "ลบรอบนี้" : "ลบ log"}
                      </button>
                    </div>

                    {isMoving && hasKeys(log) && (
                      <div className="p-3 rounded-lg bg-muted/20 border border-border space-y-2">
                        <p className="text-xs font-semibold text-foreground">ย้ายคีย์ไปยัง:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <select value={moveProductId} onChange={(e) => { setMoveProductId(e.target.value); setMoveDurationId(""); }} className="input-glass px-3 py-2 text-sm">
                            <option value="">-- เลือกสินค้า --</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={moveDurationId} onChange={(e) => setMoveDurationId(e.target.value)} className="input-glass px-3 py-2 text-sm" disabled={!moveProductId}>
                            <option value="">-- เลือกตัวเลือก --</option>
                            {moveProductDurations.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                        </div>
                        <button onClick={() => handleMoveBatch(log)} disabled={!moveProductId || !moveDurationId} className="btn-gradient px-4 py-2 text-xs disabled:opacity-50">
                          ยืนยันย้าย
                        </button>
                      </div>
                    )}

                    {hasKeys(log) ? (
                      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                        {log.keys!.slice(0, 50).map((k, i) => (
                          <code key={i} className="block text-[10px] font-mono text-muted-foreground truncate">{k}</code>
                        ))}
                        {log.keys!.length > 50 && (
                          <p className="text-[10px] text-muted-foreground">...และอีก {log.keys!.length - 50} คีย์</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground py-2">📋 รายละเอียดคีย์ถูกลบอัตโนมัติแล้ว (เกิน 7 วัน) — เหลือเฉพาะสรุปจำนวน {log.keyCount} คีย์</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default KeyImportLog;
