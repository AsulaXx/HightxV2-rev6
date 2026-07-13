import { Save, Users, Gift, DollarSign, Trophy, Plus, Trash2, Award } from "lucide-react";
import { ReferralSettings, ReferralRewardTier } from "@/contexts/SiteSettingsContext";

interface Props {
  referral: ReferralSettings;
  onUpdate: (referral: ReferralSettings) => void;
  onSave: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const AdminReferral = ({ referral, onUpdate, onSave }: Props) => {
  const update = (updates: Partial<ReferralSettings>) => onUpdate({ ...referral, ...updates });
  const tiers = referral.rewardTiers || [];

  const addTier = () => {
    const maxMin = tiers.length > 0 ? Math.max(...tiers.map(t => t.minReferrals)) : 0;
    update({
      rewardTiers: [...tiers, {
        id: generateId(),
        minReferrals: maxMin + 10,
        bonusReward: 50,
        label: "New Tier",
        icon: "🏅",
        color: "from-blue-400 to-indigo-500",
      }],
    });
  };

  const updateTier = (id: string, updates: Partial<ReferralRewardTier>) => {
    update({ rewardTiers: tiers.map(t => t.id === id ? { ...t, ...updates } : t) });
  };

  const removeTier = (id: string) => {
    update({ rewardTiers: tiers.filter(t => t.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">🤝 ระบบแนะนำเพื่อน (Referral)</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">ให้รางวัลผู้แนะนำและผู้ถูกแนะนำ เพิ่มฐานลูกค้า</p>
      </div>

      {/* Master Toggle */}
      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Users size={16} /> ระบบ Referral</h3>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer gap-2">
            <button onClick={() => update({ enabled: !referral.enabled })} className={`w-10 h-5 rounded-full transition-colors ${referral.enabled ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${referral.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบแนะนำเพื่อน</span>
          </label>
        </div>
      </div>

      {referral.enabled && (
        <>
          {/* How it works */}
          <div className="glass-card space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Gift size={16} /> วิธีทำงาน</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              {["ผู้ใช้แชร์รหัส Referral ของตนเอง (แสดงในหน้าโปรไฟล์)", "เพื่อนกรอกรหัสตอนสมัคร หรือกรอกในหน้าโปรไฟล์", "ทั้งสองฝ่ายได้รับรางวัล (เครดิตเข้ากระเป๋าเงิน)", "แนะนำมากขึ้น → ปลดล็อกระดับรางวัลและโบนัสพิเศษ"].map((text, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-muted/10 border border-border/10">
                  <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-lg text-[10px]">{i + 1}</span>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reward Settings */}
          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><DollarSign size={16} /> ตั้งค่ารางวัล</h3>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">ประเภทรางวัล</label>
              <select value={referral.rewardType} onChange={(e) => update({ rewardType: e.target.value as "credit" | "discount_percent" })} className="input-glass w-full px-3 py-2 text-sm">
                <option value="credit">เครดิต (฿)</option>
                <option value="discount_percent">ส่วนลด (%)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">
                  ผู้แนะนำได้รับ {referral.rewardType === "credit" ? "(฿)" : "(%)"}
                </label>
                <input type="number" min={0} value={referral.referrerReward} onChange={(e) => update({ referrerReward: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">
                  ผู้ถูกแนะนำได้รับ {referral.rewardType === "credit" ? "(฿)" : "(%)"}
                </label>
                <input type="number" min={0} value={referral.refereeReward} onChange={(e) => update({ refereeReward: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">จำนวนการแนะนำสูงสุด/คน</label>
              <input type="number" min={1} value={referral.maxReferrals} onChange={(e) => update({ maxReferrals: parseInt(e.target.value) || 50 })} className="input-glass w-full px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Leaderboard Toggle */}
          <div className="glass-card space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Trophy size={16} /> Leaderboard แนะนำเพื่อน</h3>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <label className="flex items-center cursor-pointer gap-2">
                <button onClick={() => update({ leaderboardEnabled: !referral.leaderboardEnabled })} className={`w-10 h-5 rounded-full transition-colors ${referral.leaderboardEnabled ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${referral.leaderboardEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-semibold text-foreground">เปิดอันดับผู้แนะนำ</span>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">แสดงอันดับผู้แนะนำเพื่อนมากที่สุด กระตุ้นการแข่งขัน</p>
          </div>

          {/* Reward Tiers */}
          <div className="glass-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Award size={16} /> ระดับรางวัล (Tiers)</h3>
              <button onClick={addTier} className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1">
                <Plus size={12} /> เพิ่ม
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">เมื่อผู้ใช้แนะนำเพื่อนถึงจำนวนที่กำหนด จะได้รับโบนัสพิเศษเพิ่มเติม</p>

            {tiers.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">ยังไม่มีระดับรางวัล</div>
            ) : (
              <div className="space-y-3">
                {[...tiers].sort((a, b) => a.minReferrals - b.minReferrals).map(tier => (
                  <div key={tier.id} className="p-3 rounded-xl bg-muted/10 border border-border/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tier.icon}
                          onChange={(e) => updateTier(tier.id, { icon: e.target.value })}
                          className="input-glass w-12 px-2 py-1 text-center text-lg"
                          maxLength={4}
                        />
                        <input
                          type="text"
                          value={tier.label}
                          onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                          className="input-glass px-2.5 py-1 text-xs font-semibold w-36"
                          placeholder="ชื่อระดับ"
                        />
                      </div>
                      <button onClick={() => removeTier(tier.id)} className="btn-glass p-1.5 text-destructive hover:bg-destructive/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] text-muted-foreground mb-0.5">แนะนำขั้นต่ำ (คน)</label>
                        <input type="number" min={1} value={tier.minReferrals} onChange={(e) => updateTier(tier.id, { minReferrals: parseInt(e.target.value) || 1 })} className="input-glass w-full px-2 py-1 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[9px] text-muted-foreground mb-0.5">โบนัส ({referral.rewardType === "credit" ? "฿" : "%"})</label>
                        <input type="number" min={0} value={tier.bonusReward} onChange={(e) => updateTier(tier.id, { bonusReward: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2 py-1 text-xs" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] text-muted-foreground mb-0.5">สี Gradient (Tailwind class)</label>
                      <input type="text" value={tier.color} onChange={(e) => updateTier(tier.id, { color: e.target.value })} className="input-glass w-full px-2 py-1 text-[10px] font-mono" placeholder="from-blue-400 to-indigo-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="glass-card space-y-3">
            <h3 className="text-sm font-bold text-foreground">ตัวอย่างรางวัล</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                <p className="text-[10px] text-muted-foreground">ผู้แนะนำ</p>
                <p className="text-lg font-bold text-primary">
                  {referral.rewardType === "credit" ? `฿${referral.referrerReward}` : `${referral.referrerReward}%`}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 text-center">
                <p className="text-[10px] text-muted-foreground">ผู้ถูกแนะนำ</p>
                <p className="text-lg font-bold text-accent-foreground">
                  {referral.rewardType === "credit" ? `฿${referral.refereeReward}` : `${referral.refereeReward}%`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <button onClick={onSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
        <Save size={16} /> บันทึกระบบ Referral
      </button>
    </div>
  );
};

export default AdminReferral;
