import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Trophy, Crown, Medal, Star, Gift, TrendingUp, Users, ChevronLeft, ChevronRight, Flame, Sparkles } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { toast } from "sonner";

interface LeaderEntry {
  uid: string;
  displayName: string;
  email: string;
  totalSpent: number;
  totalItems: number;
  rank: number;
}

const MONTH_NAMES = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];


const getRankIcon = (rank: number) => {
  if (rank === 1) return <Crown className="text-yellow-400" size={28} />;
  if (rank === 2) return <Medal className="text-gray-300" size={24} />;
  if (rank === 3) return <Medal className="text-orange-400" size={24} />;
  return <Star className="text-muted-foreground" size={18} />;
};

const getRankBg = (rank: number) => {
  if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/30 ring-1 ring-yellow-500/20";
  if (rank === 2) return "bg-gradient-to-r from-gray-400/10 to-slate-400/10 border-gray-400/30";
  if (rank === 3) return "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30";
  return "bg-card/50 border-border/30";
};

const LeaderboardPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    if (user) loadLeaderboard();
  }, [user, selectedMonth, selectedYear]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const q = query(collection(db, "keys"), where("claimed", "==", true));
      const snapshot = await getDocs(q);

      const userMap: Record<string, { displayName: string; email: string; totalSpent: number; totalItems: number }> = {};

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const claimedAt = data.claimedAt?.toDate?.() || (data.claimedAt ? new Date(data.claimedAt) : null);
        if (!claimedAt || claimedAt < startDate || claimedAt > endDate) return;
        if (data.purchaseType === "free" || data.purchaseType === "wheel") return; // ไม่นับของฟรีและคีย์รางวัลวงล้อ

        const uid = data.claimedBy;
        if (!uid) return;

        if (!userMap[uid]) {
          userMap[uid] = {
            displayName: data.claimedByName || data.claimedByEmail?.split("@")[0] || "Unknown",
            email: data.claimedByEmail || "",
            totalSpent: 0,
            totalItems: 0,
          };
        }
        userMap[uid].totalSpent += (data.price || 0);
        userMap[uid].totalItems += 1;
      });

      const sorted = Object.entries(userMap)
        .map(([uid, info], _) => ({ uid, ...info, rank: 0 }))
        .sort((a, b) => b.totalSpent - a.totalSpent || b.totalItems - a.totalItems);

      sorted.forEach((entry, i) => { entry.rank = i + 1; });

      setEntries(sorted.slice(0, 50));
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      toast.error("โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  };

  const myRank = useMemo(() => entries.find(e => e.uid === user?.uid), [entries, user]);

  const goMonth = (delta: number) => {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

  if (authLoading) return null;
  if (!user || !profile) return <RedirectToLogin />;

  const lbSettings = settings.leaderboard || { enabled: true, rewards: [] };
  const rewards = lbSettings.rewards || [];

  if (!lbSettings.enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2 text-muted-foreground">
          <Trophy size={40} className="mx-auto opacity-40" />
          <p className="text-sm">Leaderboard ยังไม่เปิดใช้งาน</p>
        </div>
      </div>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <PageBreadcrumb items={[{ label: "เมนู", path: "/hub" }, { label: "Leaderboard" }]} title="Leaderboard" icon={Trophy} />

        {/* Month selector */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => goMonth(-1)} className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[160px] text-center">
            {MONTH_NAMES[selectedMonth]} {selectedYear + 543}
          </span>
          <button
            onClick={() => goMonth(1)}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Rewards info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-panel rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gift className="text-primary" size={18} />
            รางวัลประจำเดือน
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {rewards.map((r) => (
              <div key={r.id} className="rounded-lg bg-muted/30 p-2.5 text-center space-y-1">
                <div className={`text-xs font-bold bg-gradient-to-r ${r.color} bg-clip-text text-transparent`}>{r.label}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{r.reward}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* My ranking */}
        {myRank && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="glass-panel rounded-xl p-4 border border-primary/30 bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  #{myRank.rank}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles size={14} className="text-primary" />
                    อันดับของคุณ
                  </div>
                  <div className="text-xs text-muted-foreground">{myRank.displayName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-primary">฿{myRank.totalSpent.toLocaleString()}</div>
                <div className="text-[11px] text-muted-foreground">{myRank.totalItems} ชิ้น</div>
              </div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <Users size={40} className="mx-auto opacity-40" />
            <p className="text-sm">ยังไม่มีข้อมูลการซื้อในเดือนนี้</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-end justify-center gap-3 sm:gap-5 py-4"
              >
                {/* 2nd place */}
                <div className="flex flex-col items-center gap-2 w-24 sm:w-28">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-300/20 to-slate-400/20 border-2 border-gray-400/40 flex items-center justify-center">
                    <Medal className="text-gray-300" size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-foreground truncate w-full">{top3[1].displayName}</div>
                    <div className="text-[11px] text-muted-foreground">฿{top3[1].totalSpent.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{top3[1].totalItems} ชิ้น</div>
                  </div>
                  <div className="w-full h-16 rounded-t-lg bg-gradient-to-t from-gray-400/20 to-gray-300/10 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-400">2</span>
                  </div>
                </div>

                {/* 1st place */}
                <div className="flex flex-col items-center gap-2 w-28 sm:w-32 -mt-4">
                  <div className="relative">
                    <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-amber-500/20 border-2 border-yellow-500/50 flex items-center justify-center shadow-lg shadow-yellow-500/10">
                      <Crown className="text-yellow-400" size={32} />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                      <Flame size={14} className="text-white" />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-foreground truncate w-full">{top3[0].displayName}</div>
                    <div className="text-xs font-semibold text-yellow-400">฿{top3[0].totalSpent.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{top3[0].totalItems} ชิ้น</div>
                  </div>
                  <div className="w-full h-24 rounded-t-lg bg-gradient-to-t from-yellow-500/20 to-amber-400/10 flex items-center justify-center">
                    <span className="text-2xl font-black text-yellow-400">1</span>
                  </div>
                </div>

                {/* 3rd place */}
                <div className="flex flex-col items-center gap-2 w-24 sm:w-28">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400/20 to-amber-500/20 border-2 border-orange-500/40 flex items-center justify-center">
                    <Medal className="text-orange-400" size={24} />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-foreground truncate w-full">{top3[2].displayName}</div>
                    <div className="text-[11px] text-muted-foreground">฿{top3[2].totalSpent.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{top3[2].totalItems} ชิ้น</div>
                  </div>
                  <div className="w-full h-12 rounded-t-lg bg-gradient-to-t from-orange-500/20 to-amber-400/10 flex items-center justify-center">
                    <span className="text-lg font-black text-orange-400">3</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Rest of leaderboard */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              {(top3.length < 3 ? entries : rest).map((entry, i) => (
                <motion.div
                  key={entry.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${getRankBg(entry.rank)} ${
                    entry.uid === user?.uid ? "ring-1 ring-primary/30" : ""
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                    {entry.rank <= 3 ? getRankIcon(entry.rank) : (
                      <span className="text-xs font-bold text-muted-foreground">#{entry.rank}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                      {entry.displayName}
                      {entry.uid === user?.uid && (
                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">คุณ</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{entry.totalItems} ชิ้น</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-foreground">฿{entry.totalSpent.toLocaleString()}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
