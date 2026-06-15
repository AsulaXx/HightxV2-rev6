import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import { Users, Gift, Copy, TrendingUp, Trophy, Award, Clock, ArrowRight } from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface ReferralRecord {
  id: string;
  displayName: string;
  email: string;
  joinedAt: string;
}

const ReferralDashboardPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
  const referral = settings.referral;

  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarned, setTotalEarned] = useState(0);

  useEffect(() => {
    if (!user || !referral?.enabled) return;
    const load = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "users"), where("referredBy", "==", user.uid));
        const snap = await getDocs(q);
        const records: ReferralRecord[] = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            displayName: data.displayName || "ไม่ระบุชื่อ",
            email: data.email || "",
            joinedAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          };
        });
        records.sort((a, b) => (b.joinedAt || "").localeCompare(a.joinedAt || ""));
        setReferrals(records);

        // Calculate total earned from wallet transactions
        const txQ = query(
          collection(db, "walletTransactions"),
          where("userId", "==", user.uid),
          where("type", "==", "referral_reward")
        );
        const txSnap = await getDocs(txQ);
        const earned = txSnap.docs.reduce((s, d) => s + (d.data().amount || 0), 0);
        setTotalEarned(earned);
      } catch (err) {
        console.error("Failed to load referrals:", err);
      }
      setLoading(false);
    };
    load();
  }, [user, referral?.enabled]);

  if (authLoading) return <div className="min-h-[80vh] flex items-center justify-center"><p className="text-muted-foreground text-sm">กำลังโหลด...</p></div>;
  if (!user || !profile) return <RedirectToLogin />;
  if (!referral?.enabled) return <Navigate to="/" replace />;

  const count = referrals.length;
  const tiers = [...(referral.rewardTiers || [])].sort((a, b) => a.minReferrals - b.minReferrals);
  const currentTier = [...tiers].reverse().find(t => count >= t.minReferrals) || null;
  const nextTier = tiers.find(t => count < t.minReferrals) || null;

  const rewardLabel = referral.rewardType === "credit" ? "฿" : "%";

  return (
    <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "แนะนำเพื่อน" }]}
        title="แนะนำเพื่อน"
        subtitle="ติดตามผลการแนะนำและรับรางวัล"
        icon={Users}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* Share Code */}
        <div className="glass-card !rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Gift size={15} /> รหัสแนะนำของคุณ</h3>
          <div className="flex items-center gap-2">
            <input type="text" value={user.uid} readOnly className="input-glass w-full px-4 py-3 text-xs font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(user.uid); toast.success("คัดลอกรหัสแนะนำแล้ว"); }} className="btn-glass px-3 py-3 shrink-0">
              <Copy size={14} />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">แชร์รหัสนี้ให้เพื่อน — เพื่อนกรอกตอนสมัครหรือในโปรไฟล์</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card !rounded-2xl text-center space-y-1">
            <Users size={18} className="mx-auto text-primary" />
            <p className="text-lg font-bold text-foreground">{count}</p>
            <p className="text-[9px] text-muted-foreground">แนะนำแล้ว</p>
          </div>
          <div className="glass-card !rounded-2xl text-center space-y-1">
            <TrendingUp size={18} className="mx-auto text-emerald-400" />
            <p className="text-lg font-bold text-foreground">{rewardLabel === "฿" ? `฿${totalEarned.toLocaleString()}` : `${totalEarned}%`}</p>
            <p className="text-[9px] text-muted-foreground">รางวัลรวม</p>
          </div>
          <div className="glass-card !rounded-2xl text-center space-y-1">
            <Award size={18} className="mx-auto text-amber-400" />
            <p className="text-lg font-bold text-foreground">{currentTier?.icon || "—"}</p>
            <p className="text-[9px] text-muted-foreground">{currentTier?.label || "ยังไม่มียศ"}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="glass-card !rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Trophy size={15} /> ความก้าวหน้า</h3>
            <span className="text-xs text-muted-foreground">{count} / {referral.maxReferrals} คน</span>
          </div>
          <Progress value={Math.min(100, (count / referral.maxReferrals) * 100)} className="h-2.5" />

          {nextTier && (
            <div className="p-3 rounded-xl bg-muted/10 border border-border/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{nextTier.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{nextTier.label}</p>
                    <p className="text-[10px] text-muted-foreground">โบนัส {rewardLabel}{nextTier.bonusReward}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-primary">อีก {nextTier.minReferrals - count} คน</span>
              </div>
              <Progress value={tiers.length > 0 ? Math.min(100, ((count - (tiers[tiers.indexOf(nextTier) - 1]?.minReferrals || 0)) / (nextTier.minReferrals - (tiers[tiers.indexOf(nextTier) - 1]?.minReferrals || 0))) * 100) : 0} className="h-1.5 mt-2" />
            </div>
          )}
        </div>

        {/* Reward Tiers */}
        {tiers.length > 0 && (
          <div className="glass-card !rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Award size={15} /> ระดับรางวัล</h3>
            <div className="space-y-2">
              {tiers.map(tier => {
                const achieved = count >= tier.minReferrals;
                return (
                  <div key={tier.id} className={`p-3 rounded-xl border transition-all ${achieved ? `bg-gradient-to-r ${tier.color} text-white border-transparent` : 'bg-muted/10 border-border/20'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tier.icon}</span>
                        <div>
                          <p className={`text-xs font-bold ${achieved ? 'text-white' : 'text-foreground'}`}>{tier.label}</p>
                          <p className={`text-[10px] ${achieved ? 'text-white/80' : 'text-muted-foreground'}`}>แนะนำ {tier.minReferrals} คนขึ้นไป</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${achieved ? 'text-white' : 'text-primary'}`}>{rewardLabel}{tier.bonusReward}</p>
                        <p className={`text-[9px] ${achieved ? 'text-white/70' : 'text-muted-foreground'}`}>{achieved ? '✅ ปลดล็อกแล้ว' : '🔒 ยังไม่ปลดล็อก'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Referral Leaderboard Link */}
        {referral.leaderboardEnabled && (
          <Link to="/referral-leaderboard" className="glass-card !rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-primary" />
              <div>
                <p className="text-sm font-bold text-foreground">อันดับผู้แนะนำ</p>
                <p className="text-[10px] text-muted-foreground">ดูอันดับผู้แนะนำเพื่อนมากที่สุด</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        )}

        {/* Recent Referrals */}
        <div className="glass-card !rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Clock size={15} /> ประวัติการแนะนำ</h3>
          {loading ? (
            <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
          ) : referrals.length === 0 ? (
            <div className="text-center py-6">
              <Users size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">ยังไม่มีการแนะนำ</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">แชร์รหัสด้านบนให้เพื่อนเพื่อเริ่มรับรางวัล!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {referrals.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/10 border border-border/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.displayName}</p>
                      <p className="text-[9px] text-muted-foreground">{r.email}</p>
                    </div>
                  </div>
                  {r.joinedAt && (
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(r.joinedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ReferralDashboardPage;
