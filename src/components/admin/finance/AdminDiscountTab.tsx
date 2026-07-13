import { Save, Tag, Crown, Eye, Percent, Package, Plus, Trash2, UserCog } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AdminTabProps } from "../shared/AdminTabProps";
import type { DiscountSettings, BundleDiscount, UserDiscountRule } from "@/contexts/SiteSettingsContext";

const AdminDiscountTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const disc = form.discount || { enabled: false, globalPercent: 0, resellerGlobalPercent: 0, applyTo: "all", selectedProductIds: [], resellerApplyTo: "all", resellerSelectedProductIds: [] };
  const updateDisc = (updates: Partial<DiscountSettings>) => setForm({ ...form, discount: { ...disc, ...updates } });
  const enabledProducts = (form.products || []).filter((p: any) => p.enabled && p.name);

  const bundles: BundleDiscount[] = form.bundleDiscounts || [];
  const updateBundles = (next: BundleDiscount[]) => setForm({ ...form, bundleDiscounts: next });
  const addBundle = () => updateBundles([...bundles, { id: `bundle_${Date.now()}`, name: "ชุดใหม่", requiredProductIds: [], type: "percent", value: 10, enabled: true }]);
  const removeBundle = (id: string) => updateBundles(bundles.filter(b => b.id !== id));
  const updateBundle = (id: string, updates: Partial<BundleDiscount>) => updateBundles(bundles.map(b => b.id === id ? { ...b, ...updates } : b));
  const toggleBundleProduct = (bundleId: string, pid: string) => {
    const b = bundles.find(x => x.id === bundleId);
    if (!b) return;
    const ids = b.requiredProductIds.includes(pid) ? b.requiredProductIds.filter(x => x !== pid) : [...b.requiredProductIds, pid];
    updateBundle(bundleId, { requiredProductIds: ids });
  };

  // ===== User Discounts =====
  const userRules: UserDiscountRule[] = form.userDiscounts || [];
  const updateUserRules = (next: UserDiscountRule[]) => setForm({ ...form, userDiscounts: next });
  const updateUserRule = (id: string, updates: Partial<UserDiscountRule>) => updateUserRules(userRules.map(r => r.id === id ? { ...r, ...updates } : r));
  const removeUserRule = (id: string) => updateUserRules(userRules.filter(r => r.id !== id));
  const toggleRuleProduct = (ruleId: string, pid: string) => {
    const r = userRules.find(x => x.id === ruleId);
    if (!r) return;
    const ids = r.productIds.includes(pid) ? r.productIds.filter(x => x !== pid) : [...r.productIds, pid];
    updateUserRule(ruleId, { productIds: ids });
  };

  const [allUsers, setAllUsers] = useState<{ uid: string; email: string; displayName?: string }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map(d => {
        const data = d.data() as any;
        return { uid: data.uid || d.id, email: data.email || "", displayName: data.displayName };
      }));
    });
    return () => unsub();
  }, []);
  const filteredUsers = useMemo(() => {
    const s = userSearch.toLowerCase().trim();
    const list = !s ? allUsers : allUsers.filter(u =>
      (u.displayName || "").toLowerCase().includes(s) ||
      (u.email || "").toLowerCase().includes(s) ||
      (u.uid || "").toLowerCase().includes(s)
    );
    return list.slice(0, 30);
  }, [allUsers, userSearch]);

  const addUserRule = (uid: string, label: string) => {
    if (userRules.some(r => r.userId === uid)) return;
    updateUserRules([...userRules, {
      id: `udr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: uid, userLabel: label,
      applyTo: "all", productIds: [], type: "percent", value: 10, enabled: true,
    }]);
    setUserSearch("");
    setPickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ระบบส่วนลด</h1>
        <p className="text-sm text-muted-foreground mt-1">ตั้งค่าส่วนลดราคาสินค้าสำหรับผู้ใช้ทั่วไปและตัวแทน</p>
      </div>

      <div className="glass-card space-y-4">
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${disc.enabled ? "toggle-active" : ""}`} onClick={() => updateDisc({ enabled: !disc.enabled })} />
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบส่วนลด</span>
          </label>
        </div>
      </div>

      {disc.enabled && (
        <>
          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Tag size={16} /> ส่วนลดทั่วไป (สำหรับทุกคน)</h3>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ลด {disc.globalPercent}%</label>
              <input type="range" min="0" max="90" step="1" value={disc.globalPercent} onChange={(e) => updateDisc({ globalPercent: parseInt(e.target.value) })} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>0%</span><span>90%</span></div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ใช้กับสินค้า</label>
              <div className="flex gap-2 mb-3">
                {(["all", "selected"] as const).map(mode => (
                  <button key={mode} onClick={() => updateDisc({ applyTo: mode })}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${disc.applyTo === mode ? "bg-primary/15 border-primary/30 text-primary" : "border-border/20 text-muted-foreground hover:bg-muted/20"}`}>
                    {mode === "all" ? "ทั้งหมด" : "เลือกเฉพาะ"}
                  </button>
                ))}
              </div>
              {disc.applyTo === "selected" && (
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-muted/10 border border-border/20">
                  {enabledProducts.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/20">
                      <input type="checkbox" checked={disc.selectedProductIds?.includes(p.id)} onChange={(e) => {
                        const ids = disc.selectedProductIds || [];
                        updateDisc({ selectedProductIds: e.target.checked ? [...ids, p.id] : ids.filter((id: string) => id !== p.id) });
                      }} className="accent-primary w-4 h-4 rounded" />
                      <span className="text-xs text-foreground">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Crown size={16} /> ส่วนลดตัวแทน (Reseller)</h3>
            <p className="text-xs text-muted-foreground">ส่วนลดพิเศษสำหรับยศ Reseller (ทับส่วนลดทั่วไป)</p>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ลด {disc.resellerGlobalPercent}%</label>
              <input type="range" min="0" max="90" step="1" value={disc.resellerGlobalPercent} onChange={(e) => updateDisc({ resellerGlobalPercent: parseInt(e.target.value) })} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>0%</span><span>90%</span></div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ใช้กับสินค้า</label>
              <div className="flex gap-2 mb-3">
                {(["all", "selected"] as const).map(mode => (
                  <button key={mode} onClick={() => updateDisc({ resellerApplyTo: mode })}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${disc.resellerApplyTo === mode ? "bg-primary/15 border-primary/30 text-primary" : "border-border/20 text-muted-foreground hover:bg-muted/20"}`}>
                    {mode === "all" ? "ทั้งหมด" : "เลือกเฉพาะ"}
                  </button>
                ))}
              </div>
              {disc.resellerApplyTo === "selected" && (
                <div className="space-y-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-muted/10 border border-border/20">
                  {enabledProducts.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-muted/20">
                      <input type="checkbox" checked={disc.resellerSelectedProductIds?.includes(p.id)} onChange={(e) => {
                        const ids = disc.resellerSelectedProductIds || [];
                        updateDisc({ resellerSelectedProductIds: e.target.checked ? [...ids, p.id] : ids.filter((id: string) => id !== p.id) });
                      }} className="accent-primary w-4 h-4 rounded" />
                      <span className="text-xs text-foreground">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {disc.globalPercent > 0 && enabledProducts.length > 0 && (
            <div className="glass-card space-y-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Eye size={16} /> ตัวอย่างราคา</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {enabledProducts.slice(0, 5).map((p: any) => {
                  const isApplied = disc.applyTo === "all" || disc.selectedProductIds?.includes(p.id);
                  const isResellerApplied = disc.resellerApplyTo === "all" || disc.resellerSelectedProductIds?.includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
                      <span className="text-xs text-foreground">{p.name}</span>
                      <div className="text-right">
                        {p.durations[0] && (
                          <>
                            <span className="text-[10px] text-muted-foreground line-through mr-2">฿{p.durations[0].price}</span>
                            {isApplied && <span className="text-xs font-bold text-primary">฿{Math.round(p.durations[0].price * (1 - disc.globalPercent / 100))}</span>}
                            {isResellerApplied && disc.resellerGlobalPercent > 0 && (
                              <span className="text-[10px] text-emerald-500 ml-1">(Reseller: ฿{Math.round(p.durations[0].price * (1 - disc.resellerGlobalPercent / 100))})</span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="glass-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Package size={16} className="text-primary" /> ส่วนลดชุดสินค้า (Bundle Discount)</h3>
            <p className="text-xs text-muted-foreground mt-1">ลดราคาเมื่อซื้อสินค้าที่กำหนดครบทุกชิ้นพร้อมกันในตะกร้า</p>
          </div>
          <button onClick={addBundle} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1"><Plus size={14} /> เพิ่มชุด</button>
        </div>

        {bundles.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/30 rounded-xl">ยังไม่มีชุดส่วนลด — กด "เพิ่มชุด" เพื่อเริ่มต้น</div>
        ) : (
          <div className="space-y-3">
            {bundles.map((b) => (
              <div key={b.id} className="p-3 rounded-xl bg-muted/10 border border-border/20 space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`toggle-slider ${b.enabled ? "toggle-active" : ""}`} onClick={() => updateBundle(b.id, { enabled: !b.enabled })} />
                  <input
                    value={b.name}
                    onChange={(e) => updateBundle(b.id, { name: e.target.value })}
                    placeholder="ชื่อชุด เช่น คอมโบสุดคุ้ม"
                    className="input-glass flex-1 px-3 py-2 text-sm"
                  />
                  <button onClick={() => removeBundle(b.id)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ประเภท</label>
                    <select value={b.type} onChange={(e) => updateBundle(b.id, { type: e.target.value as any })} className="input-glass w-full px-3 py-2 text-xs">
                      <option value="percent">เปอร์เซ็นต์ (%)</option>
                      <option value="fixed">จำนวนเงิน (฿)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ส่วนลด ({b.type === "percent" ? "%" : "บาท"})</label>
                    <input
                      type="number"
                      min={0}
                      max={b.type === "percent" ? 90 : undefined}
                      value={b.value}
                      onChange={(e) => updateBundle(b.id, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="input-glass w-full px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-muted-foreground mb-2">เลือกสินค้าที่ต้องอยู่ในตะกร้าครบทุกชิ้น (อย่างน้อย 2 ชิ้น)</label>
                  <div className="space-y-1 max-h-40 overflow-y-auto p-2 rounded-lg bg-background/30 border border-border/20">
                    {enabledProducts.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-2">ยังไม่มีสินค้า</p>
                    ) : enabledProducts.map((p: any) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/20">
                        <input
                          type="checkbox"
                          checked={b.requiredProductIds.includes(p.id)}
                          onChange={() => toggleBundleProduct(b.id, p.id)}
                          className="accent-primary w-4 h-4 rounded"
                        />
                        <span className="text-xs text-foreground">{p.name}</span>
                      </label>
                    ))}
                  </div>
                  {b.requiredProductIds.length > 0 && b.requiredProductIds.length < 2 && (
                    <p className="text-[10px] text-amber-400 mt-1">⚠️ ต้องเลือกอย่างน้อย 2 สินค้า</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Per-User Discount Rules ===== */}
      <div className="glass-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><UserCog size={16} className="text-primary" /> ส่วนลดรายผู้ใช้</h3>
            <p className="text-xs text-muted-foreground mt-1">ตั้งส่วนลดเฉพาะตัวให้ผู้ใช้แต่ละคน — เลือกใช้กับทุกสินค้า หรือเฉพาะสินค้าที่กำหนด</p>
          </div>
          <button onClick={() => setPickerOpen(v => !v)} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1"><Plus size={14} /> เพิ่มผู้ใช้</button>
        </div>

        {pickerOpen && (
          <div className="p-3 rounded-xl bg-muted/10 border border-border/20 space-y-2">
            <input
              autoFocus
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="ค้นหาด้วยชื่อ, อีเมล หรือ UID..."
              className="input-glass w-full px-3 py-2 text-sm"
            />
            <div className="max-h-56 overflow-y-auto space-y-1">
              {filteredUsers.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">ไม่พบผู้ใช้</p>
              ) : filteredUsers.map(u => {
                const already = userRules.some(r => r.userId === u.uid);
                return (
                  <button
                    key={u.uid}
                    disabled={already}
                    onClick={() => addUserRule(u.uid, u.displayName || u.email)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${already ? "opacity-40 cursor-not-allowed bg-muted/10" : "hover:bg-muted/20"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{u.displayName || u.email || u.uid}</p>
                      {u.email && u.displayName && <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>}
                    </div>
                    {already ? <span className="text-[10px] text-muted-foreground">เพิ่มแล้ว</span> : <Plus size={12} className="text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {userRules.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/30 rounded-xl">ยังไม่มีกฎส่วนลดรายผู้ใช้ — กด "เพิ่มผู้ใช้" เพื่อเริ่มต้น</div>
        ) : (
          <div className="space-y-3">
            {userRules.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-muted/10 border border-border/20 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`toggle-slider ${r.enabled ? "toggle-active" : ""}`} onClick={() => updateUserRule(r.id, { enabled: !r.enabled })} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.userLabel || r.userId}</p>
                    <p className="text-[10px] text-muted-foreground truncate">UID: {r.userId}</p>
                  </div>
                  <button onClick={() => removeUserRule(r.id)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ใช้กับ</label>
                    <select value={r.applyTo} onChange={(e) => updateUserRule(r.id, { applyTo: e.target.value as any })} className="input-glass w-full px-2 py-2 text-xs">
                      <option value="all">ทุกสินค้า</option>
                      <option value="selected">เลือกเฉพาะ</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ประเภท</label>
                    <select value={r.type} onChange={(e) => updateUserRule(r.id, { type: e.target.value as any })} className="input-glass w-full px-2 py-2 text-xs">
                      <option value="percent">% เปอร์เซ็นต์</option>
                      <option value="fixed">฿ จำนวนเงิน</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">ส่วนลด ({r.type === "percent" ? "%" : "บาท"})</label>
                    <input
                      type="number" min={0} max={r.type === "percent" ? 100 : undefined}
                      value={r.value}
                      onChange={(e) => updateUserRule(r.id, { value: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="input-glass w-full px-2 py-2 text-xs"
                    />
                  </div>
                </div>

                {r.applyTo === "selected" && (
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-2">เลือกสินค้าที่จะลดราคา</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto p-2 rounded-lg bg-background/30 border border-border/20">
                      {enabledProducts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-2">ยังไม่มีสินค้า</p>
                      ) : enabledProducts.map((p: any) => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/20">
                          <input
                            type="checkbox"
                            checked={r.productIds.includes(p.id)}
                            onChange={() => toggleRuleProduct(r.id, p.id)}
                            className="accent-primary w-4 h-4 rounded"
                          />
                          <span className="text-xs text-foreground">{p.name}</span>
                        </label>
                      ))}
                    </div>
                    {r.productIds.length === 0 && (
                      <p className="text-[10px] text-amber-400 mt-1">⚠️ ยังไม่ได้เลือกสินค้า — กฎนี้จะไม่ทำงาน</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกการตั้งค่าส่วนลด</button>
    </div>
  );
};

export default AdminDiscountTab;
