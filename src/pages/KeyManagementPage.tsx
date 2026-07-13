import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { KeyRound, RefreshCw, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, Upload, Download, ChevronDown, ChevronUp, FileUp, FileSpreadsheet, Search, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, where, writeBatch, addDoc } from "firebase/firestore";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import KeyImportLog from "@/components/admin/catalog/KeyImportLog";
import { sendWebhook } from "@/lib/webhookSender";
import { keyStockActivityEmbed, keyImportEmbed, keyDeleteEmbed } from "@/lib/webhookTemplates";

interface KeyRecord {
  id: string;
  key: string;
  productId: string;
  durationId: string;
  claimed: boolean;
  claimedBy?: string;
  claimedByEmail?: string;
  claimedAt?: any;
  createdAt?: string;
}

const KeyManagementPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterDuration, setFilterDuration] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "claimed" | "orphan">("all");

  const [addProduct, setAddProduct] = useState("");
  const [addDuration, setAddDuration] = useState("");
  const [singleKey, setSingleKey] = useState("");
  const [bulkKeys, setBulkKeys] = useState("");
  const [bulkDelimiter, setBulkDelimiter] = useState<"newline" | "comma" | "semicolon" | "pipe" | "space" | "tab" | "auto">("auto");
  const [addMode, setAddMode] = useState<"single" | "bulk">("single");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showAddSection] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [importSource, setImportSource] = useState<"manual" | "bulk" | "csv" | "excel">("manual");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; description: string; onConfirm: () => void }>({ open: false, title: "", description: "", onConfirm: () => {} });
  const [displayLimit, setDisplayLimit] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const products = settings.products || [];

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "keys"));
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as KeyRecord));
      setKeys(data);
    } catch (err) {
      console.error("Failed to load keys:", err);
      toast.error("ไม่สามารถโหลดคีย์ได้");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && hasPermission("moderator")) loadKeys();
  }, [user, hasPermission, loadKeys]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!hasPermission("moderator")) return <Navigate to="/" replace />;

  const getProductName = (pid: string) => products.find((p) => p.id === pid)?.name || pid || "ไม่ระบุ";
  const getDurationLabel = (pid: string, did: string) => {
    const p = products.find((p) => p.id === pid);
    return p?.durations.find((d) => d.id === did)?.label || did || "ไม่ระบุ";
  };

  const isOrphanKey = (k: KeyRecord) => {
    const product = products.find(p => p.id === k.productId);
    if (!product) return true;
    const duration = product.durations.find(d => d.id === k.durationId);
    return !duration;
  };

  const filteredKeys = keys.filter((k) => {
    if (filterProduct && k.productId !== filterProduct) return false;
    if (filterDuration && k.durationId !== filterDuration) return false;
    if (filterStatus === "available" && k.claimed) return false;
    if (filterStatus === "claimed" && !k.claimed) return false;
    if (filterStatus === "orphan" && !isOrphanKey(k)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchKey = k.key.toLowerCase().includes(q);
      const matchEmail = k.claimedByEmail?.toLowerCase().includes(q);
      const matchProduct = getProductName(k.productId).toLowerCase().includes(q);
      const matchDuration = getDurationLabel(k.productId, k.durationId).toLowerCase().includes(q);
      if (!matchKey && !matchEmail && !matchProduct && !matchDuration) return false;
    }
    return true;
  }).sort((a, b) => {
    // Unclaimed first, then claimed
    if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
    // Within same status, sort by createdAt ascending (oldest first)
    const aTime = a.createdAt || "";
    const bTime = b.createdAt || "";
    return aTime.localeCompare(bTime);
  });

  const totalKeys = keys.length;
  const availableKeys = keys.filter((k) => !k.claimed).length;
  const claimedCount = keys.filter((k) => k.claimed).length;

  const lowStockProducts: { product: string; duration: string; available: number }[] = [];
  for (const product of products) {
    for (const dur of product.durations) {
      const avail = keys.filter((k) => k.productId === product.id && k.durationId === dur.id && !k.claimed).length;
      if (avail <= (settings.lowStockThreshold || 5)) {
        lowStockProducts.push({ product: product.name, duration: dur.label, available: avail });
      }
    }
  }

  const addKeysToFirestore = async (keysToAdd: string[], productId: string, durationId: string) => {
    const existingKeySet = new Set(keys.map((k) => k.key));
    const duplicates = keysToAdd.filter((k) => existingKeySet.has(k));
    const newKeys = keysToAdd.filter((k) => !existingKeySet.has(k));

    if (newKeys.length === 0) {
      toast.error("คีย์ทั้งหมดซ้ำกับที่มีอยู่แล้ว");
      return;
    }

    setAdding(true);
    try {
      const chunks = [];
      for (let i = 0; i < newKeys.length; i += 450) {
        chunks.push(newKeys.slice(i, i + 450));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const keyVal of chunk) {
          const ref = doc(collection(db, "keys"));
          batch.set(ref, {
            key: keyVal,
            productId,
            durationId,
            claimed: false,
            createdAt: new Date().toISOString(),
          });
        }
        await batch.commit();
      }

      toast.success(`เพิ่ม ${newKeys.length} คีย์สำเร็จ${duplicates.length > 0 ? ` (ข้าม ${duplicates.length} คีย์ซ้ำ)` : ""}`);

      // Log the import batch
      try {
        await addDoc(collection(db, "keyImportLogs"), {
          productId,
          durationId,
          keys: newKeys,
          keyCount: newKeys.length,
          importedBy: user?.uid || "",
          importedByEmail: user?.email || profile?.email || "",
          importedAt: new Date().toISOString(),
          source: importSource,
        });
      } catch (logErr) {
        console.error("Failed to log import:", logErr);
      }

      // Notify webhook (key stock added)
      sendWebhook(settings, "keyImport", [keyImportEmbed({
        actorDisplay: `${profile?.displayName || profile?.email || "Admin"} (${user?.email || "-"})`,
        actorRole: profile?.role || "admin",
        productName: getProductName(productId),
        durationLabel: getDurationLabel(productId, durationId),
        count: newKeys.length,
        duplicateCount: duplicates.length,
        source: importSource,
        sampleKeys: newKeys.slice(0, 5),
        brandName: settings.brandName,
      })], { dedupeKey: `keyImport:${productId}:${durationId}:${Date.now()}` }).catch(() => {});

      setSingleKey("");
      setBulkKeys("");
      setImportSource("manual");
      loadKeys();
    } catch (err: any) {
      console.error("Failed to add keys:", err);
      if (err?.code === "permission-denied") {
        toast.error("ไม่มีสิทธิ์เพิ่มคีย์ใน Firestore Rules");
      } else {
        toast.error("เกิดข้อผิดพลาดในการเพิ่มคีย์: " + (err?.message || "Unknown error"));
      }
    }
    setAdding(false);
  };

  const parseBulkKeys = (text: string, delimiter: string): string[] => {
    if (delimiter === "auto") {
      // Auto-detect: try each delimiter and use the one that gives most results
      const delimiters: { sep: RegExp; name: string }[] = [
        { sep: /\n/, name: "newline" },
        { sep: /,/, name: "comma" },
        { sep: /;/, name: "semicolon" },
        { sep: /\|/, name: "pipe" },
        { sep: /\t/, name: "tab" },
      ];
      let bestResult: string[] = [];
      for (const d of delimiters) {
        const result = text.split(d.sep).map(s => s.trim()).filter(Boolean);
        if (result.length > bestResult.length) bestResult = result;
      }
      return bestResult.length > 0 ? bestResult : [text.trim()].filter(Boolean);
    }
    const sepMap: Record<string, RegExp> = {
      newline: /\n/,
      comma: /,/,
      semicolon: /;/,
      pipe: /\|/,
      space: /\s+/,
      tab: /\t/,
    };
    return text.split(sepMap[delimiter] || /\n/).map(s => s.trim()).filter(Boolean);
  };

  const handleAddKeys = async () => {
    if (!addProduct || !addDuration) {
      toast.error("กรุณาเลือกสินค้าและระยะเวลา");
      return;
    }

    const keysToAdd: string[] = [];
    if (addMode === "single") {
      if (!singleKey.trim()) { toast.error("กรุณากรอกคีย์"); return; }
      keysToAdd.push(singleKey.trim());
    } else {
      const parsed = parseBulkKeys(bulkKeys, bulkDelimiter);
      if (parsed.length === 0) { toast.error("กรุณาวางคีย์อย่างน้อย 1 ตัว"); return; }
      keysToAdd.push(...parsed);
    }

    const productName = getProductName(addProduct);
    const durationLabel = getDurationLabel(addProduct, addDuration);
    setConfirmDialog({
      open: true,
      title: "ยืนยันเพิ่มคีย์",
      description: `เพิ่ม ${keysToAdd.length} คีย์ ไปยัง "${productName} - ${durationLabel}"?`,
      onConfirm: async () => {
        setImportSource(addMode === "single" ? "manual" : "bulk");
        await addKeysToFirestore(keysToAdd, addProduct, addDuration);
      },
    });
  };

  // Proper CSV parser that handles quoted fields with commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  const findProductByName = (name: string): string | undefined => {
    return (settings.products || []).find((p) => p.name === name)?.id;
  };

  const findDurationByLabel = (productId: string, label: string): string | undefined => {
    const product = (settings.products || []).find((p) => p.id === productId);
    return product?.durations.find((d) => d.label === label)?.id;
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        setImportSource("csv");
        const text = event.target?.result as string;
      if (!text) { toast.error("ไม่สามารถอ่านไฟล์ได้"); return; }

      const cleanText = text.replace(/^\uFEFF/, "");
      const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error("ไฟล์ CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (ไม่นับ header)"); return; }

      const headerCols = parseCSVLine(lines[0]);
      const headerLower = headerCols.map((h) => h.toLowerCase());
      const hasHeader = headerLower.some((h) => h.includes("key") || h.includes("คีย์") || h.includes("product") || h.includes("สินค้า"));
      const dataLines = hasHeader ? lines.slice(1) : lines;

      // Detect our export format (Thai headers)
      const isExportFormat = headerLower.some((h) => h.includes("สินค้า") || h.includes("ระยะเวลา"));

      const parsedKeys: { key: string; productId?: string; durationId?: string }[] = [];

      for (const line of dataLines) {
        const cols = parseCSVLine(line);
        if (cols.length === 0 || !cols[0]) continue;

        if (isExportFormat && cols.length >= 3) {
          const key = cols[0];
          const productId = findProductByName(cols[1]);
          if (productId) {
            const durationId = findDurationByLabel(productId, cols[2]);
            parsedKeys.push({ key, productId, durationId });
          } else {
            parsedKeys.push({ key });
          }
        } else if (cols.length >= 3) {
          parsedKeys.push({ key: cols[0], productId: cols[1] || undefined, durationId: cols[2] || undefined });
        } else {
          parsedKeys.push({ key: cols[0] });
        }
      }

      if (parsedKeys.length === 0) {
        toast.error("ไม่พบข้อมูลคีย์ในไฟล์");
        return;
      }

      const hasProductInfo = parsedKeys.some((k) => k.productId && k.durationId);

      if (hasProductInfo) {
        const groups: Record<string, string[]> = {};
        const noGroup: string[] = [];
        for (const pk of parsedKeys) {
          if (pk.productId && pk.durationId) {
            const gk = `${pk.productId}__${pk.durationId}`;
            if (!groups[gk]) groups[gk] = [];
            groups[gk].push(pk.key);
          } else {
            noGroup.push(pk.key);
          }
        }

        const addAll = async () => {
          setAdding(true);
          for (const [gk, gKeys] of Object.entries(groups)) {
            const [pid, did] = gk.split("__");
            await addKeysToFirestore(gKeys, pid, did);
          }
          if (noGroup.length > 0) {
            if (addProduct && addDuration) {
              await addKeysToFirestore(noGroup, addProduct, addDuration);
            } else {
              toast.warning(`${noGroup.length} คีย์ไม่พบสินค้าที่ตรงกัน กรุณาเลือกสินค้าแล้ว Import ใหม่`);
            }
          }
          setAdding(false);
        };
        addAll();
      } else {
        if (!addProduct || !addDuration) {
          toast.error("CSV ไม่มีข้อมูลสินค้า กรุณาเลือกสินค้าและระยะเวลาก่อน Import");
          return;
        }
        const keyStrings = parsedKeys.map((k) => k.key);
        addKeysToFirestore(keyStrings, addProduct, addDuration);
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleDeleteKey = async (keyId: string) => {
    setConfirmDialog({
      open: true,
      title: "ลบคีย์",
      description: "ต้องการลบคีย์นี้?",
      onConfirm: async () => {
        try {
          const target = keys.find(k => k.id === keyId);
          await deleteDoc(doc(db, "keys", keyId));
          toast.success("ลบคีย์สำเร็จ");
          setKeys((prev) => prev.filter((k) => k.id !== keyId));
          // Notify webhook (key removed from stock by admin)
          if (target) {
            sendWebhook(settings, "keyDelete", [keyDeleteEmbed({
              mode: "single",
              actorDisplay: `${profile?.displayName || profile?.email || "Admin"} (${user?.email || "-"})`,
              actorRole: profile?.role || "admin",
              productName: getProductName(target.productId),
              durationLabel: getDurationLabel(target.productId, target.durationId),
              count: 1,
              sampleKeys: [target.key],
              reason: target.claimed ? "ลบคีย์ที่ถูกกดแล้ว" : "ลบคีย์ที่ยังว่าง",
              brandName: settings.brandName,
            })], { dedupeKey: `keyDel:${keyId}` }).catch(() => {});
          }
        } catch (err) {
          toast.error("ไม่สามารถลบคีย์ได้");
        }
      },
    });
  };

  const handleBulkDelete = async (mode: "claimed" | "filtered") => {
    const targetKeys = mode === "claimed"
      ? filteredKeys.filter(k => k.claimed)
      : filteredKeys;

    if (targetKeys.length === 0) {
      toast.error("ไม่มีคีย์ที่จะลบ");
      return;
    }

    const label = mode === "claimed" ? "คีย์ที่ถูกกดแล้ว" : "คีย์ที่แสดงอยู่";
    setConfirmDialog({
      open: true,
      title: "ลบคีย์จำนวนมาก",
      description: `ต้องการลบ ${label} ทั้งหมด ${targetKeys.length} รายการ? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      onConfirm: async () => {
        setDeleting(true);
        try {
          const chunks = [];
          for (let i = 0; i < targetKeys.length; i += 450) {
            chunks.push(targetKeys.slice(i, i + 450));
          }
          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach(k => batch.delete(doc(db, "keys", k.id)));
            await batch.commit();
          }
          toast.success(`ลบ ${targetKeys.length} คีย์สำเร็จ`);
          const deletedIds = new Set(targetKeys.map(k => k.id));
          setKeys(prev => prev.filter(k => !deletedIds.has(k.id)));
          // Notify webhook (bulk removal from stock)
          const sampleKeys = targetKeys.slice(0, 10).map(k => k.key);
          const productCounts = new Map<string, number>();
          targetKeys.forEach(k => {
            const name = `${getProductName(k.productId)} — ${getDurationLabel(k.productId, k.durationId)}`;
            productCounts.set(name, (productCounts.get(name) || 0) + 1);
          });
          const breakdown = [...productCounts.entries()]
            .sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([name, n]) => `• ${name} ×${n}`).join("\n");
          sendWebhook(settings, "keyDelete", [keyDeleteEmbed({
            mode: "bulk",
            actorDisplay: `${profile?.displayName || profile?.email || "Admin"} (${user?.email || "-"})`,
            actorRole: profile?.role || "admin",
            count: targetKeys.length,
            sampleKeys,
            reason: `โหมด: ${mode === "claimed" ? "ลบคีย์ที่ถูกกดแล้ว" : "ลบคีย์ที่กรองอยู่"}\n${breakdown}`,
            brandName: settings.brandName,
          })], { dedupeKey: `keyBulkDel:${Date.now()}:${targetKeys.length}` }).catch(() => {});
        } catch (err) {
          console.error("Bulk delete failed:", err);
          toast.error("เกิดข้อผิดพลาดในการลบ");
        }
        setDeleting(false);
      },
    });
  };



  const handleExportCSV = () => {
    if (filteredKeys.length === 0) {
      toast.error("ไม่มีข้อมูลให้ Export");
      return;
    }

    const headers = ["คีย์", "สินค้า", "ระยะเวลา", "สถานะ", "กดโดย", "อีเมล", "วันที่เพิ่ม", "วันที่กด"];
    const rows = filteredKeys.map(k => [
      k.key,
      getProductName(k.productId),
      getDurationLabel(k.productId, k.durationId),
      k.claimed ? "กดแล้ว" : "ว่าง",
      k.claimedBy || "",
      k.claimedByEmail || "",
      k.createdAt || "",
      k.claimedAt?.toDate?.()?.toISOString() || k.claimedAt || "",
    ]);

    const csvContent = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keys_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export ${filteredKeys.length} คีย์สำเร็จ`);
  };

  const handleExportExcel = () => {
    if (filteredKeys.length === 0) {
      toast.error("ไม่มีข้อมูลให้ Export");
      return;
    }

    const data = filteredKeys.map(k => ({
      "คีย์": k.key,
      "สินค้า": getProductName(k.productId),
      "ระยะเวลา": getDurationLabel(k.productId, k.durationId),
      "สถานะ": k.claimed ? "กดแล้ว" : "ว่าง",
      "กดโดย": k.claimedBy || "",
      "อีเมล": k.claimedByEmail || "",
      "วันที่เพิ่ม": k.createdAt || "",
      "วันที่กด": k.claimedAt?.toDate?.()?.toISOString() || k.claimedAt || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Keys");
    XLSX.writeFile(wb, `keys_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Export ${filteredKeys.length} คีย์เป็น Excel สำเร็จ`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setImportSource("excel");
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          toast.error("ไม่พบข้อมูลในไฟล์ Excel");
          return;
        }

        const parsedKeys: { key: string; productId?: string; durationId?: string }[] = [];

        for (const row of rows) {
          const key = row["คีย์"] || row["key"] || row["Key"] || Object.values(row)[0];
          if (!key) continue;

          const productName = row["สินค้า"] || row["product"] || row["Product"] || "";
          const durationLabel = row["ระยะเวลา"] || row["duration"] || row["Duration"] || "";

          const productId = productName ? findProductByName(String(productName)) : undefined;
          const durationId = productId && durationLabel ? findDurationByLabel(productId, String(durationLabel)) : undefined;

          parsedKeys.push({ key: String(key), productId, durationId });
        }

        if (parsedKeys.length === 0) {
          toast.error("ไม่พบคีย์ในไฟล์");
          return;
        }

        const hasProductInfo = parsedKeys.some(k => k.productId && k.durationId);

        if (hasProductInfo) {
          const groups: Record<string, string[]> = {};
          const noGroup: string[] = [];
          for (const pk of parsedKeys) {
            if (pk.productId && pk.durationId) {
              const gk = `${pk.productId}__${pk.durationId}`;
              if (!groups[gk]) groups[gk] = [];
              groups[gk].push(pk.key);
            } else {
              noGroup.push(pk.key);
            }
          }

          setAdding(true);
          for (const [gk, gKeys] of Object.entries(groups)) {
            const [pid, did] = gk.split("__");
            await addKeysToFirestore(gKeys, pid, did);
          }
          if (noGroup.length > 0) {
            if (addProduct && addDuration) {
              await addKeysToFirestore(noGroup, addProduct, addDuration);
            } else {
              toast.warning(`${noGroup.length} คีย์ไม่พบสินค้าที่ตรงกัน กรุณาเลือกสินค้าแล้ว Import ใหม่`);
            }
          }
          setAdding(false);
        } else {
          if (!addProduct || !addDuration) {
            toast.error("Excel ไม่มีข้อมูลสินค้า กรุณาเลือกสินค้าและระยะเวลาก่อน Import");
            return;
          }
          await addKeysToFirestore(parsedKeys.map(k => k.key), addProduct, addDuration);
        }
      } catch (err) {
        console.error("Excel import error:", err);
        toast.error("ไม่สามารถอ่านไฟล์ Excel ได้");
      }
    };
    reader.readAsArrayBuffer(file);
    if (excelInputRef.current) excelInputRef.current.value = "";
  };

  const selectedProductDurations = (products.find((p) => p.id === addProduct)?.durations || []).filter((d) => !d.linkMode);

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "เครื่องมือจัดการ", path: "/hub" }, { label: "จัดการคีย์" }]}
        title="จัดการคีย์"
        subtitle="เพิ่ม/ลบ คีย์ในระบบ"
        icon={KeyRound}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "คีย์ทั้งหมด", value: totalKeys, icon: KeyRound },
            { label: "คีย์ว่าง", value: availableKeys, icon: CheckCircle },
            { label: "ถูกกดแล้ว", value: claimedCount, icon: XCircle },
          ].map((s) => (
            <div key={s.label} className="glass-card p-5 flex items-center gap-4">
              <s.icon size={24} className="text-primary shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Low stock alerts - collapsible */}
        {lowStockProducts.length > 0 && (
          <div className="mb-6 rounded-2xl bg-destructive/10 border border-destructive/30 overflow-hidden">
            <button
              onClick={() => setShowLowStock(!showLowStock)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                <AlertTriangle size={16} /> คีย์ใกล้หมด! ({lowStockProducts.length})
              </h3>
              {showLowStock ? <ChevronUp size={16} className="text-destructive" /> : <ChevronDown size={16} className="text-destructive" />}
            </button>
            <AnimatePresence>
              {showLowStock && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    {lowStockProducts.map((lsp, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{lsp.product} - {lsp.duration}</span>
                        <span className={`font-bold ${lsp.available === 0 ? "text-destructive" : "text-yellow-400"}`}>
                          เหลือ {lsp.available} คีย์
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Add Keys & Import Log Tabs */}
        <div className="glass-card mb-6 overflow-hidden">
          <Tabs defaultValue="add" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-muted/30">
              <TabsTrigger value="add" className="flex items-center gap-2 text-sm">
                <Plus size={16} /> เพิ่มคีย์ใหม่
              </TabsTrigger>
              <TabsTrigger value="logs" className="flex items-center gap-2 text-sm">
                <History size={16} /> ประวัติเติมคีย์
              </TabsTrigger>
            </TabsList>

            <TabsContent value="add">
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">สินค้า</label>
                    <select
                      value={addProduct}
                      onChange={(e) => { setAddProduct(e.target.value); setAddDuration(""); }}
                      className="input-glass w-full px-3 py-2.5 text-sm"
                    >
                      <option value="">-- เลือกสินค้า --</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">ระยะเวลา</label>
                    <select
                      value={addDuration}
                      onChange={(e) => setAddDuration(e.target.value)}
                      className="input-glass w-full px-3 py-2.5 text-sm"
                      disabled={!addProduct}
                    >
                      <option value="">-- เลือกระยะเวลา --</option>
                      {selectedProductDurations.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setAddMode("single")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${addMode === "single" ? "btn-gradient" : "btn-glass"}`}
                  >
                    เพิ่มทีละตัว
                  </button>
                  <button
                    onClick={() => setAddMode("bulk")}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${addMode === "bulk" ? "btn-gradient" : "btn-glass"}`}
                  >
                    <Upload size={14} className="inline mr-1" /> เพิ่มหลายตัว
                  </button>
                </div>

                {addMode === "single" ? (
                  <input
                    type="text"
                    value={singleKey}
                    onChange={(e) => setSingleKey(e.target.value)}
                    placeholder="วางคีย์ (รูปแบบใดก็ได้)"
                    className="input-glass w-full px-3 py-2.5 text-sm font-mono"
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2 flex-wrap">
                      <label className="text-xs font-semibold text-muted-foreground self-center">ตัวแบ่ง:</label>
                      {([
                        ["auto", "อัตโนมัติ"],
                        ["newline", "บรรทัด"],
                        ["comma", "จุลภาค (,)"],
                        ["semicolon", "อัฒภาค (;)"],
                        ["pipe", "ท่อ (|)"],
                        ["space", "ช่องว่าง"],
                        ["tab", "Tab"],
                      ] as const).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => setBulkDelimiter(val)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${bulkDelimiter === val ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={bulkKeys}
                      onChange={(e) => setBulkKeys(e.target.value)}
                      placeholder={"วางคีย์หลายตัว\nรองรับการแบ่งด้วย: บรรทัด, จุลภาค, อัฒภาค, ท่อ, ช่องว่าง, Tab"}
                      rows={5}
                      className="input-glass w-full px-3 py-2.5 text-sm font-mono resize-none"
                    />
                    {bulkKeys && (
                      <p className="text-xs text-muted-foreground">
                        ตรวจพบ: <span className="text-primary font-semibold">{parseBulkKeys(bulkKeys, bulkDelimiter).length}</span> คีย์
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleAddKeys}
                    disabled={adding || !addProduct || !addDuration}
                    className="btn-gradient px-6 py-3 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                    {adding ? "กำลังเพิ่ม..." : addMode === "single" ? "เพิ่มคีย์" : `เพิ่ม ${parseBulkKeys(bulkKeys, bulkDelimiter).length} คีย์`}
                  </button>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    disabled={adding}
                    className="btn-glass px-4 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <FileUp size={16} /> Import CSV
                  </button>
                  <button
                    onClick={() => excelInputRef.current?.click()}
                    disabled={adding}
                    className="btn-glass px-4 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <FileSpreadsheet size={16} /> Import Excel
                  </button>
                  <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleImportCSV} className="hidden" />
                  <input ref={excelInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  CSV/Excel: คอลัมน์แรก = คีย์ | รองรับไฟล์ที่ Export จากระบบ (สินค้า/ระยะเวลาจะจับคู่อัตโนมัติ)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <KeyImportLog onKeysChanged={loadKeys} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Key list */}
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-bold text-foreground">📋 รายการคีย์ทั้งหมด</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleExportCSV} className="btn-glass px-3 py-2 text-xs flex items-center gap-1">
                <Download size={12} /> Export CSV
              </button>
              <button onClick={handleExportExcel} className="btn-glass px-3 py-2 text-xs flex items-center gap-1">
                <FileSpreadsheet size={12} /> Export Excel
              </button>
              <button onClick={loadKeys} className="btn-glass px-3 py-2 text-xs flex items-center gap-1">
                <RefreshCw size={12} /> รีเฟรช
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass w-full pl-11 pr-5 py-3 text-sm"
              placeholder="ค้นหาคีย์, อีเมลผู้กด, สินค้า..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select value={filterProduct} onChange={(e) => { setFilterProduct(e.target.value); setFilterDuration(""); }} className="input-glass px-3 py-2.5 text-sm">
              <option value="">ทุกสินค้า</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterDuration} onChange={(e) => setFilterDuration(e.target.value)} className="input-glass px-3 py-2.5 text-sm">
              <option value="">ทุกระยะเวลา</option>
              {(filterProduct ? products.filter(p => p.id === filterProduct) : products).flatMap((p) => p.durations).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="input-glass px-3 py-2.5 text-sm">
              <option value="all">ทั้งหมด</option>
              <option value="available">ว่าง</option>
              <option value="claimed">ถูกกดแล้ว</option>
              <option value="orphan">🔍 คีย์กำพร้า (สินค้า/ระยะเวลาถูกลบ)</option>
            </select>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBulkDelete("claimed")}
              disabled={deleting}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={12} /> ลบคีย์ที่กดแล้ว ({filteredKeys.filter(k => k.claimed).length})
            </button>
            <button
              onClick={() => handleBulkDelete("filtered")}
              disabled={deleting}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={12} /> ลบทั้งหมดที่แสดง ({filteredKeys.length})
            </button>
            {deleting && <span className="text-xs text-muted-foreground">กำลังลบ...</span>}
          </div>

          {/* Display limit & pagination */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">แสดง:</label>
              <select value={displayLimit} onChange={(e) => { setDisplayLimit(Number(e.target.value)); setCurrentPage(1); }} className="input-glass px-2 py-1.5 text-xs w-24">
                {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
                <option value={999999}>ทั้งหมด</option>
              </select>
              <span className="text-xs text-muted-foreground">รายการ</span>
            </div>
            <p className="text-xs text-muted-foreground">ทั้งหมด {filteredKeys.length} จาก {keys.length} คีย์</p>
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-6">กำลังโหลด...</p>
          ) : filteredKeys.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">ไม่พบคีย์</p>
          ) : (() => {
            const totalPages = Math.ceil(filteredKeys.length / displayLimit);
            const paginatedKeys = filteredKeys.slice((currentPage - 1) * displayLimit, currentPage * displayLimit);
            return (
              <>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {paginatedKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border gap-2">
                      <div className="flex-1 min-w-0">
                        <code className={`text-xs font-mono truncate block ${k.claimed ? "text-muted-foreground" : "text-emerald-400"}`}>
                          {k.key}
                        </code>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="badge-primary text-[10px]">{getProductName(k.productId)}</span>
                          <span className="text-[10px] text-muted-foreground">{getDurationLabel(k.productId, k.durationId)}</span>
                          {k.claimedByEmail && (
                            <span className="text-[10px] text-muted-foreground">→ {k.claimedByEmail}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {k.claimed ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CheckCircle size={12} className="text-emerald-400" /> กดแล้ว
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-emerald-400">
                            <XCircle size={12} /> ว่าง
                          </span>
                        )}
                        <button onClick={() => handleDeleteKey(k.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">← ก่อนหน้า</button>
                    <span className="text-xs text-muted-foreground">หน้า {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-glass px-3 py-1.5 text-xs disabled:opacity-30">ถัดไป →</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </motion.div>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({ ...prev, open: false })); }}>
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default KeyManagementPage;
