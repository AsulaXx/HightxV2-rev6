import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import { useWallet } from "@/hooks/useWallet";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Wallet, ArrowUpRight, ArrowDownRight, Clock, Search, Filter } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, limit } from "firebase/firestore";

interface WalletTransaction {
  id: string;
  type: "topup" | "purchase" | "admin_credit";
  method?: string; // slip | qr | voucher | giftcode | admin
  provider?: string;
  amount: number;
  description: string;
  createdAt: any;
  transRef?: string;
  status?: string;
}

const methodLabel = (m?: string) => ({
  qr: "QR สแกนจ่าย", slip: "สลิปธนาคาร", voucher: "ซองอั่งเปา",
  giftcode: "Gift Code", admin: "แอดมินเครดิต",
}[m || ""] || "เติมเงิน");

const WalletHistoryPage = () => {
  const { user, profile } = useAuth();
  const { settings } = useSiteSettings();
  const { maxWidthClass } = useLayoutConfig();
  const { balance } = useWallet();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const allTx: WalletTransaction[] = [];

      const topUpQ = query(
        collection(db, "topUpHistory"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const topUpSnap = await getDocs(topUpQ);
      topUpSnap.docs.forEach(d => {
        const data = d.data();
        const isAdmin = !!data.adminBy;
        const method = isAdmin ? "admin" : (data.method || "slip");
        allTx.push({
          id: d.id,
          type: isAdmin ? "admin_credit" : "topup",
          method,
          provider: data.provider,
          amount: data.amount,
          description: isAdmin
            ? `แอดเครดิตโดยแอดมิน${data.adminNote ? ` (${data.adminNote})` : ""}`
            : `${methodLabel(method)}${data.provider ? ` · ${data.provider}` : ""} (Ref: ${data.transRef || "-"})`,
          createdAt: data.createdAt,
          transRef: data.transRef,
          status: data.status,
        });
      });

      // Load wallet transactions (purchases)
      const txQ = query(
        collection(db, "walletTransactions"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      try {
        const txSnap = await getDocs(txQ);
        txSnap.docs.forEach(d => {
          const data = d.data();
          allTx.push({
            id: d.id,
            type: "purchase",
            amount: -Math.abs(data.amount),
            description: data.description || "ซื้อสินค้า",
            createdAt: data.createdAt,
          });
        });
      } catch {
        // Collection may not exist yet
      }

      // Sort by date
      allTx.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });

      setTransactions(allTx);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  if (!user) return <RedirectToLogin />;

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const filtered = transactions.filter(tx => {
    if (filterType !== "all" && tx.type !== filterType) return false;
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const totalIn = transactions.filter(t => t.amount > 0 && t.status !== "failed" && t.status !== "duplicate").reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className={`relative z-10 ${maxWidthClass()} mx-auto px-4 sm:px-6 py-6`}>
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ประวัติ Wallet" }]}
        title="ประวัติ Wallet"
        subtitle="ดูรายการเติมเงินและการใช้จ่ายทั้งหมด"
        icon={Wallet}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground">ยอดคงเหลือ</p>
            <p className="text-lg font-bold text-primary">฿{balance.toLocaleString()}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground">เติมเข้า</p>
            <p className="text-lg font-bold text-green-500">+฿{totalIn.toLocaleString()}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-xs text-muted-foreground">ใช้ไป</p>
            <p className="text-lg font-bold text-red-500">-฿{totalOut.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[150px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-glass w-full pl-9 pr-3 py-2 text-sm" placeholder="ค้นหา..." />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="input-glass px-3 py-2 text-sm">
            <option value="all">ทั้งหมด</option>
            <option value="topup">เติมเงิน</option>
            <option value="purchase">ซื้อสินค้า</option>
            <option value="admin_credit">แอดมินเครดิต</option>
          </select>
        </div>

        {/* Transaction List */}
        <div className="space-y-2">
          {loading ? (
            <div className="glass-card p-8 text-center text-muted-foreground">กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">ไม่มีรายการ</div>
          ) : (
            filtered.map(tx => (
              <div key={tx.id} className="glass-card p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.amount > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                }`}>
                  {tx.amount > 0 ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock size={10} /> {formatDate(tx.createdAt)}
                    {tx.status && tx.status !== "success" && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                        tx.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                      }`}>{tx.status}</span>
                    )}
                  </p>
                </div>
                <p className={`text-sm font-bold shrink-0 ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                  {tx.amount > 0 ? "+" : ""}฿{Math.abs(tx.amount).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default WalletHistoryPage;
