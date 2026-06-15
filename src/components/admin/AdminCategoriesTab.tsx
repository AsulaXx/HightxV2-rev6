import { useState, useMemo } from "react";
import { Save, Plus, Trash2, Search, ChevronDown, ChevronUp, FolderOpen, LayoutGrid, MoveUp, MoveDown, FolderTree, Package } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import { type ProductCategory, type BannerLayout, type CategorySubDisplayMode } from "@/contexts/SiteSettingsContext";

const AdminCategoriesTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [categorySearch, setCategorySearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const allCategories: ProductCategory[] = form.categories || [];

  /** Build set of descendant ids for a given category (to prevent cyclic parent selection). */
  const getDescendantIds = (id: string): Set<string> => {
    const result = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const current = stack.pop()!;
      allCategories.forEach((c) => {
        if (c.parentId === current && !result.has(c.id)) {
          result.add(c.id);
          stack.push(c.id);
        }
      });
    }
    return result;
  };

  const getDepth = (cat: ProductCategory): number => {
    let depth = 0;
    let current: ProductCategory | undefined = cat;
    const visited = new Set<string>();
    while (current?.parentId && !visited.has(current.id)) {
      visited.add(current.id);
      depth++;
      current = allCategories.find((c) => c.id === current!.parentId);
    }
    return depth;
  };

  const addCategory = () => {
    const maxOrder = Math.max(0, ...allCategories.map((c) => c.order ?? 0));
    const cats = [...allCategories, { id: generateId(), name: "", description: "", icon: "📦", imageUrl: "", bannerUrl: "", bannerHeight: 128, gradient: "from-primary/20 to-accent/20", enabled: true, order: maxOrder + 1, parentId: null, displayAsProduct: false, subDisplayMode: "drilldown" as CategorySubDisplayMode }];
    setForm({ ...form, categories: cats });
  };

  const updateCategory = (id: string, updates: Partial<ProductCategory>) => {
    setForm({ ...form, categories: allCategories.map((c) => c.id === id ? { ...c, ...updates } : c) });
  };

  const removeCategory = (id: string) => {
    // Cascade: also detach children to root so they don't get orphaned
    const descendants = getDescendantIds(id);
    setForm({
      ...form,
      categories: allCategories
        .filter((c) => c.id !== id)
        .map((c) => descendants.has(c.id) ? { ...c, parentId: null } : c),
    });
  };

  const moveCategoryUp = (idx: number) => {
    if (idx === 0) return;
    const cats = [...allCategories];
    [cats[idx - 1], cats[idx]] = [cats[idx], cats[idx - 1]];
    cats.forEach((c, i) => c.order = i);
    setForm({ ...form, categories: cats });
  };

  const moveCategoryDown = (idx: number) => {
    const cats = [...allCategories];
    if (idx >= cats.length - 1) return;
    [cats[idx], cats[idx + 1]] = [cats[idx + 1], cats[idx]];
    cats.forEach((c, i) => c.order = i);
    setForm({ ...form, categories: cats });
  };

  const toggleCategoryCollapse = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /** Display order: hierarchical (depth-first) so children appear under their parent. */
  const orderedCategories = useMemo(() => {
    const sorted = [...allCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const result: ProductCategory[] = [];
    const visit = (parentId: string | null) => {
      sorted
        .filter((c) => (c.parentId ?? null) === parentId)
        .forEach((c) => {
          result.push(c);
          visit(c.id);
        });
    };
    visit(null);
    // Append any orphans (parent missing) at end so nothing is hidden
    sorted.forEach((c) => { if (!result.includes(c)) result.push(c); });
    return result;
  }, [allCategories]);

  const filteredFormCategories = orderedCategories.filter(
    (c) => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">หมวดหมู่สินค้า</h1>
          <p className="text-sm text-muted-foreground mt-1">{allCategories.length} หมวดหมู่ (รองรับซ้อนหลายชั้น)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const allIds = allCategories.map((c) => c.id);
            setCollapsedCategories((prev) => prev.size === allIds.length ? new Set() : new Set(allIds));
          }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1">
            {collapsedCategories.size === allCategories.length ? <><ChevronDown size={12} /> ขยายทั้งหมด</> : <><ChevronUp size={12} /> ย่อทั้งหมด</>}
          </button>
          <button onClick={addCategory} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> เพิ่มหมวดหมู่</button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="input-glass w-full pl-9 pr-4 py-2.5 text-sm" placeholder="ค้นหาหมวดหมู่..." />
      </div>

      {filteredFormCategories.length === 0 ? (
        <div className="glass-card text-center py-12">
          <FolderOpen size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{categorySearch ? "ไม่พบหมวดหมู่" : "ยังไม่มีหมวดหมู่"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFormCategories.map((cat, idx) => {
            const isCollapsed = collapsedCategories.has(cat.id);
            const allCatsSorted = [...allCategories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const globalIdx = allCatsSorted.findIndex((c) => c.id === cat.id);
            const depth = getDepth(cat);
            const childCount = allCategories.filter((c) => c.parentId === cat.id).length;
            const productCount = (form.products || []).filter((p: any) => p.categoryId === cat.id).length;
            const blockedParents = getDescendantIds(cat.id);
            const isProductMode = cat.displayAsProduct === true;
            return (
              <div
                key={cat.id}
                className="glass-card !p-4 space-y-3"
                style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 20}px` : undefined, borderLeft: depth > 0 ? "2px solid hsl(var(--primary) / 0.25)" : undefined }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => toggleCategoryCollapse(cat.id)}>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={(e) => { e.stopPropagation(); moveCategoryUp(globalIdx); }} disabled={globalIdx === 0} className="p-0.5 rounded hover:bg-muted/40 disabled:opacity-20 transition-colors"><MoveUp size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveCategoryDown(globalIdx); }} disabled={globalIdx >= allCatsSorted.length - 1} className="p-0.5 rounded hover:bg-muted/40 disabled:opacity-20 transition-colors"><MoveDown size={11} /></button>
                    </div>
                    {isProductMode ? <Package size={14} className="text-accent" /> : <FolderTree size={14} className="text-primary" />}
                    <span className="text-xl">{cat.icon || "📦"}</span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">
                        {cat.name || `หมวดหมู่ #${idx + 1}`}
                        {depth > 0 && <span className="ml-2 text-[9px] text-muted-foreground font-normal">ชั้น {depth + 1}</span>}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        {productCount} สินค้า • {childCount} หมวดย่อย • {isProductMode ? "โหมดสินค้า" : "โหมดหมวดหมู่"}
                      </p>
                    </div>
                    {isCollapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={`toggle-slider ${cat.enabled ? "toggle-active" : ""}`} onClick={() => updateCategory(cat.id, { enabled: !cat.enabled })} />
                    <button onClick={() => removeCategory(cat.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={13} /></button>
                  </div>
                </div>
                {!isCollapsed && (
                  <>
                    {/* Nested settings */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">หมวดหมู่แม่ (Parent)</label>
                        <select
                          value={cat.parentId ?? ""}
                          onChange={(e) => updateCategory(cat.id, { parentId: e.target.value || null })}
                          className="input-glass w-full px-3 py-2.5 text-sm"
                        >
                          <option value="">— ไม่มี (ระดับบนสุด) —</option>
                          {allCategories
                            .filter((c) => c.id !== cat.id && !blockedParents.has(c.id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>{`${"— ".repeat(getDepth(c))}${c.icon || "📦"} ${c.name || "(ไม่มีชื่อ)"}`}</option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">โหมดการแสดงผล</label>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-background/40 border border-border/30">
                          <span className="text-xs text-foreground flex items-center gap-1.5">
                            {isProductMode ? <><Package size={12} /> ใช้เป็นสินค้า</> : <><FolderTree size={12} /> ใช้เป็นหมวดหมู่</>}
                          </span>
                          <div
                            className={`toggle-slider ${isProductMode ? "toggle-active" : ""}`}
                            onClick={() => updateCategory(cat.id, { displayAsProduct: !isProductMode })}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">เปิด = คลิกแล้วไปหน้าสินค้าทันที (ข้ามหมวดย่อย)</p>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">การแสดงหมวดย่อย</label>
                        <select
                          value={cat.subDisplayMode || "drilldown"}
                          onChange={(e) => updateCategory(cat.id, { subDisplayMode: e.target.value as CategorySubDisplayMode })}
                          disabled={isProductMode}
                          className="input-glass w-full px-3 py-2.5 text-sm disabled:opacity-50"
                        >
                          <option value="drilldown">Drill-down (เข้าหน้าใหม่)</option>
                          <option value="accordion">Accordion (ขยายในหน้าเดิม)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">ชื่อหมวดหมู่</label>
                        <input type="text" value={cat.name} onChange={(e) => updateCategory(cat.id, { name: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="Gaming" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Emoji Icon</label>
                        <input type="text" value={cat.icon} onChange={(e) => updateCategory(cat.id, { icon: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="🎮" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">คำอธิบาย (แสดงใต้ชื่อหมวดหมู่)</label>
                      <input type="text" value={cat.description || ""} onChange={(e) => updateCategory(cat.id, { description: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="คำอธิบายสั้นๆ เช่น สินค้าเกมทุกชนิด" />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">URL รูปภาพหมวดหมู่ (Card)</label>
                      <div className="flex items-center gap-3">
                        <input type="url" value={cat.imageUrl || ""} onChange={(e) => updateCategory(cat.id, { imageUrl: e.target.value })} className="input-glass flex-1 px-3 py-2.5 text-sm" placeholder="https://..." />
                        {cat.imageUrl && <img src={cat.imageUrl} alt={cat.name} className="w-12 h-12 rounded-xl object-cover border border-border shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">URL รูปป้าย Banner (แนวนอน)</label>
                      <div className="flex items-center gap-3">
                        <input type="url" value={cat.bannerUrl || ""} onChange={(e) => updateCategory(cat.id, { bannerUrl: e.target.value })} className="input-glass flex-1 px-3 py-2.5 text-sm" placeholder="https://..." />
                        {cat.bannerUrl && <img src={cat.bannerUrl} alt={cat.name} className="w-24 h-10 rounded-lg object-cover border border-border shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">ความสูง Banner ({cat.bannerHeight || 128}px)</label>
                      <input type="range" min="64" max="400" step="8" value={cat.bannerHeight || 128} onChange={(e) => updateCategory(cat.id, { bannerHeight: parseInt(e.target.value) })} className="w-full accent-primary" />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>64px</span><span>400px</span></div>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Gradient สี (Tailwind classes)</label>
                      <div className="flex items-center gap-3">
                        <input type="text" value={cat.gradient || ""} onChange={(e) => updateCategory(cat.id, { gradient: e.target.value })} className="input-glass flex-1 px-3 py-2.5 text-sm font-mono" placeholder="from-indigo-500/20 to-purple-500/20" />
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${cat.gradient || 'from-primary/20 to-accent/20'} border border-border shrink-0 flex items-center justify-center text-lg`}>{cat.icon}</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Display Mode Settings */}
      <div className="glass-card !p-4 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><LayoutGrid size={14} className="text-primary" /> รูปแบบการแสดงผล</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-2">หมวดหมู่สินค้า</label>
            <select value={form.categoryDisplayMode || "card"} onChange={(e) => setForm({ ...form, categoryDisplayMode: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="card">Card (การ์ดสี่เหลี่ยม)</option>
              <option value="banner">Banner (ป้ายแนวนอน)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2">เลย์เอาท์ Banner</label>
            <select value={form.categoryBannerLayout || "vertical"} onChange={(e) => setForm({ ...form, categoryBannerLayout: e.target.value as BannerLayout })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="vertical">แนวตั้ง (ซ้อนกัน)</option>
              <option value="horizontal">แนวนอน (ขนานกัน)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2">จำนวนคอลัมน์ (ขนาน)</label>
            <select value={form.categoryBannerColumns || 2} onChange={(e) => setForm({ ...form, categoryBannerColumns: parseInt(e.target.value) })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value={1}>1 คอลัมน์</option>
              <option value={2}>2 คอลัมน์</option>
              <option value={3}>3 คอลัมน์</option>
              <option value={4}>4 คอลัมน์</option>
              <option value={6}>6 คอลัมน์</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-2">สินค้าในร้านค้า</label>
            <select value={form.productDisplayMode || "card"} onChange={(e) => setForm({ ...form, productDisplayMode: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="card">Card (การ์ดสี่เหลี่ยม)</option>
              <option value="banner">Banner (ป้ายแนวนอน)</option>
            </select>
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกหมวดหมู่</button>
    </div>
  );
};

export default AdminCategoriesTab;
