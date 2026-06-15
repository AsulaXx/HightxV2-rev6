import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Wallet, Search, ChevronLeft, ChevronRight, RefreshCw, Users, Plus, Minus, DollarSign } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, increment, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface WalletRecord {
  userId: string;
  balance: number;
  userName?: string;
  userEmail?: string;
}

const PAGE_SIZE = 20;

const CustomerBalancesPage = () => {
  const { user, profile, loading: authLoading, hasPermission } = useAuth();
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"balance-desc" | "balance-asc" | "name">("balance-desc");

  // Inline adjustment state
  const [adjustingUserId, setAdjustingUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "deduct">("add");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (user && hasPermission("admin")) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [walletSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "wallets")),
        getDocs(collection(db, "users")),
      ]);

      const userMap: Record<string, { displayName?: string; email?: string }> = {};
      usersSnap.docs.forEach((d) => {
        const data = d.data();
        userMap[d.id] = { displayName: data.displayName, email: data.email };
      });

      const data = walletSnap.docs
        .map((d) => {
          const wData = d.data();
          return {
            userId: d.id,
            balance: wData.balance || 0,
            userName: userMap[d.id]?.displayName,
            userEmail: userMap[d.id]?.email,
          } as WalletRecord;
        })
        .filter((w) => w.balance > 0);

      setWallets(data);
    } catch (err) {
      console.error("Failed to load wallets:", err);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let list = wallets;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (w) =>
          w.userName?.toLowerCase().includes(q) ||
          w.userEmail?.toLowerCase().includes(q) ||
          w.userId.toLowerCase().includes(q)
      );
    }

    if (sortBy === "balance-desc") list = [...list].sort((a, b) => b.balance - a.balance);
    else if (sortBy === "balance-asc") list = [...list].sort((a, b) => a.balance - b.balance);
    else list = [...list].sort((a, b) => (a.userName || a.userEmail || "").localeCompare(b.userName || b.userEmail || ""));

    return list;
  }, [wallets, searchQuery, sortBy]);

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, sortBy]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  if (!user) return <RedirectToLogin />;
  if (!hasPermission("admin")) return <Navigate to="/" replace />;

  const handleAdjust = async (w: WalletRecord) => {
    const rawAmount = Math.abs(parseFloat(adjustAmount));
    if (isNaN(rawAmount) || rawAmount === 0) {
      toast.error("จำนวนเงินไม่ถูกต้อง");
      return;
    }
    const amount = adjustMode === "deduct" ? -rawAmount : rawAmount;

    if (amount < 0 && w.balance + amount < 0) {
      toast.error(`ยอดเงินไม่พอ (คงเหลือ ฿${w.balance.toLocaleString()})`);
      return;
    }

    setAdjusting(true);
    try {
      const walletRef = doc(db, "wallets", w.userId);
      await updateDoc(walletRef, { balance: increment(amount), lastTopUp: serverTimestamp() });

      await addDoc(collection(db, "topUpHistory"), {
        userId: w.userId,
        userEmail: w.userEmail || "",
        userName: w.userName || w.userEmail || "",
        amount,
        transRef: `ADMIN_${adjustMode === "deduct" ? "DEDUCT" : "ADD"}_${Date.now()}`,
        status: "success",
        method: "admin",
        adminNote: adjustNote || `${adjustMode === "deduct" ? "ลบเครดิต" : "แอดเครดิต"}โดย ${profile?.displayName || profile?.email}`,
        adminBy: user!.uid,
        createdAt: serverTimestamp(),
      });

      await logActivity(user!, profile!, "admin_credit", `${adjustMode === "deduct" ? "ลบ" : "แอด"}เครดิต ฿${rawAmount.toLocaleString()} ${adjustMode === "deduct" ? "จาก" : "ให้"} ${w.userName || w.userEmail}${adjustNote ? ` (${adjustNote})` : ""}`);

      toast.success(`${adjustMode === "deduct" ? "หัก" : "เพิ่ม"}เครดิต ฿${rawAmount.toLocaleString()} สำเร็จ`);
      setAdjustingUserId(null);
      setAdjustAmount("");
      setAdjustNote("");
      setAdjustMode("add");
      loadData();
    } catch (err) {
      console.error(err);
      toast.error("ไม่สามารถดำเนินการได้");
    }
    setAdjusting(false);
  };

  return (
    <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ประวัติเติมเงิน", path: "/all-topup" }, { label: "ยอดเงินคงค้างลูกค้า" }]}
        title="ยอดเงินคงค้างลูกค้า"
        subtitle="รายชื่อลูกค้าที่มีเงินค้างอยู่ในระบบ"
        icon={Wallet}
      />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Users size={10} /> จำนวนลูกค้า</p>
            <p className="text-lg font-bold text-foreground">{wallets.length.toLocaleString()}</p>
          </div>
          <div className="glass-card !p-4 text-center">
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1"><Wallet size={10} /> ยอดรวมคงค้าง</p>
            <p className="text-lg font-bold text-primary">฿{totalBalance.toLocaleString()}</p>
          </div>
          <div className="glass-card !p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] text-muted-foreground">ค่าเฉลี่ย/คน</p>
            <p className="text-lg font-bold text-foreground">
              ฿{wallets.length > 0 ? Math.round(totalBalance / wallets.length).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="glass-card mb-6">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-glass w-full pl-11 pr-5 py-3 text-sm"
                placeholder="ค้นหา (ชื่อ, อีเมล, ID)..."
              />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input-glass px-3 py-3 text-sm">
              <option value="balance-desc">ยอดมาก → น้อย</option>
              <option value="balance-asc">ยอดน้อย → มาก</option>
              <option value="name">ตามชื่อ</option>
            </select>
            <button onClick={loadData} className="btn-glass px-4 py-2.5 text-sm flex items-center gap-2">
              <RefreshCw size={16} /> รีเฟรช
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            แสดง {paged.length} จาก {filtered.length} รายการ (หน้า {page}/{totalPages})
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div className="glass-card text-center py-16"><p className="text-muted-foreground">กำลังโหลด...</p></div>
        ) : paged.length === 0 ? (
          <div className="glass-card text-center py-16">
            <Wallet size={48} className="mx-auto mb-4 opacity-40 text-muted-foreground" />
            <p className="text-muted-foreground">ไม่พบลูกค้าที่มียอดเงินคงค้าง</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paged.map((w, i) => (
              <motion.div
                key={w.userId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="glass-card !p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {w.userName || w.userEmail || "Unknown"}
                    </p>
                    {w.userEmail && w.userName && (
                      <p className="text-[10px] text-muted-foreground truncate">{w.userEmail}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-lg font-bold text-primary">฿{w.balance.toLocaleString()}</p>
                    <button
                      onClick={() => {
                        if (adjustingUserId === w.userId) {
                          setAdjustingUserId(null);
                        } else {
                          setAdjustingUserId(w.userId);
                          setAdjustAmount("");
                          setAdjustNote("");
                          setAdjustMode("add");
                        }
                      }}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="ปรับยอดเงิน"
                    >
                      <DollarSign size={14} />
                    </button>
                  </div>
                </div>

                {/* Inline adjust panel */}
                {adjustingUserId === w.userId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-border space-y-2"
                  >
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => setAdjustMode("add")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          adjustMode === "add"
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-muted/10 text-muted-foreground border-border/30"
                        }`}
                      >
                        <Plus size={12} className="inline mr-1" />เพิ่ม
                      </button>
                      <button
                        onClick={() => setAdjustMode("deduct")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          adjustMode === "deduct"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-muted/10 text-muted-foreground border-border/30"
                        }`}
                      >
                        <Minus size={12} className="inline mr-1" />ลบ
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value.replace("-", ""))}
                        className="input-glass flex-1 px-3 py-1.5 text-sm"
                        placeholder="จำนวนเงิน (฿)"
                      />
                    </div>
                    <input
                      type="text"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="input-glass w-full px-3 py-1.5 text-sm"
                      placeholder="หมายเหตุ (ไม่บังคับ)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdjustingUserId(null)}
                        className="btn-glass px-3 py-1.5 text-xs"
                      >
                        ยกเลิก
                      </button>
                      <button
                        disabled={adjusting || !adjustAmount}
                        onClick={() => handleAdjust(w)}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 ${
                          adjustMode === "deduct"
                            ? "bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/20"
                            : "btn-gradient"
                        }`}
                      >
                        {adjusting ? "กำลังดำเนินการ..." : adjustMode === "deduct" ? `หักเครดิต` : `เพิ่มเครดิต`}
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-muted/40 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (page <= 4) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      page === pageNum
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-muted/40 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} className="text-foreground" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CustomerBalancesPage;
