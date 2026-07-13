import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, where, writeBatch, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { Trash2, Calendar, AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import type { User } from "firebase/auth";

import type { UserProfile } from "@/contexts/AuthContext";

interface ResetCategory {
  id: string;
  label: string;
  icon: string;
  description: string;
  collections: string[];
  resetWallet?: boolean;
}

const RESET_CATEGORIES: ResetCategory[] = [
  {
    id: "topup",
    label: "ประวัติการเติมเงิน",
    icon: "💰",
    description: "ลบรายการเติมเงินทั้งหมด (สลิป, TrueWallet, Voucher, Gift Code)",
    collections: ["topUpHistory"],
  },
  {
    id: "claims",
    label: "ประวัติการกดคีย์",
    icon: "🔑",
    description: "ลบประวัติการกดรับคีย์ (รีเซ็ตสถานะ claimed ของคีย์ในระบบ)",
    collections: ["keys"],
  },
  {
    id: "wallet",
    label: "ยอดเงินในกระเป๋า",
    icon: "👛",
    description: "รีเซ็ตยอดเงินของผู้ใช้ทั้งหมดเป็น 0 และลบประวัติธุรกรรม",
    collections: ["walletTransactions"],
    resetWallet: true,
  },
  {
    id: "leaderboard",
    label: "ข้อมูล Leaderboard",
    icon: "🏆",
    description: "ลบข้อมูลยอดซื้อสำหรับ Leaderboard (ลบคีย์ที่ claimed ทั้งหมด)",
    collections: ["keys"],
  },
];

interface Props {
  user: User;
  profile: UserProfile | null;
}

export default function AdminDataReset({ user, profile }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"all" | "range">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});

  const toggleCategory = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReset = () => {
    if (selected.size === 0) {
      toast.error("กรุณาเลือกข้อมูลที่ต้องการรีเซ็ตอย่างน้อย 1 รายการ");
      return;
    }
    if (mode === "range" && (!dateFrom || !dateTo)) {
      toast.error("กรุณาระบุช่วงวันที่");
      return;
    }
    setConfirmText("");
    setShowConfirm(true);
  };

  const deleteCollectionDocs = async (
    collectionName: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> => {
    const snap = await getDocs(collection(db, collectionName));
    let count = 0;

    // Firestore batch max 500
    const batchSize = 450;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();

      // Date filter
      if (startDate && endDate) {
        const ts = data.createdAt?.toDate?.() || data.claimedAt?.toDate?.() || null;
        if (!ts || ts < startDate || ts > endDate) continue;
      }

      batch.delete(doc(db, collectionName, docSnap.id));
      count++;
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
    return count;
  };

  const resetWalletBalances = async (startDate?: Date, endDate?: Date): Promise<number> => {
    // If date range, only delete matching transactions
    if (startDate && endDate) {
      return await deleteCollectionDocs("walletTransactions", startDate, endDate);
    }

    // Full reset: set all wallet balances to 0
    const walletSnap = await getDocs(collection(db, "wallets"));
    const batch = writeBatch(db);
    let count = 0;

    for (const docSnap of walletSnap.docs) {
      batch.update(doc(db, "wallets", docSnap.id), { balance: 0 });
      count++;
    }
    if (count > 0) await batch.commit();

    // Also delete all wallet transactions
    const txCount = await deleteCollectionDocs("walletTransactions");
    return count + txCount;
  };

  const resetClaimedKeys = async (startDate?: Date, endDate?: Date): Promise<number> => {
    const snap = await getDocs(query(collection(db, "keys"), where("claimed", "==", true)));
    let count = 0;
    const batchSize = 450;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();

      if (startDate && endDate) {
        const ts = data.claimedAt?.toDate?.() || null;
        if (!ts || ts < startDate || ts > endDate) continue;
      }

      // Reset key to unclaimed state
      batch.update(doc(db, "keys", docSnap.id), {
        claimed: false,
        claimedBy: null,
        claimedByName: null,
        claimedAt: null,
        purchaseType: null,
        price: null,
        batchId: null,
      });
      count++;
      batchCount++;

      if (batchCount >= batchSize) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();
    return count;
  };

  const executeReset = async () => {
    if (confirmText !== "RESET") {
      toast.error("กรุณาพิมพ์ RESET เพื่อยืนยัน");
      return;
    }

    setLoading(true);
    setShowConfirm(false);
    const newResults: Record<string, number> = {};

    const startDate = mode === "range" && dateFrom ? new Date(dateFrom) : undefined;
    const endDate = mode === "range" && dateTo ? new Date(dateTo + "T23:59:59") : undefined;

    try {
      for (const catId of selected) {
        const cat = RESET_CATEGORIES.find((c) => c.id === catId);
        if (!cat) continue;

        let count = 0;

        if (catId === "wallet") {
          count = await resetWalletBalances(startDate, endDate);
        } else if (catId === "claims" || catId === "leaderboard") {
          count = await resetClaimedKeys(startDate, endDate);
        } else {
          for (const col of cat.collections) {
            count += await deleteCollectionDocs(col, startDate, endDate);
          }
        }

        newResults[catId] = count;

        await logActivity(user, profile, "data_reset", `รีเซ็ต${cat.label} ${mode === "range" ? `(${dateFrom} - ${dateTo})` : "(ทั้งหมด)"}: ${count} รายการ`);
      }

      setResults(newResults);
      const totalCount = Object.values(newResults).reduce((a, b) => a + b, 0);
      toast.success(`รีเซ็ตข้อมูลสำเร็จ! รวม ${totalCount} รายการ`);
    } catch (err) {
      console.error("Reset error:", err);
      toast.error("เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="text-destructive shrink-0" size={24} />
        <div>
          <h3 className="font-bold text-destructive text-sm">⚠️ โซนอันตราย — รีเซ็ตข้อมูล</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            การรีเซ็ตข้อมูลจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
          </p>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">รูปแบบการรีเซ็ต</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("all")}
            className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all ${
              mode === "all"
                ? "bg-destructive/10 border-destructive/40 text-destructive"
                : "bg-card/50 border-border/30 text-muted-foreground hover:border-border/60"
            }`}
          >
            <Trash2 size={16} className="inline mr-2" />
            รีเซ็ตทั้งหมด
          </button>
          <button
            onClick={() => setMode("range")}
            className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all ${
              mode === "range"
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-card/50 border-border/30 text-muted-foreground hover:border-border/60"
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            เลือกช่วงวันที่
          </button>
        </div>
      </div>

      {/* Date Range */}
      {mode === "range" && (
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">วันที่เริ่มต้น</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-card/80 border border-border/40 text-sm text-foreground"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">วันที่สิ้นสุด</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-card/80 border border-border/40 text-sm text-foreground"
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">เลือกข้อมูลที่ต้องการรีเซ็ต</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RESET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                selected.has(cat.id)
                  ? "bg-destructive/10 border-destructive/40 ring-1 ring-destructive/20"
                  : "bg-card/50 border-border/30 hover:border-border/60"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{cat.icon}</span>
                <span className={`text-sm font-semibold ${selected.has(cat.id) ? "text-destructive" : "text-foreground"}`}>
                  {cat.label}
                </span>
                {selected.has(cat.id) && <CheckCircle size={14} className="text-destructive ml-auto" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{cat.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {Object.keys(results).length > 0 && (
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
          <h4 className="text-xs font-bold text-primary">✅ ผลลัพธ์การรีเซ็ตล่าสุด</h4>
          {RESET_CATEGORIES.filter((c) => results[c.id] !== undefined).map((cat) => (
            <div key={cat.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{cat.icon} {cat.label}</span>
              <span className="font-mono font-bold text-foreground">{results[cat.id]} รายการ</span>
            </div>
          ))}
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={handleReset}
        disabled={loading || selected.size === 0}
        className="w-full p-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm hover:bg-destructive/90 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            กำลังรีเซ็ตข้อมูล...
          </>
        ) : (
          <>
            <Trash2 size={16} />
            รีเซ็ตข้อมูลที่เลือก ({selected.size} หมวด)
          </>
        )}
      </button>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-card rounded-2xl border border-destructive/30 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="text-destructive" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-foreground">ยืนยันการรีเซ็ตข้อมูล</h3>
                <p className="text-xs text-muted-foreground">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
              <p className="text-xs font-semibold text-destructive">ข้อมูลที่จะถูกรีเซ็ต:</p>
              {RESET_CATEGORIES.filter((c) => selected.has(c.id)).map((cat) => (
                <p key={cat.id} className="text-xs text-muted-foreground">
                  {cat.icon} {cat.label} {mode === "range" ? `(${dateFrom} ถึง ${dateTo})` : "(ทั้งหมด)"}
                </p>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">พิมพ์ <strong className="text-destructive">RESET</strong> เพื่อยืนยัน</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESET"
                className="w-full p-2.5 rounded-lg bg-background border border-destructive/30 text-sm text-foreground font-mono text-center tracking-widest"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 p-2.5 rounded-xl border border-border/40 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={executeReset}
                disabled={confirmText !== "RESET"}
                className="flex-1 p-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-40 hover:bg-destructive/90 transition-all"
              >
                ยืนยันรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
