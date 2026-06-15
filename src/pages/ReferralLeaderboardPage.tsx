import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Trophy, Users, Crown, Medal, Award } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

interface LeaderEntry {
  uid: string;
  displayName: string;
  count: number;
}

const podiumIcons = [
  <Crown size={22} className="text-yellow-400" />,
  <Medal size={20} className="text-gray-300" />,
  <Medal size={18} className="text-amber-600" />,
];

const podiumColors = [
  "from-yellow-400/20 to-amber-500/20 border-yellow-500/30",
  "from-gray-300/15 to-gray-400/15 border-gray-400/25",
  "from-amber-600/15 to-orange-500/15 border-amber-600/25",
];

const ReferralLeaderboardPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
  const referral = settings.referral;

  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!referral?.enabled || !referral?.leaderboardEnabled) return;
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "users"));
        const countMap: Record<string, { displayName: string; count: number }> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          const refBy = data.referredBy;
          if (refBy) {
            if (!countMap[refBy]) countMap[refBy] = { displayName: "", count: 0 };
            countMap[refBy].count++;
          }
          // Store display names
          countMap[d.id] = countMap[d.id] || { displayName: "", count: 0 };
          countMap[d.id].displayName = data.displayName || data.email || "ไม่ระบุ";
        });

        const sorted = Object.entries(countMap)
          .filter(([, v]) => v.count > 0)
          .map(([uid, v]) => ({ uid, displayName: v.displayName || uid.slice(0, 8), count: v.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50);

        setEntries(sorted);
      } catch (err) {
        console.error("Failed to load referral leaderboard:", err);
      }
      setLoading(false);
    };
    load();
  }, [referral?.enabled, referral?.leaderboardEnabled]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground text-sm">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!referral?.enabled || !referral?.leaderboardEnabled) return <Navigate to="/" replace />;

  const myRank = entries.findIndex(e => e.uid === user.uid);
  const tiers = [...(referral.rewardTiers || [])].sort((a, b) => a.minReferrals - b.minReferrals);

  return (
    <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "แนะนำเพื่อน", path: "/referral" }, { label: "อันดับ" }]}
        title="อันดับผู้แนะนำ"
        subtitle="ผู้แนะนำเพื่อนมากที่สุด"
        icon={Trophy}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* My Rank */}
        {myRank >= 0 && (
          <div className="glass-card !rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">อันดับของคุณ</p>
                  <p className="text-lg font-bold text-foreground">#{myRank + 1}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">แนะนำแล้ว</p>
                <p className="text-lg font-bold text-primary">{entries[myRank].count} คน</p>
              </div>
            </div>
          </div>
        )}

        {/* Podium Top 3 */}
        {!loading && entries.length >= 3 && (
          <div className="flex items-end justify-center gap-3 py-4">
            {[1, 0, 2].map((idx) => {
              const entry = entries[idx];
              if (!entry) return null;
              const heights = ["h-28", "h-20", "h-16"];
              const isMe = entry.uid === user.uid;
              return (
                <motion.div
                  key={entry.uid}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.15 }}
                  className="flex flex-col items-center"
                >
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${podiumColors[idx].split(" ").slice(0, 2).join(" ")} flex items-center justify-center mb-1 ${isMe ? 'ring-2 ring-primary' : ''}`}>
                    <span className="text-xs font-bold text-foreground">{entry.displayName[0]?.toUpperCase()}</span>
                  </div>
                  <p className={`text-[10px] font-bold text-foreground mb-1 max-w-[70px] truncate ${isMe ? 'text-primary' : ''}`}>{entry.displayName}</p>
                  <div className={`${heights[idx]} w-16 rounded-t-xl bg-gradient-to-b ${podiumColors[idx]} border border-b-0 flex flex-col items-center justify-start pt-2`}>
                    {podiumIcons[idx]}
                    <p className="text-sm font-bold text-foreground mt-1">{entry.count}</p>
                    <p className="text-[8px] text-muted-foreground">คน</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full List */}
        <div className="glass-card !rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Award size={15} /> อันดับทั้งหมด</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <Trophy size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
              {entries.map((entry, i) => {
                const isMe = entry.uid === user.uid;
                const tier = [...tiers].reverse().find(t => entry.count >= t.minReferrals);
                return (
                  <motion.div
                    key={entry.uid}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${isMe ? 'bg-primary/10 border border-primary/20' : 'bg-muted/10 border border-border/10'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-gradient-to-br ' + podiumColors[i] : 'bg-muted/20 text-muted-foreground'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isMe ? 'text-primary' : 'text-foreground'}`}>
                          {entry.displayName} {isMe && <span className="text-[9px] text-primary/70">(คุณ)</span>}
                        </p>
                        {tier && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r ${tier.color} text-white`}>
                            {tier.icon} {tier.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${isMe ? 'text-primary' : 'text-foreground'}`}>{entry.count} คน</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ReferralLeaderboardPage;
