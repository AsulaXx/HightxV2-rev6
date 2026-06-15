import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { motion } from "framer-motion";
import { Trophy, ArrowLeft, Coins, Gift, ShoppingBag, Sparkles, CircleDot, Loader2, Clock, CheckCircle2, MinusCircle, Package, Filter, X, Key, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { collectionGroup, query, where, orderBy, limit, getDocs } from "firebase/firestore";

interface SpinRecord {
  id: string;
  wheelId?: string;
  wheelName?: string;
  prizeId: string;
  prizeLabel: string;
  rewardType: "credit" | "product" | "custom" | "none";
  creditAmount?: number;
  productId?: string | null;
  productName?: string | null;
  productDays?: number;
  productKey?: string | null;
  customNote?: string | null;
  cost: number;
  stockDecremented?: boolean;
  at?: any;
}

const fmtDate = (ts: any) => {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const WheelHistoryPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
  const [spins, setSpins] = useState<SpinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterWheel, setFilterWheel] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCost, setFilterCost] = useState<string>("all");      // all|free|paid
  const [filterStock, setFilterStock] = useState<string>("all");    // all|decremented|unlimited

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collectionGroup(db, "spins"),
          where("userId", "==", user.uid),
          orderBy("at", "desc"),
          limit(200),
        );
        const snap = await getDocs(q);
        setSpins(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      } catch (e: any) {
        console.error(e);
        if (e?.code === "permission-denied") {
          setError("Firestore ปฏิเสธสิทธิ์ — กรุณารัน deploy-firestore.bat เพื่อ deploy rules ใหม่");
        } else if (e?.code === "failed-precondition") {
          setError("ต้องสร้าง Firestore index ก่อน — รัน deploy-firestore.bat หรือคลิกลิงก์ใน console เพื่อสร้าง");
        } else {
          setError(`โหลดประวัติไม่สำเร็จ: ${e?.message || e?.code || "unknown"}`);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  if (!authLoading && !user) return <RedirectToLogin />;

  const wheelOptions = useMemo(() => {
    const map = new Map<string, string>();
    spins.forEach(s => { if (s.wheelId) map.set(s.wheelId, s.wheelName || s.wheelId); });
    (settings.wheels || []).forEach(w => { if (!map.has(w.id)) map.set(w.id, w.name); });
    return Array.from(map.entries());
  }, [spins, settings.wheels]);

  const filteredSpins = useMemo(() => spins.filter(s => {
    if (filterWheel !== "all" && s.wheelId !== filterWheel) return false;
    if (filterType !== "all" && s.rewardType !== filterType) return false;
    if (filterCost === "free" && (s.cost || 0) > 0) return false;
    if (filterCost === "paid" && (s.cost || 0) <= 0) return false;
    if (filterStock === "decremented" && !s.stockDecremented) return false;
    if (filterStock === "unlimited" && s.stockDecremented) return false;
    return true;
  }), [spins, filterWheel, filterType, filterCost, filterStock]);

  const hasActiveFilter = filterWheel !== "all" || filterType !== "all" || filterCost !== "all" || filterStock !== "all";
  const resetFilters = () => { setFilterWheel("all"); setFilterType("all"); setFilterCost("all"); setFilterStock("all"); };

  const totalWon = filteredSpins.filter(s => s.rewardType !== "none").length;
  const totalCredit = filteredSpins.reduce((s, x) => s + (x.rewardType === "credit" ? (x.creditAmount || 0) : 0), 0);
  const totalSpent = filteredSpins.reduce((s, x) => s + (x.cost || 0), 0);

  const RewardIcon = ({ t }: { t: SpinRecord["rewardType"] }) => {
    if (t === "credit") return <Coins size={16} className="text-amber-400" />;
    if (t === "product") return <ShoppingBag size={16} className="text-emerald-400" />;
    if (t === "custom") return <Gift size={16} className="text-pink-400" />;
    return <Sparkles size={16} className="text-muted-foreground" />;
  };

  const wheelSlugById = new Map((settings.wheels || []).map(w => [w.id, w.slug]));

  const selectCls = "input-glass px-3 py-2 text-xs rounded-lg bg-background/40 border border-border/50 text-foreground focus:border-primary/50 outline-none";

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12 relative z-10">
      <div className="max-w-4xl mx-auto">
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={12} /> กลับไปหน้าโปรไฟล์
        </Link>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent inline-flex items-center gap-2">
            <Trophy className="text-primary" size={24} /> ประวัติการหมุนของฉัน
          </h1>
          <p className="text-sm text-muted-foreground mt-1">รายการหมุนวงล้อทั้งหมด พร้อมสถานะการตัดเครดิตและสต็อก</p>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="glass-card text-center">
            <CircleDot className="text-primary mx-auto mb-1" size={20} />
            <div className="text-xl font-extrabold text-foreground">{filteredSpins.length}<span className="text-xs text-muted-foreground font-normal">/{spins.length}</span></div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">หมุนทั้งหมด</div>
          </div>
          <div className="glass-card text-center">
            <Trophy className="text-amber-400 mx-auto mb-1" size={20} />
            <div className="text-xl font-extrabold text-foreground">{totalWon}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">รางวัลที่ได้</div>
          </div>
          <div className="glass-card text-center">
            <Coins className="text-primary mx-auto mb-1" size={20} />
            <div className="text-xl font-extrabold text-primary">+{totalCredit}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">เครดิตที่ได้</div>
          </div>
        </div>

        {/* Filters */}
        {spins.length > 0 && (
          <div className="glass-card mb-4 !p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Filter size={14} className="text-primary" />
              <span className="text-xs font-bold text-foreground">ตัวกรอง</span>
              {hasActiveFilter && (
                <button onClick={resetFilters} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <X size={11} /> ล้างตัวกรอง
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">วงล้อ</label>
                <select value={filterWheel} onChange={(e) => setFilterWheel(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">ทั้งหมด</option>
                  {wheelOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">ประเภทรางวัล</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">ทั้งหมด</option>
                  <option value="credit">เครดิต</option>
                  <option value="product">สินค้า</option>
                  <option value="custom">ข้อความ</option>
                  <option value="none">ไม่ได้รางวัล</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">ค่าใช้จ่าย</label>
                <select value={filterCost} onChange={(e) => setFilterCost(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">ทั้งหมด</option>
                  <option value="free">หมุนฟรี</option>
                  <option value="paid">ตัดเครดิต</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">สถานะสต็อก</label>
                <select value={filterStock} onChange={(e) => setFilterStock(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">ทั้งหมด</option>
                  <option value="decremented">ตัดสต็อกแล้ว</option>
                  <option value="unlimited">ไม่จำกัด</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="glass-card text-center py-16">
            <Loader2 className="animate-spin text-primary mx-auto mb-3" size={28} />
            <p className="text-sm text-muted-foreground">กำลังโหลดประวัติ...</p>
          </div>
        ) : error ? (
          <div className="glass-card text-center py-12">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : spins.length === 0 ? (
          <div className="glass-card text-center py-16">
            <CircleDot className="text-muted-foreground/30 mx-auto mb-3" size={32} />
            <p className="text-sm text-muted-foreground mb-4">ยังไม่มีประวัติการหมุน</p>
            <Link to="/hub" className="btn-gradient inline-flex items-center gap-2 px-4 py-2 text-sm">
              <Sparkles size={14} /> ไปหมุนวงล้อเลย
            </Link>
          </div>
        ) : filteredSpins.length === 0 ? (
          <div className="glass-card text-center py-16">
            <Filter className="text-muted-foreground/30 mx-auto mb-3" size={32} />
            <p className="text-sm text-muted-foreground mb-4">ไม่พบรายการที่ตรงกับตัวกรอง</p>
            <button onClick={resetFilters} className="btn-gradient inline-flex items-center gap-2 px-4 py-2 text-sm">
              <X size={14} /> ล้างตัวกรอง
            </button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden p-0">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/40 border-b border-border/40">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">วันที่</th>
                    <th className="px-4 py-3">วงล้อ</th>
                    <th className="px-4 py-3">รางวัล</th>
                    <th className="px-4 py-3 text-right">มูลค่า</th>
                    <th className="px-4 py-3 text-center">เครดิต</th>
                    <th className="px-4 py-3 text-center">สต็อก</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSpins.map((s, idx) => {
                    const slug = s.wheelId ? wheelSlugById.get(s.wheelId) : null;
                    return (
                      <tr key={s.id} className={`border-b border-border/30 last:border-0 ${idx % 2 === 0 ? "bg-background/20" : ""} hover:bg-primary/5 transition-colors`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5"><Clock size={11} />{fmtDate(s.at)}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {slug ? (
                            <Link to={`/wheel/${slug}`} className="text-primary hover:underline">{s.wheelName || slug}</Link>
                          ) : (
                            <span className="text-muted-foreground">{s.wheelName || s.wheelId || "-"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <RewardIcon t={s.rewardType} />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-foreground">{s.prizeLabel}</div>
                              {s.rewardType === "product" && s.productName && (
                                <Link to={s.productId ? `/product/${s.productId}` : "#"} className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1"><Package size={10} />{s.productName}{s.productDays ? ` · ${s.productDays} วัน` : ""}</Link>
                              )}
                              {s.rewardType === "product" && s.productKey && (
                                <div className="mt-1 flex items-center gap-1.5 max-w-md">
                                  <Key size={11} className="text-amber-400 shrink-0" />
                                  <code className="flex-1 text-[11px] font-mono font-bold text-foreground bg-background/60 px-2 py-1 rounded break-all">{s.productKey}</code>
                                  <button onClick={() => { navigator.clipboard?.writeText(s.productKey!); toast.success("คัดลอกคีย์แล้ว"); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary shrink-0" title="คัดลอก">
                                    <Copy size={11} />
                                  </button>
                                </div>
                              )}
                              {s.rewardType === "custom" && s.customNote && (
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{s.customNote}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold">
                          {s.rewardType === "credit" && (s.creditAmount || 0) > 0 ? (
                            <span className="text-emerald-400">+{s.creditAmount}</span>
                          ) : s.rewardType === "none" ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="text-emerald-400">รับรางวัล</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {s.cost > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-bold">
                              <MinusCircle size={11} />-{s.cost}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">ฟรี</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          {s.stockDecremented ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={12} />ตัดแล้ว</span>
                          ) : (
                            <span className="text-muted-foreground">ไม่จำกัด</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border/30">
              {filteredSpins.map((s) => {
                const slug = s.wheelId ? wheelSlugById.get(s.wheelId) : null;
                return (
                  <div key={s.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <RewardIcon t={s.rewardType} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-foreground truncate">{s.prizeLabel}</div>
                          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Clock size={10} />{fmtDate(s.at)}</div>
                        </div>
                      </div>
                      {s.rewardType === "credit" && (s.creditAmount || 0) > 0 && (
                        <span className="text-xs font-bold text-emerald-400 shrink-0">+{s.creditAmount}</span>
                      )}
                    </div>
                    {s.rewardType === "product" && s.productName && (
                      <Link to={s.productId ? `/product/${s.productId}` : "#"} className="text-[11px] text-emerald-400 hover:underline inline-flex items-center gap-1"><Package size={10} />{s.productName}{s.productDays ? ` · ${s.productDays} วัน` : ""}</Link>
                    )}
                    {s.rewardType === "product" && s.productKey && (
                      <div className="flex items-center gap-1.5">
                        <Key size={11} className="text-amber-400 shrink-0" />
                        <code className="flex-1 text-[11px] font-mono font-bold text-foreground bg-background/60 px-2 py-1 rounded break-all">{s.productKey}</code>
                        <button onClick={() => { navigator.clipboard?.writeText(s.productKey!); toast.success("คัดลอกคีย์แล้ว"); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary shrink-0" title="คัดลอก">
                          <Copy size={11} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[10px] flex-wrap">
                      {slug && <Link to={`/wheel/${slug}`} className="text-primary hover:underline">{s.wheelName || slug}</Link>}
                      <span className={`px-2 py-0.5 rounded-full font-bold ${s.cost > 0 ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                        {s.cost > 0 ? `-${s.cost} เครดิต` : "ฟรี"}
                      </span>
                      {s.stockDecremented && <span className="text-emerald-400 inline-flex items-center gap-0.5"><CheckCircle2 size={10} />ตัดสต็อก</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredSpins.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            แสดง {filteredSpins.length} จาก {spins.length} รายการ · ใช้ไป {totalSpent} เครดิต · ได้รางวัล {totalWon} ครั้ง
          </p>
        )}
      </div>
    </div>
  );
};

export default WheelHistoryPage;
