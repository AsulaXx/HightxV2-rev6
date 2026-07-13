import { Save, Plus, Trash2, Crown, Star } from "lucide-react";
import { VipTierSettings, VipTier } from "@/contexts/SiteSettingsContext";

const generateId = () => Math.random().toString(36).substring(2, 10);

interface Props {
  vipTiers: VipTierSettings;
  onUpdate: (vipTiers: VipTierSettings) => void;
  onSave: () => void;
}

const AdminVipTiers = ({ vipTiers, onUpdate, onSave }: Props) => {
  const update = (updates: Partial<VipTierSettings>) => onUpdate({ ...vipTiers, ...updates });

  const addTier = () => {
    const maxSpend = Math.max(0, ...vipTiers.tiers.map(t => t.minSpend));
    update({
      tiers: [...vipTiers.tiers, {
        id: generateId(),
        name: "New Tier",
        icon: "⭐",
        minSpend: maxSpend + 5000,
        discountPercent: 5,
        color: "from-purple-400 to-violet-600",
      }],
    });
  };

  const updateTier = (id: string, updates: Partial<VipTier>) => {
    update({ tiers: vipTiers.tiers.map(t => t.id === id ? { ...t, ...updates } : t) });
  };

  const removeTier = (id: string) => {
    update({ tiers: vipTiers.tiers.filter(t => t.id !== id) });
  };

  const sortedTiers = [...vipTiers.tiers].sort((a, b) => a.minSpend - b.minSpend);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">👑 ระบบ VIP Tier</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">ระบบระดับ VIP ตามยอดใช้จ่ายสะสม ให้ส่วนลดอัตโนมัติ</p>
        </div>
        <button onClick={addTier} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus size={14} /> เพิ่ม Tier
        </button>
      </div>

      {/* Master Toggle */}
      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Crown size={16} /> ระบบ VIP Tier</h3>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer gap-2">
            <button onClick={() => update({ enabled: !vipTiers.enabled })} className={`w-10 h-5 rounded-full transition-colors ${vipTiers.enabled ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${vipTiers.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-foreground">เปิดใช้งาน VIP Tier</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">เมื่อเปิดใช้งาน ระบบจะคำนวณยศ VIP ของผู้ใช้จากยอดซื้อสะสมอัตโนมัติ พร้อมส่วนลดตาม Tier</p>
      </div>

      {vipTiers.enabled && (
        <>
          {/* How it works */}
          <div className="glass-card space-y-3">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Star size={16} /> วิธีทำงาน</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/10 border border-border/10">
                <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-lg text-[10px]">1</span>
                <p>ระบบนับยอดใช้จ่ายสะสมจากประวัติ walletTransactions (type: purchase)</p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/10 border border-border/10">
                <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-lg text-[10px]">2</span>
                <p>ระดับ VIP จะถูกคำนวณอัตโนมัติตามยอดสะสม</p>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/10 border border-border/10">
                <span className="bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-lg text-[10px]">3</span>
                <p>ส่วนลดจะถูกนำไปคำนวณอัตโนมัติตอนซื้อสินค้า</p>
              </div>
            </div>
          </div>

          {/* Tier List */}
          <div className="space-y-3">
            {sortedTiers.length === 0 ? (
              <div className="glass-card text-center py-12">
                <Crown size={32} className="mx-auto text-muted-foreground/25 mb-3" />
                <p className="text-sm text-muted-foreground">ยังไม่มี Tier กดปุ่ม "เพิ่ม Tier"</p>
              </div>
            ) : (
              sortedTiers.map((tier, i) => (
                <div key={tier.id} className="glass-card !p-3 sm:!p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-base sm:text-lg shrink-0`}>
                        {tier.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-foreground truncate">{tier.name}</p>
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                          ≥ ฿{tier.minSpend.toLocaleString()} · ลด {tier.discountPercent}%
                        </p>
                      </div>
                    </div>
                    <button onClick={() => removeTier(tier.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors shrink-0">
                      <Trash2 size={13} className="text-destructive" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-foreground mb-1">ชื่อ Tier</label>
                      <input type="text" value={tier.name} onChange={(e) => updateTier(tier.id, { name: e.target.value })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-foreground mb-1">ไอคอน</label>
                      <input type="text" value={tier.icon} onChange={(e) => updateTier(tier.id, { icon: e.target.value })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-foreground mb-1">ยอดขั้นต่ำ (฿)</label>
                      <input type="number" min={0} value={tier.minSpend} onChange={(e) => updateTier(tier.id, { minSpend: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-foreground mb-1">ส่วนลด (%)</label>
                      <input type="number" min={0} max={100} value={tier.discountPercent} onChange={(e) => updateTier(tier.id, { discountPercent: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-foreground mb-1">สี Gradient (Tailwind class)</label>
                    <input type="text" value={tier.color} onChange={(e) => updateTier(tier.id, { color: e.target.value })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-mono" placeholder="from-color-400 to-color-600" />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Preview Ladder */}
          {sortedTiers.length > 0 && (
            <div className="glass-card space-y-3">
              <h3 className="text-sm font-bold text-foreground">ตัวอย่างบันได VIP</h3>
              <div className="flex items-end gap-2 justify-center p-4">
                {sortedTiers.map((tier, i) => (
                  <div key={tier.id} className="flex flex-col items-center" style={{ height: `${60 + i * 30}px` }}>
                    <div className={`w-14 flex-1 rounded-t-xl bg-gradient-to-b ${tier.color} flex items-center justify-center`}>
                      <span className="text-lg">{tier.icon}</span>
                    </div>
                    <p className="text-[9px] font-bold text-foreground mt-1">{tier.name}</p>
                    <p className="text-[8px] text-muted-foreground">฿{tier.minSpend.toLocaleString()}</p>
                    <p className="text-[8px] text-primary font-bold">-{tier.discountPercent}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button onClick={onSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
        <Save size={16} /> บันทึก VIP Tier
      </button>
    </div>
  );
};

export default AdminVipTiers;
