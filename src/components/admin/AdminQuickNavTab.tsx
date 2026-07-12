import { useState } from "react";
import { Save, Plus, Trash2, Search, ChevronDown, ChevronUp, Navigation, LayoutGrid, Rows, MoveUp, MoveDown, GripVertical } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import type { QuickNavItem, BannerLayout } from "@/contexts/SiteSettingsContext";
import ImageUploadField from "./ImageUploadField";

const AdminQuickNavTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [quickNavSearch, setQuickNavSearch] = useState("");
  const [collapsedQuickNav, setCollapsedQuickNav] = useState<Set<string>>(new Set());

  const filteredNav = (form.quickNavItems || [])
    .sort((a: QuickNavItem, b: QuickNavItem) => (a.order ?? 0) - (b.order ?? 0))
    .filter((n: QuickNavItem) => !quickNavSearch || n.name.toLowerCase().includes(quickNavSearch.toLowerCase()));

  const addQuickNav = () => {
    const maxOrder = Math.max(0, ...(form.quickNavItems || []).map((n: QuickNavItem) => n.order ?? 0));
    setForm({ ...form, quickNavItems: [...(form.quickNavItems || []), { id: generateId(), name: "", icon: "🔗", imageUrl: "", bannerUrl: "", bannerHeight: 80, gradient: "from-primary/20 to-accent/20", url: "", enabled: true, order: maxOrder + 1 }] });
  };
  const updateQuickNav = (id: string, updates: Partial<QuickNavItem>) => {
    setForm({ ...form, quickNavItems: (form.quickNavItems || []).map((n: QuickNavItem) => n.id === id ? { ...n, ...updates } : n) });
  };
  const removeQuickNav = (id: string) => {
    setForm({ ...form, quickNavItems: (form.quickNavItems || []).filter((n: QuickNavItem) => n.id !== id) });
  };
  const moveQuickNav = (idx: number, dir: number) => {
    const items = [...(form.quickNavItems || [])].sort((a: QuickNavItem, b: QuickNavItem) => (a.order ?? 0) - (b.order ?? 0));
    if (idx + dir < 0 || idx + dir >= items.length) return;
    [items[idx], items[idx + dir]] = [items[idx + dir], items[idx]];
    items.forEach((n: QuickNavItem, i: number) => n.order = i);
    setForm({ ...form, quickNavItems: items });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quick Navigation</h1>
          <p className="text-sm text-muted-foreground mt-1">ปุ่มนำทางด่วนบนหน้าหลัก {(form.quickNavItems || []).length} รายการ</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            const allIds = (form.quickNavItems || []).map((n: QuickNavItem) => n.id);
            setCollapsedQuickNav(prev => prev.size === allIds.length ? new Set() : new Set(allIds));
          }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1">
            {collapsedQuickNav.size === (form.quickNavItems || []).length ? <><ChevronDown size={12} /> ขยาย</> : <><ChevronUp size={12} /> ย่อ</>}
          </button>
          <button onClick={addQuickNav} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> เพิ่ม</button>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={quickNavSearch} onChange={(e) => setQuickNavSearch(e.target.value)} className="input-glass w-full pl-9 pr-4 py-2.5 text-sm" placeholder="ค้นหา..." />
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-sm font-bold text-foreground">รูปแบบการแสดงผล</h3>
        <div className="grid grid-cols-2 gap-2">
          {(["card", "banner"] as const).map(mode => (
            <button key={mode} onClick={() => setForm({ ...form, quickNavDisplayMode: mode })} className={`p-3 rounded-xl border text-center text-xs font-medium transition-all ${form.quickNavDisplayMode === mode ? "border-primary/30 bg-primary/5 text-primary" : "border-border/30 text-muted-foreground"}`}>
              {mode === "card" ? <><LayoutGrid size={16} className="mx-auto mb-1" /> การ์ด</> : <><Rows size={16} className="mx-auto mb-1" /> แบนเนอร์</>}
            </button>
          ))}
        </div>
        {form.quickNavDisplayMode === "banner" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">รูปแบบ</label>
              <select value={form.quickNavBannerLayout || "horizontal"} onChange={(e) => setForm({ ...form, quickNavBannerLayout: e.target.value as BannerLayout })} className="input-glass w-full px-3 py-2 text-xs">
                <option value="vertical">แนวตั้ง</option>
                <option value="horizontal">ขนาน</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">คอลัมน์</label>
              <select value={form.quickNavBannerColumns || 2} onChange={(e) => setForm({ ...form, quickNavBannerColumns: parseInt(e.target.value) })} className="input-glass w-full px-3 py-2 text-xs">
                {[1,2,3,4,6].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {filteredNav.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Navigation size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{quickNavSearch ? "ไม่พบรายการ" : "ยังไม่มี Quick Nav"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNav.map((nav: QuickNavItem, idx: number) => {
            const isCollapsed = collapsedQuickNav.has(nav.id);
            return (
              <div key={nav.id} className="glass-card !p-4 space-y-3">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => { const next = new Set(collapsedQuickNav); isCollapsed ? next.delete(nav.id) : next.add(nav.id); setCollapsedQuickNav(next); }}>
                  <div className="flex items-center gap-3">
                    <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                    <span className="text-lg">{nav.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{nav.name || `Nav #${idx + 1}`}</h3>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{nav.url || "ยังไม่ได้ตั้งลิงก์"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); moveQuickNav(idx, -1); }} className="p-1 rounded hover:bg-muted/30"><MoveUp size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveQuickNav(idx, 1); }} className="p-1 rounded hover:bg-muted/30"><MoveDown size={12} /></button>
                    <div className={`toggle-slider ${nav.enabled ? "toggle-active" : ""}`} onClick={(e) => { e.stopPropagation(); updateQuickNav(nav.id, { enabled: !nav.enabled }); }} />
                    <button onClick={(e) => { e.stopPropagation(); removeQuickNav(nav.id); }} className="p-1 rounded text-destructive hover:bg-destructive/10"><Trash2 size={12} /></button>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="space-y-3 pt-3 border-t border-border/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">ชื่อ</label>
                        <input type="text" value={nav.name} onChange={(e) => updateQuickNav(nav.id, { name: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="เช่น Discord" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Icon (Emoji)</label>
                        <input type="text" value={nav.icon} onChange={(e) => updateQuickNav(nav.id, { icon: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="🔗" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">URL ลิงก์</label>
                        <input type="text" value={nav.url} onChange={(e) => updateQuickNav(nav.id, { url: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="/path หรือ https://..." />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">รูป Icon URL</label>
                        <input type="text" value={nav.imageUrl} onChange={(e) => updateQuickNav(nav.id, { imageUrl: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="URL รูปภาพ" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Banner URL</label>
                        <input type="text" value={nav.bannerUrl} onChange={(e) => updateQuickNav(nav.id, { bannerUrl: e.target.value })} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="URL แบนเนอร์" />
                      </div>
                      {form.quickNavDisplayMode === "banner" && nav.bannerUrl && (
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">ความสูงแบนเนอร์ (px)</label>
                          <input type="number" min={40} max={300} value={nav.bannerHeight || 80} onChange={(e) => updateQuickNav(nav.id, { bannerHeight: parseInt(e.target.value) || 80 })} className="input-glass w-full px-3 py-2.5 text-sm" />
                        </div>
                      )}
                    </div>
                    {!nav.bannerUrl && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">สี Gradient</label>
                        <select value={nav.gradient || "from-primary/20 to-accent/20"} onChange={(e) => updateQuickNav(nav.id, { gradient: e.target.value })} className="input-glass w-full px-3 py-2 text-xs">
                          <option value="from-primary/20 to-accent/20">Primary → Accent</option>
                          <option value="from-blue-500/20 to-cyan-500/20">Blue → Cyan</option>
                          <option value="from-purple-500/20 to-pink-500/20">Purple → Pink</option>
                          <option value="from-green-500/20 to-emerald-500/20">Green → Emerald</option>
                          <option value="from-orange-500/20 to-red-500/20">Orange → Red</option>
                          <option value="from-yellow-500/20 to-amber-500/20">Yellow → Amber</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึก Quick Nav</button>
    </div>
  );
};

export default AdminQuickNavTab;
