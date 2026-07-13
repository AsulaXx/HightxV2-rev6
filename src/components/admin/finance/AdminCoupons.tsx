import { useState } from "react";
import { Plus, Trash2, Save, Tag, Copy, CheckCircle, XCircle } from "lucide-react";
import { Coupon } from "@/contexts/SiteSettingsContext";
import { toast } from "sonner";

const generateId = () => Math.random().toString(36).substring(2, 10);
const generateCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

interface Props {
  coupons: Coupon[];
  products: { id: string; name: string }[];
  onUpdate: (coupons: Coupon[]) => void;
  onSave: () => void;
}

const AdminCoupons = ({ coupons, products, onUpdate, onSave }: Props) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const addCoupon = () => {
    onUpdate([...coupons, {
      id: generateId(),
      code: generateCode(),
      type: "percent",
      value: 10,
      minPurchase: 0,
      maxDiscount: 0,
      maxUses: 100,
      usedCount: 0,
      usedBy: [],
      perUserLimit: 1,
      enabled: true,
      expiresAt: "",
      applicableProducts: [],
      applyTo: "all",
    }]);
  };

  const update = (id: string, updates: Partial<Coupon>) => {
    onUpdate(coupons.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const remove = (id: string) => {
    onUpdate(coupons.filter(c => c.id !== id));
  };

  const toggle = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">🎟️ ระบบคูปองส่วนลด</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">สร้างและจัดการคูปองส่วนลดสำหรับลูกค้า</p>
        </div>
        <button onClick={addCoupon} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2 w-full sm:w-auto justify-center">
          <Plus size={14} /> เพิ่มคูปอง
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card p-2.5 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">คูปองทั้งหมด</p>
          <p className="text-base sm:text-lg font-bold text-primary">{coupons.length}</p>
        </div>
        <div className="glass-card p-2.5 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">ใช้งานอยู่</p>
          <p className="text-base sm:text-lg font-bold text-green-500">{coupons.filter(c => c.enabled).length}</p>
        </div>
        <div className="glass-card p-2.5 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">ใช้ไปแล้ว</p>
          <p className="text-base sm:text-lg font-bold text-foreground">{coupons.reduce((s, c) => s + c.usedCount, 0)} ครั้ง</p>
        </div>
      </div>

      {coupons.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Tag size={32} className="mx-auto text-muted-foreground/25 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีคูปอง กดปุ่ม "เพิ่มคูปอง"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map(coupon => (
            <div key={coupon.id} className="glass-card !p-3 sm:!p-4 space-y-3">
              <div className="flex items-center justify-between cursor-pointer gap-2" onClick={() => toggle(coupon.id)}>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 ${coupon.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  <code className="text-xs sm:text-sm font-bold text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg truncate">{coupon.code}</code>
                  <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {coupon.type === "percent" ? `${coupon.value}%` : `฿${coupon.value}`} · ใช้แล้ว {coupon.usedCount}/{coupon.maxUses}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(coupon.code); toast.success("คัดลอกโค้ดแล้ว"); }} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                    <Copy size={13} className="text-muted-foreground" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); remove(coupon.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                    <Trash2 size={13} className="text-destructive" />
                  </button>
                </div>
              </div>
              {/* Mobile-only summary */}
              <div className="sm:hidden text-[10px] text-muted-foreground -mt-1">
                {coupon.type === "percent" ? `${coupon.value}%` : `฿${coupon.value}`} · ใช้แล้ว {coupon.usedCount}/{coupon.maxUses}
              </div>

              {!collapsed.has(coupon.id) && (
                <div className="space-y-3 pt-2 border-t border-border/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">รหัสคูปอง</label>
                      <input type="text" value={coupon.code} onChange={(e) => update(coupon.id, { code: e.target.value.toUpperCase() })} className="input-glass w-full px-3 py-2 text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">ประเภท</label>
                      <select value={coupon.type} onChange={(e) => update(coupon.id, { type: e.target.value as "percent" | "fixed" })} className="input-glass w-full px-3 py-2 text-sm">
                        <option value="percent">เปอร์เซ็นต์ (%)</option>
                        <option value="fixed">จำนวนเงิน (฿)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">มูลค่าส่วนลด</label>
                      <input type="number" min={0} value={coupon.value} onChange={(e) => update(coupon.id, { value: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">ซื้อขั้นต่ำ (฿)</label>
                      <input type="number" min={0} value={coupon.minPurchase} onChange={(e) => update(coupon.id, { minPurchase: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">ลดสูงสุด (฿)</label>
                      <input type="number" min={0} value={coupon.maxDiscount} onChange={(e) => update(coupon.id, { maxDiscount: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" placeholder="0 = ไม่จำกัด" />
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-semibold text-foreground mb-1">จำกัด/คน</label>
                      <input type="number" min={1} value={coupon.perUserLimit} onChange={(e) => update(coupon.id, { perUserLimit: parseInt(e.target.value) || 1 })} className="input-glass w-full px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">ใช้ได้สูงสุด (ครั้ง)</label>
                      <input type="number" min={1} value={coupon.maxUses} onChange={(e) => update(coupon.id, { maxUses: parseInt(e.target.value) || 1 })} className="input-glass w-full px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">หมดอายุ</label>
                      <input type="datetime-local" value={coupon.expiresAt} onChange={(e) => update(coupon.id, { expiresAt: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">ใช้ได้กับ</label>
                    <select value={coupon.applyTo} onChange={(e) => update(coupon.id, { applyTo: e.target.value as "all" | "selected" })} className="input-glass w-full px-3 py-2 text-sm">
                      <option value="all">สินค้าทุกชิ้น</option>
                      <option value="selected">เฉพาะสินค้าที่เลือก</option>
                    </select>
                  </div>

                  {coupon.applyTo === "selected" && (
                    <div className="flex flex-wrap gap-1.5">
                      {products.map(p => {
                        const selected = coupon.applicableProducts?.includes(p.id);
                        return (
                          <button key={p.id} onClick={() => {
                            const prods = selected
                              ? (coupon.applicableProducts || []).filter(id => id !== p.id)
                              : [...(coupon.applicableProducts || []), p.id];
                            update(coupon.id, { applicableProducts: prods });
                          }} className={`text-[10px] font-medium px-2 py-1 rounded-lg transition-all ${selected ? 'bg-primary/15 text-primary border border-primary/20' : 'bg-muted/20 text-muted-foreground border border-border/20'}`}>
                            {selected ? <CheckCircle size={9} className="inline mr-0.5" /> : <XCircle size={9} className="inline mr-0.5" />}
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-muted/20 border border-border">
                    <label className="flex items-center cursor-pointer gap-2">
                      <button onClick={() => update(coupon.id, { enabled: !coupon.enabled })} className={`w-10 h-5 rounded-full transition-colors ${coupon.enabled ? 'bg-primary' : 'bg-muted'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${coupon.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                      <span className="text-sm font-semibold text-foreground">เปิดใช้งานคูปอง</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={onSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
        <Save size={16} /> บันทึกคูปอง
      </button>
    </div>
  );
};

export default AdminCoupons;
