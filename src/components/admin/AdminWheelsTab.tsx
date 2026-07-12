import { Save, Plus, Trash2, MoveUp, MoveDown, CircleDot, ExternalLink } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import type { WheelConfig, WheelPrize } from "@/contexts/SiteSettingsContext";
import ImageUploadField from "./ImageUploadField";

const SLICE_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#ef4444", "#14b8a6"];

const AdminWheelsTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const wheels: WheelConfig[] = (form.wheels || []).slice().sort((a: WheelConfig, b: WheelConfig) => (a.order ?? 0) - (b.order ?? 0));
  const products = (form.products || []).filter((p: any) => p.enabled && p.name);

  const update = (next: WheelConfig[]) => setForm({ ...form, wheels: next });

  const addWheel = () => {
    const maxOrder = Math.max(0, ...wheels.map(w => w.order ?? 0));
    const w: WheelConfig = {
      id: generateId(),
      slug: `wheel-${Date.now().toString(36)}`,
      name: "วงล้อใหม่",
      description: "หมุนเพื่อรับรางวัล",
      enabled: true,
      cost: 0,
      cooldownSeconds: 0,
      maxSpinsPerUser: 0,
      bannerUrl: "",
      prizes: [
        { id: generateId(), label: "รางวัลที่ 1", weight: 50, rewardType: "credit", creditAmount: 10, stock: -1, color: SLICE_COLORS[0] },
        { id: generateId(), label: "เสียใจด้วย", weight: 50, rewardType: "none", stock: -1, color: SLICE_COLORS[1] },
      ],
      order: maxOrder + 1,
    };
    update([...wheels, w]);
  };

  const updateWheel = (id: string, patch: Partial<WheelConfig>) => {
    update(wheels.map(w => w.id === id ? { ...w, ...patch } : w));
  };
  const removeWheel = (id: string) => update(wheels.filter(w => w.id !== id));
  const moveWheel = (idx: number, dir: number) => {
    const arr = [...wheels];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    arr.forEach((w, i) => (w.order = i));
    update(arr);
  };

  const addPrize = (wheelId: string) => {
    const w = wheels.find(x => x.id === wheelId);
    if (!w) return;
    const color = SLICE_COLORS[w.prizes.length % SLICE_COLORS.length];
    updateWheel(wheelId, {
      prizes: [...w.prizes, { id: generateId(), label: `รางวัลที่ ${w.prizes.length + 1}`, weight: 10, rewardType: "none", stock: -1, color }],
    });
  };
  const updatePrize = (wheelId: string, prizeId: string, patch: Partial<WheelPrize>) => {
    const w = wheels.find(x => x.id === wheelId);
    if (!w) return;
    updateWheel(wheelId, { prizes: w.prizes.map(p => p.id === prizeId ? { ...p, ...patch } : p) });
  };
  const removePrize = (wheelId: string, prizeId: string) => {
    const w = wheels.find(x => x.id === wheelId);
    if (!w) return;
    updateWheel(wheelId, { prizes: w.prizes.filter(p => p.id !== prizeId) });
  };

  const totalWeight = (w: WheelConfig) => w.prizes.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">วงล้อสุ่มรางวัล</h1>
          <p className="text-sm text-muted-foreground mt-1">สร้างวงล้อหลายวง — ตั้งค่าโอกาส, สต็อก, ราคาหมุน และลิงก์ /wheel/&lt;slug&gt;</p>
        </div>
        <button onClick={addWheel} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> เพิ่มวงล้อ</button>
      </div>

      {wheels.length === 0 ? (
        <div className="glass-card text-center py-12">
          <CircleDot size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">ยังไม่มีวงล้อ</p>
          <button onClick={addWheel} className="btn-gradient px-4 py-2 text-sm mt-4"><Plus size={14} className="inline mr-1" />สร้างวงล้อแรก</button>
        </div>
      ) : (
        <div className="space-y-4">
          {wheels.map((w, idx) => {
            const total = totalWeight(w);
            return (
              <div key={w.id} className="glass-card space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <CircleDot size={16} className="text-primary shrink-0" />
                    <h3 className="text-sm font-bold text-foreground truncate">{w.name || "วงล้อ"}</h3>
                    {!w.enabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">ซ่อน</span>}
                    <a href={`/wheel/${w.slug}`} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline inline-flex items-center gap-1">
                      /wheel/{w.slug} <ExternalLink size={11} />
                    </a>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveWheel(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30"><MoveUp size={14} /></button>
                    <button onClick={() => moveWheel(idx, 1)} disabled={idx === wheels.length - 1} className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30"><MoveDown size={14} /></button>
                    <button onClick={() => removeWheel(w.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ชื่อวงล้อ</label>
                    <input type="text" value={w.name} onChange={(e) => updateWheel(w.id, { name: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Slug (URL)</label>
                    <input type="text" value={w.slug} onChange={(e) => updateWheel(w.id, { slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="input-glass w-full px-3 py-2 text-sm" placeholder="my-wheel" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Banner</label>
                    <ImageUploadField value={w.bannerUrl || ""} onChange={(url) => updateWheel(w.id, { bannerUrl: url })} folder={`wheel/${w.id}`} compact />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-[10px] text-muted-foreground mb-1">คำอธิบาย</label>
                    <input type="text" value={w.description} onChange={(e) => updateWheel(w.id, { description: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ราคาต่อการหมุน (เครดิต, 0 = ฟรี)</label>
                    <input type="number" min={0} value={w.cost} onChange={(e) => updateWheel(w.id, { cost: Math.max(0, Number(e.target.value) || 0) })} className="input-glass w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">Cooldown (วินาที, 0 = ไม่จำกัด)</label>
                    <input type="number" min={0} value={w.cooldownSeconds} onChange={(e) => updateWheel(w.id, { cooldownSeconds: Math.max(0, Number(e.target.value) || 0) })} className="input-glass w-full px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">หมุนสูงสุด/ผู้ใช้ (0 = ไม่จำกัด)</label>
                    <input type="number" min={0} value={w.maxSpinsPerUser} onChange={(e) => updateWheel(w.id, { maxSpinsPerUser: Math.max(0, Number(e.target.value) || 0) })} className="input-glass w-full px-3 py-2 text-sm" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={w.enabled} onChange={(e) => updateWheel(w.id, { enabled: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <span className="text-xs font-medium text-foreground">เปิดใช้งานวงล้อนี้</span>
                </div>

                {/* Prizes */}
                <div className="border-t border-border/40 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-foreground">รางวัล ({w.prizes.length}) — รวม weight: {total}</h4>
                    <button onClick={() => addPrize(w.id)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-1"><Plus size={12} /> เพิ่มรางวัล</button>
                  </div>
                  <div className="space-y-2">
                    {w.prizes.map((p) => {
                      const pct = total > 0 ? ((Math.max(0, Number(p.weight) || 0) / total) * 100).toFixed(1) : "0.0";
                      return (
                        <div key={p.id} className="rounded-xl border border-border/50 bg-background/40 p-3 space-y-2">
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] text-muted-foreground mb-1">ชื่อรางวัล</label>
                              <input type="text" value={p.label} onChange={(e) => updatePrize(w.id, p.id, { label: e.target.value })} className="input-glass w-full px-2 py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">ประเภท</label>
                              <select value={p.rewardType} onChange={(e) => updatePrize(w.id, p.id, { rewardType: e.target.value as any })} className="input-glass w-full px-2 py-1.5 text-xs">
                                <option value="credit">เครดิต</option>
                                <option value="product">สินค้าในร้าน</option>
                                <option value="custom">ของรางวัล (ข้อความ)</option>
                                <option value="none">ไม่ได้รางวัล</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">Weight</label>
                              <input type="number" min={0} value={p.weight} onChange={(e) => updatePrize(w.id, p.id, { weight: Math.max(0, Number(e.target.value) || 0) })} className="input-glass w-full px-2 py-1.5 text-xs" />
                              <div className="text-[9px] text-muted-foreground mt-0.5">{pct}%</div>
                            </div>
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">สต็อก (-1 = ไม่จำกัด)</label>
                              <input type="number" value={p.stock} onChange={(e) => updatePrize(w.id, p.id, { stock: Number(e.target.value) || 0 })} className="input-glass w-full px-2 py-1.5 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">สี</label>
                              <input type="color" value={p.color || "#6366f1"} onChange={(e) => updatePrize(w.id, p.id, { color: e.target.value })} className="w-full h-[30px] rounded-lg border border-border bg-transparent" />
                            </div>
                            {p.rewardType === "credit" && (
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] text-muted-foreground mb-1">จำนวนเครดิต</label>
                                <input type="number" min={0} value={p.creditAmount || 0} onChange={(e) => updatePrize(w.id, p.id, { creditAmount: Math.max(0, Number(e.target.value) || 0) })} className="input-glass w-full px-2 py-1.5 text-xs" />
                              </div>
                            )}
                            {p.rewardType === "product" && (() => {
                              const selectedProduct = products.find((prod: any) => prod.id === p.productId);
                              const durations = (selectedProduct?.durations || []).filter((d: any) => d.enabled !== false);
                              return (
                                <>
                                  <div className="sm:col-span-2">
                                    <label className="block text-[10px] text-muted-foreground mb-1">เลือกสินค้า</label>
                                    <select value={p.productId || ""} onChange={(e) => updatePrize(w.id, p.id, { productId: e.target.value, productDurationId: "", productDays: 0 })} className="input-glass w-full px-2 py-1.5 text-xs">
                                      <option value="">-- เลือกสินค้า --</option>
                                      {products.map((prod) => (
                                        <option key={prod.id} value={prod.id}>{prod.name}</option>
                                      ))}
                                    </select>
                                    {!p.productId && <div className="text-[9px] text-amber-500 mt-0.5">กรุณาเลือกสินค้า</div>}
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-muted-foreground mb-1">ตัวเลือก (ระยะเวลา)</label>
                                    <select
                                      value={p.productDurationId || ""}
                                      onChange={(e) => {
                                        const dur = durations.find((d: any) => d.id === e.target.value);
                                        updatePrize(w.id, p.id, { productDurationId: e.target.value, productDays: dur?.days || 0 });
                                      }}
                                      className="input-glass w-full px-2 py-1.5 text-xs"
                                      disabled={!p.productId || durations.length === 0}
                                    >
                                      <option value="">-- ไม่ระบุ --</option>
                                      {durations.map((d: any) => (
                                        <option key={d.id} value={d.id}>{d.label || `${d.days} วัน`}</option>
                                      ))}
                                    </select>
                                    {p.productId && durations.length === 0 && (
                                      <div className="text-[9px] text-amber-500 mt-0.5">สินค้านี้ยังไม่มีตัวเลือก</div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                            {p.rewardType === "custom" && (
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] text-muted-foreground mb-1">หมายเหตุของรางวัล</label>
                                <input type="text" value={p.customNote || ""} onChange={(e) => updatePrize(w.id, p.id, { customNote: e.target.value })} className="input-glass w-full px-2 py-1.5 text-xs" placeholder="เช่น คูปอง / ของรางวัลพิเศษ" />
                              </div>
                            )}
                            <div className="sm:col-span-1 flex items-end">
                              <button onClick={() => removePrize(w.id, p.id)} className="ml-auto p-1.5 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกวงล้อ</button>
    </div>
  );
};

export default AdminWheelsTab;
