import { useState, useEffect } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { toast } from "sonner";
import { cleanupOldTopUpHistory } from "@/lib/activityLogger";

const AdminTransactionsTab = ({ form }: AdminTabProps) => {
  const [allTopUps, setAllTopUps] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txUserSearch, setTxUserSearch] = useState("");
  const [txMethodFilter, setTxMethodFilter] = useState("all");
  const [cleaningUp, setCleaningUp] = useState(false);

  const loadAllTransactions = async () => {
    setTxLoading(true);
    try {
      const topUpSnap = await getDocs(query(collection(db, "topUpHistory"), orderBy("createdAt", "desc"), firestoreLimit(200)));
      setAllTopUps(topUpSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      try {
        const purchaseSnap = await getDocs(query(collection(db, "walletTransactions"), orderBy("createdAt", "desc"), firestoreLimit(200)));
        setAllPurchases(purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { setAllPurchases([]); }
    } catch (err) { console.error(err); }
    finally { setTxLoading(false); }
  };

  useEffect(() => { loadAllTransactions(); }, []);

  const formatDate = (ts: any) => {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const methodLabel = (m: string) => {
    switch (m) {
      case "truewallet": return { text: "TrueWallet", cls: "bg-orange-500/20 text-orange-400" };
      case "voucher": return { text: "ซอง", cls: "bg-red-500/20 text-red-400" };
      case "giftcode": return { text: "Gift Code", cls: "bg-blue-500/20 text-blue-400" };
      case "admin": return { text: "Admin", cls: "bg-purple-500/20 text-purple-400" };
      case "bank": return { text: "ธนาคาร", cls: "bg-emerald-500/20 text-emerald-400" };
      default: return { text: "สลิป", cls: "bg-emerald-500/20 text-emerald-400" };
    }
  };

  const successTopUps = allTopUps.filter(t => t.status === "success");
  const totalTopUp = successTopUps.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const totalPurchase = allPurchases.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const dailyData: Record<string, { topup: number; purchase: number }> = {};
  successTopUps.forEach((t: any) => {
    const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) : "-";
    if (!dailyData[date]) dailyData[date] = { topup: 0, purchase: 0 };
    dailyData[date].topup += t.amount || 0;
  });
  allPurchases.forEach((t: any) => {
    const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString("th-TH", { day: "2-digit", month: "short" }) : "-";
    if (!dailyData[date]) dailyData[date] = { topup: 0, purchase: 0 };
    dailyData[date].purchase += t.amount || 0;
  });
  const chartDays = Object.entries(dailyData).slice(0, 14).reverse();
  const maxVal = Math.max(1, ...chartDays.map(([, d]) => Math.max(d.topup, d.purchase)));

  const filteredTopUps = allTopUps.filter((t: any) => {
    const matchUser = !txUserSearch || (t.userName || "").toLowerCase().includes(txUserSearch.toLowerCase()) || (t.userEmail || "").toLowerCase().includes(txUserSearch.toLowerCase()) || (t.userId || "").includes(txUserSearch);
    const matchMethod = txMethodFilter === "all" || (t.method || "bank") === txMethodFilter;
    return matchUser && matchMethod;
  });
  const filteredPurchases = allPurchases.filter((t: any) => {
    return !txUserSearch || (t.userName || "").toLowerCase().includes(txUserSearch.toLowerCase()) || (t.userEmail || "").toLowerCase().includes(txUserSearch.toLowerCase()) || (t.userId || "").includes(txUserSearch);
  });

  const userTopUpTotal = filteredTopUps.filter(t => t.status === "success").reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const userPurchaseTotal = filteredPurchases.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ประวัติธุรกรรม</h1>
        <p className="text-sm text-muted-foreground mt-1">ดูประวัติเติมเงินและซื้อสินค้าของทุกคน</p>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input type="text" placeholder="🔍 ค้นหาชื่อ, อีเมล หรือ User ID..." className="w-full px-4 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" value={txUserSearch} onChange={(e) => setTxUserSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-sm text-foreground focus:outline-none" value={txMethodFilter} onChange={(e) => setTxMethodFilter(e.target.value)}>
            <option value="all">ทุกช่องทาง</option>
            <option value="bank">สลิปธนาคาร</option>
            <option value="truewallet">TrueWallet</option>
            <option value="voucher">ซองอั่งเปา</option>
            <option value="giftcode">Gift Code</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {txUserSearch && (
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1">ผลลัพธ์สำหรับ: <span className="font-semibold text-foreground">{txUserSearch}</span></p>
            <div className="flex gap-4 text-sm">
              <span className="text-emerald-400">เติมเงิน: ฿{userTopUpTotal.toLocaleString()} ({filteredTopUps.filter(t => t.status === "success").length} รายการ)</span>
              <span className="text-red-400">ซื้อสินค้า: ฿{userPurchaseTotal.toLocaleString()} ({filteredPurchases.length} รายการ)</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">เติมเงินทั้งหมด</p>
          <p className="text-base sm:text-lg font-bold text-green-500">฿{totalTopUp.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{successTopUps.length} รายการ</p>
        </div>
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">ซื้อสินค้าทั้งหมด</p>
          <p className="text-base sm:text-lg font-bold text-red-500">฿{totalPurchase.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground">{allPurchases.length} รายการ</p>
        </div>
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">คงเหลือในระบบ</p>
          <p className="text-base sm:text-lg font-bold text-primary">฿{(totalTopUp - totalPurchase).toLocaleString()}</p>
        </div>
      </div>

      {chartDays.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">กราฟรายวัน (14 วันล่าสุด)</h3>
          <div className="flex items-end gap-1 h-32">
            {chartDays.map(([date, data], i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: "100px" }}>
                  <div className="w-1/2 bg-green-500/60 rounded-t" style={{ height: `${(data.topup / maxVal) * 100}%`, minHeight: data.topup > 0 ? "4px" : "0" }} title={`เติม ฿${data.topup.toLocaleString()}`} />
                  <div className="w-1/2 bg-red-500/60 rounded-t" style={{ height: `${(data.purchase / maxVal) * 100}%`, minHeight: data.purchase > 0 ? "4px" : "0" }} title={`ซื้อ ฿${data.purchase.toLocaleString()}`} />
                </div>
                <span className="text-[8px] text-muted-foreground">{date}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded bg-green-500/60" /> เติมเงิน</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-2 h-2 rounded bg-red-500/60" /> ซื้อสินค้า</span>
          </div>
        </div>
      )}

      {txLoading ? (
        <div className="glass-card p-8 text-center text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <>
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">ประวัติเติมเงิน ({filteredTopUps.length})</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredTopUps.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">ไม่พบรายการ</p>
              ) : filteredTopUps.map((t: any) => {
                const ml = methodLabel(t.method || "");
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${t.status === "success" ? "bg-green-500" : t.status === "duplicate" ? "bg-yellow-500" : "bg-red-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-medium text-foreground truncate">{t.userName || t.userEmail}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${ml.cls}`}>{ml.text}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)} · Ref: {t.transRef || "-"}</p>
                      {t.adminNote && <p className="text-[10px] text-muted-foreground/70 italic">{t.adminNote}</p>}
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${t.status === "success" ? "text-green-500" : "text-muted-foreground"}`}>฿{(t.amount || 0).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-foreground">ประวัติซื้อสินค้า ({allPurchases.length})</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allPurchases.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีรายการ</p>
              ) : (
                allPurchases.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                    <div className="w-2 h-2 rounded-full shrink-0 bg-red-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{t.userName || t.userEmail}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</p>
                      <p className="text-[10px] text-muted-foreground/70">{t.description}</p>
                    </div>
                    <p className="text-sm font-bold text-red-500 shrink-0">-฿{(t.amount || 0).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <button onClick={loadAllTransactions} className="btn-glass w-full py-2.5 text-sm flex items-center justify-center gap-2">
              <RotateCcw size={14} /> รีเฟรช
            </button>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setCleaningUp(true);
                  try {
                    const deleted = await cleanupOldTopUpHistory();
                    toast.success(`ลบประวัติเติมเงินเก่า ${deleted} รายการ`);
                    if (deleted > 0) loadAllTransactions();
                  } catch { toast.error("ลบไม่สำเร็จ"); }
                  setCleaningUp(false);
                }}
                disabled={cleaningUp}
                className="btn-glass flex-1 py-2.5 text-xs flex items-center justify-center gap-2 text-yellow-500 hover:bg-yellow-500/10"
              >
                {cleaningUp ? <RotateCcw size={14} className="animate-spin" /> : <Trash2 size={14} />} Cleanup เติมเงินเก่า
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminTransactionsTab;
