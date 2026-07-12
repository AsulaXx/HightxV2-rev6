import { useState, useEffect } from "react";
import { Save, Image, Eye, Trash2, Plus, LayoutGrid, Volume2, Sparkles } from "lucide-react";
import AdminSection from "./AdminSection";
import { AdminTabProps } from "./AdminTabProps";
import ImageUploadField from "./ImageUploadField";
import { type HeroBannerConfig, type TickerConfig } from "@/contexts/SiteSettingsContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

const AdminBrandingTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [tickerAnnouncements, setTickerAnnouncements] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    const loadAnn = async () => {
      try {
        const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setTickerAnnouncements(snap.docs.map(d => ({ id: d.id, title: (d.data() as any).title || "" })));
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("AdminBrandingTab.loadAnnouncements", err, "warn"); }
    };
    loadAnn();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logo & Branding</h1>
        <p className="text-sm text-muted-foreground mt-1">ตั้งค่า Logo, ขนาด, Favicon และหน้าแรก</p>
      </div>

      <AdminSection title="Logo" icon={<Image size={18} />}>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">URL Logo</label>
          <div className="flex items-center gap-3">
            <input type="url" value={form.logoUrl || ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="input-glass flex-1 px-4 py-3 text-sm" placeholder="https://..." />
            {form.logoUrl && <img src={form.logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-contain border border-border shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ขนาด Logo ({form.logoSize || 32}px)</label>
          <input type="range" min="16" max="64" step="2" value={form.logoSize || 32} onChange={(e) => setForm({ ...form, logoSize: parseInt(e.target.value) })} className="w-full accent-primary" />
          <div className="mt-2 flex items-center gap-3">
            <div className="glass-panel p-3 rounded-xl inline-flex items-center gap-2">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Preview" style={{ width: form.logoSize || 32, height: form.logoSize || 32 }} className="object-contain" />
              ) : (
                <div style={{ width: form.logoSize || 32, height: form.logoSize || 32 }} className="bg-primary/20 rounded-lg" />
              )}
              <span className="text-sm font-bold text-foreground">{form.brandName}</span>
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Favicon URL</label>
          <input type="url" value={form.faviconUrl || ""} onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="https://... (ถ้าว่างจะใช้ Logo)" />
        </div>
      </AdminSection>

      <AdminSection title="Hero Banner (หน้าแรก)" icon={<Eye size={18} />}>
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={form.heroBanner?.enabled !== false} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), enabled: e.target.checked } })} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm font-medium text-foreground">แสดง Hero Banner</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={form.heroBanner?.showLogo !== false} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), showLogo: e.target.checked } })} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm font-medium text-foreground">แสดง Logo</span>
        </div>

        {form.heroBanner?.showLogo !== false && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">ขนาด Logo ({form.heroBanner?.logoSize || 48}px)</label>
            <input type="range" min="24" max="200" step="4" value={form.heroBanner?.logoSize || 48} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), logoSize: parseInt(e.target.value) } })} className="w-full accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>24px</span><span>200px</span>
            </div>
          </div>
        )}

        {/* Text Lines */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ข้อความ (Typing Effect) — แต่ละบรรทัดจะสลับกัน</label>
          {(form.heroBanner?.textLines || []).map((line: string, i: number) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input type="text" value={line} onChange={(e) => { const lines = [...(form.heroBanner?.textLines || [])]; lines[i] = e.target.value; setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textLines: lines } }); }} className="input-glass flex-1 px-4 py-2.5 text-sm" placeholder={`ข้อความบรรทัดที่ ${i + 1}`} />
              <button onClick={() => { const lines = [...(form.heroBanner?.textLines || [])]; lines.splice(i, 1); setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textLines: lines } }); }} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => { const lines = [...(form.heroBanner?.textLines || []), ""]; setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textLines: lines } }); }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5"><Plus size={12} /> เพิ่มข้อความ</button>
        </div>

        {/* Font Preset */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ฟอนต์</label>
          <select value={form.heroBanner?.fontPreset || "Inter"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), fontPreset: e.target.value } })} className="input-glass w-full px-4 py-3 text-sm">
            <option value="Inter">Inter (Default)</option>
            <option value="'Noto Sans Thai', sans-serif">Noto Sans Thai</option>
            <option value="'Kanit', sans-serif">Kanit</option>
            <option value="'Prompt', sans-serif">Prompt</option>
            <option value="'Sarabun', sans-serif">Sarabun</option>
            <option value="monospace">Monospace</option>
            <option value="'Orbitron', sans-serif">Orbitron (Sci-fi)</option>
            <option value="'Press Start 2P', cursive">Press Start 2P (Pixel)</option>
            <option value="'Fira Code', monospace">Fira Code</option>
            <option value="'Space Mono', monospace">Space Mono</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">* ฟอนต์พิเศษจะต้อง import จาก Google Fonts ด้วย</p>
        </div>

        {/* Font Size */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ขนาดฟอนต์ ({form.heroBanner?.fontSize || 24}px)</label>
          <input type="range" min="14" max="64" step="2" value={form.heroBanner?.fontSize || 24} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), fontSize: parseInt(e.target.value) } })} className="w-full accent-primary" />
        </div>

        {/* Text Alignment */}
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">จัดตำแหน่งข้อความ</label>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((align) => (
              <button key={align} onClick={() => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textAlign: align } })}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${(form.heroBanner?.textAlign || "center") === align ? "bg-primary/15 border-primary/30 text-primary" : "border-border/20 text-muted-foreground hover:bg-muted/20"}`}>
                {align === "left" ? "ซ้าย" : align === "center" ? "กลาง" : "ขวา"}
              </button>
            ))}
          </div>
        </div>

        {/* Text Color */}
        <div className="glass-panel p-4 rounded-xl space-y-4">
          <label className="block text-sm font-semibold text-foreground mb-2">สีข้อความ</label>
          <div className="flex gap-2 mb-3">
            {(["solid", "gradient"] as const).map((mode) => (
              <button key={mode} onClick={() => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textColorMode: mode } })}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${(form.heroBanner?.textColorMode || "solid") === mode ? "bg-primary/15 border-primary/30 text-primary" : "border-border/20 text-muted-foreground hover:bg-muted/20"}`}>
                {mode === "solid" ? "🎨 สีเดียว" : "🌈 Gradient"}
              </button>
            ))}
          </div>

          {(form.heroBanner?.textColorMode || "solid") === "solid" ? (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">สีข้อความ (เว้นว่างใช้สีเริ่มต้น)</label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.heroBanner?.textColor || "#ffffff"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textColor: e.target.value } })} className="w-10 h-10 rounded-lg border border-border/30 cursor-pointer" />
                <input type="text" value={form.heroBanner?.textColor || ""} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textColor: e.target.value } })} className="input-glass flex-1 px-4 py-2.5 text-sm" placeholder="#ffffff หรือเว้นว่าง" />
                {form.heroBanner?.textColor && (
                  <button onClick={() => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textColor: "" } })} className="text-xs text-muted-foreground hover:text-foreground">รีเซ็ต</button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-foreground mb-1.5">สีเริ่มต้น</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.heroBanner?.textGradientFrom || "#6366f1"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textGradientFrom: e.target.value } })} className="w-8 h-8 rounded-lg border border-border/30 cursor-pointer" />
                    <input type="text" value={form.heroBanner?.textGradientFrom || "#6366f1"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textGradientFrom: e.target.value } })} className="input-glass flex-1 px-3 py-2 text-xs" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-foreground mb-1.5">สีปลายทาง</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.heroBanner?.textGradientTo || "#ec4899"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textGradientTo: e.target.value } })} className="w-8 h-8 rounded-lg border border-border/30 cursor-pointer" />
                    <input type="text" value={form.heroBanner?.textGradientTo || "#ec4899"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textGradientTo: e.target.value } })} className="input-glass flex-1 px-3 py-2 text-xs" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">ทิศทาง Gradient</label>
                <select value={form.heroBanner?.textGradientDirection || "to right"} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), textGradientDirection: e.target.value } })} className="input-glass w-full px-4 py-2.5 text-sm">
                  <option value="to right">→ ซ้ายไปขวา</option>
                  <option value="to left">← ขวาไปซ้าย</option>
                  <option value="to bottom">↓ บนลงล่าง</option>
                  <option value="to top">↑ ล่างขึ้นบน</option>
                  <option value="to bottom right">↘ เฉียงขวาล่าง</option>
                  <option value="to top right">↗ เฉียงขวาบน</option>
                </select>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/20">
                <p className="text-xs text-muted-foreground mb-1">ตัวอย่าง:</p>
                <p style={{
                  background: `linear-gradient(${form.heroBanner?.textGradientDirection || "to right"}, ${form.heroBanner?.textGradientFrom || "#6366f1"}, ${form.heroBanner?.textGradientTo || "#ec4899"})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontFamily: form.heroBanner?.fontPreset || "Inter",
                  fontSize: "18px",
                }} className="font-bold">
                  {form.heroBanner?.textLines?.[0] || "ตัวอย่างข้อความ"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-panel p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.heroBanner?.typingEnabled !== false} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), typingEnabled: e.target.checked } })} className="sr-only peer" />
              <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm font-medium text-foreground">Typing Effect ✨</span>
          </div>

          {form.heroBanner?.typingEnabled !== false && (
            <>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">ความเร็วพิมพ์ ({form.heroBanner?.typingSpeed || 80}ms)</label>
                <input type="range" min="20" max="200" step="10" value={form.heroBanner?.typingSpeed || 80} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), typingSpeed: parseInt(e.target.value) } })} className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>เร็ว</span><span>ช้า</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Delay ก่อนลบ ({form.heroBanner?.typingDelay || 1500}ms)</label>
                <input type="range" min="500" max="5000" step="250" value={form.heroBanner?.typingDelay || 1500} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), typingDelay: parseInt(e.target.value) } })} className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0.5 วินาที</span><span>5 วินาที</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.heroBanner?.typingLoop !== false} onChange={(e) => setForm({ ...form, heroBanner: { ...(form.heroBanner || {} as HeroBannerConfig), typingLoop: e.target.checked } })} className="sr-only peer" />
                  <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-xs font-medium text-foreground">เล่นวนซ้ำ</span>
              </div>
            </>
          )}
        </div>
      </AdminSection>

      <AdminSection title="ชื่อหัวข้อหน้าแรก" icon={<LayoutGrid size={18} />} description="ปรับแต่งชื่อและคำอธิบายของแต่ละส่วนในหน้าแรก เว้นว่างเพื่อใช้ค่าเริ่มต้น">
        {[
          { key: "quicknav", defaultTitle: "ลิงก์ด่วน", defaultSub: "ทางลัด" },
          { key: "categories", defaultTitle: "หมวดหมู่สินค้า", defaultSub: "" },
          { key: "featured", defaultTitle: "สินค้าแนะนำ", defaultSub: "" },
          { key: "services", defaultTitle: "บริการอื่นๆ", defaultSub: "" },
          { key: "social", defaultTitle: "ช่องทางติดต่อ", defaultSub: "" },
          { key: "stats", defaultTitle: "สถิติ", defaultSub: "" },
        ].map((section) => (
          <div key={section.key} className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{section.defaultTitle}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form.homeSectionVisibility || {})[section.key] !== false} onChange={(e) => setForm({ ...form, homeSectionVisibility: { ...(form.homeSectionVisibility || {}), [section.key]: e.target.checked } })} className="accent-primary w-4 h-4 rounded" />
                <span className="text-[10px] text-muted-foreground">แสดง</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">ชื่อหัวข้อ</label>
                <input type="text" value={(form.homeSectionTitles || {})[section.key] || ""} onChange={(e) => setForm({ ...form, homeSectionTitles: { ...(form.homeSectionTitles || {}), [section.key]: e.target.value } })} className="input-glass w-full px-3 py-2 text-sm" placeholder={section.defaultTitle} />
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">คำอธิบาย</label>
                <input type="text" value={(form.homeSectionSubtitles || {})[section.key] || ""} onChange={(e) => setForm({ ...form, homeSectionSubtitles: { ...(form.homeSectionSubtitles || {}), [section.key]: e.target.value } })} className="input-glass w-full px-3 py-2 text-sm" placeholder={section.defaultSub || "ไม่มี"} />
              </div>
            </div>
            {section.key === "featured" && (
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1">จำนวนสินค้าที่แสดง</label>
                <input type="number" min={1} max={50} value={form.featuredCount || 8} onChange={(e) => setForm({ ...form, featuredCount: parseInt(e.target.value) || 8 })} className="input-glass w-24 px-3 py-2 text-sm" />
              </div>
            )}
          </div>
        ))}
      </AdminSection>

      <AdminSection title="แถบแจ้งเตือน (Ticker)" icon={<Volume2 size={18} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.ticker?.enabled !== false} onChange={(e) => setForm({ ...form, ticker: { ...(form.ticker || { enabled: true, popupEnabled: true, speed: 30, selectedIds: [] }), enabled: e.target.checked } })} className="sr-only peer" />
              <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm font-medium text-foreground">แสดงแถบแจ้งเตือน</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.ticker?.popupEnabled !== false} onChange={(e) => setForm({ ...form, ticker: { ...(form.ticker || { enabled: true, popupEnabled: true, speed: 30, selectedIds: [] }), popupEnabled: e.target.checked } })} className="sr-only peer" />
              <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
            </label>
            <span className="text-sm font-medium text-foreground">แสดง Popup ประกาศ</span>
          </div>
        </div>

        {form.ticker?.enabled !== false && (
          <>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ความเร็วลูป ({form.ticker?.speed || 30} วินาที)</label>
              <input type="range" min="5" max="120" step="5" value={form.ticker?.speed || 30} onChange={(e) => setForm({ ...form, ticker: { ...(form.ticker || { enabled: true, popupEnabled: true, speed: 30, selectedIds: [] }), speed: parseInt(e.target.value) } })} className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>เร็ว (5s)</span><span>ช้า (120s)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">เลือกประกาศที่จะแสดง</label>
              <p className="text-xs text-muted-foreground mb-3">ถ้าไม่เลือก จะแสดงทั้งหมด</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tickerAnnouncements.map((ann) => {
                  const selected = form.ticker?.selectedIds || [];
                  const isSelected = selected.includes(ann.id);
                  return (
                    <label key={ann.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border-primary/30" : "border-border/20 hover:bg-muted/20"}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => {
                        const newIds = isSelected ? selected.filter((id: string) => id !== ann.id) : [...selected, ann.id];
                        setForm({ ...form, ticker: { ...(form.ticker || { enabled: true, popupEnabled: true, speed: 30, selectedIds: [] }), selectedIds: newIds } });
                      }} className="accent-primary w-4 h-4" />
                      <span className="text-sm text-foreground truncate">{ann.title}</span>
                    </label>
                  );
                })}
                {tickerAnnouncements.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีประกาศ</p>
                )}
              </div>
            </div>
          </>
        )}
      </AdminSection>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
        <Save size={16} /> บันทึก Branding
      </button>
    </div>
  );
};

export default AdminBrandingTab;
