import { useState } from "react";
import { Save, Columns, LayoutGrid, Eye, Monitor, Sparkles, Search, History, Layout } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import type { LayoutConfig } from "@/contexts/SiteSettingsContext";
import AdminCardPreview from "./AdminCardPreview";

const AdminLayoutTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const layoutForm: LayoutConfig = form.layout || {
    categoryCols: { mobile: 2, tablet: 3, desktop: 4 },
    productCols: { mobile: 1, tablet: 2, desktop: 2 },
    featuredCols: { mobile: 2, tablet: 3, desktop: 4 },
    cardStyle: "default",
    sectionSpacing: "normal",
    cardRadius: "xl",
    showProductImage: true,
    productImageRatio: "3:2",
    maxWidth: "6xl",
    hubCols: { mobile: 1, tablet: 2, desktop: 3 },
    productCardVariant: "split",
  };
  const cardVariant = layoutForm.productCardVariant || "split";
  const [previewStatus, setPreviewStatus] = useState<"available" | "updating" | "closed" | "oos">("available");


  const updateLayout = (updates: Partial<LayoutConfig>) => setForm({ ...form, layout: { ...layoutForm, ...updates } });

  const ColsEditor = ({ label, value, onChange }: { label: string; value: { mobile: number; tablet: number; desktop: number }; onChange: (v: { mobile: number; tablet: number; desktop: number }) => void }) => (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-2">
        {(["mobile", "tablet", "desktop"] as const).map((bp) => (
          <div key={bp}>
            <label className="block text-[10px] text-muted-foreground mb-1">{bp === "mobile" ? "📱 มือถือ" : bp === "tablet" ? "📋 แท็บเล็ต" : "🖥️ เดสก์ท็อป"}</label>
            <select value={value[bp]} onChange={(e) => onChange({ ...value, [bp]: parseInt(e.target.value) })} className="input-glass w-full px-3 py-2 text-sm">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} คอลัมน์</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">เลย์เอาท์ & ขนาด UI</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">ปรับแต่งจำนวนคอลัมน์ ขนาด และรูปแบบให้เหมาะกับทุกอุปกรณ์</p>
      </div>

      <div className="glass-card space-y-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Columns size={16} className="text-primary" /> จำนวนคอลัมน์ (Grid)</h3>
        <ColsEditor label="หมวดหมู่สินค้า (หน้าหลัก + ร้านค้า)" value={layoutForm.categoryCols} onChange={(v) => updateLayout({ categoryCols: v })} />
        <ColsEditor label="สินค้าในร้านค้า" value={layoutForm.productCols} onChange={(v) => updateLayout({ productCols: v })} />
        <ColsEditor label="สินค้าแนะนำ (หน้าหลัก)" value={layoutForm.featuredCols} onChange={(v) => updateLayout({ featuredCols: v })} />
        <ColsEditor label="เมนู Hub" value={layoutForm.hubCols} onChange={(v) => updateLayout({ hubCols: v })} />
      </div>

      <div className="glass-card space-y-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><LayoutGrid size={16} className="text-primary" /> รูปแบบ Card</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">ความหนาแน่น</label>
            <select value={layoutForm.cardStyle} onChange={(e) => updateLayout({ cardStyle: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="compact">Compact (แน่น)</option>
              <option value="default">Default (ปกติ)</option>
              <option value="spacious">Spacious (กว้าง)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">มุมโค้ง</label>
            <select value={layoutForm.cardRadius} onChange={(e) => updateLayout({ cardRadius: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="sm">เล็ก (sm)</option>
              <option value="md">กลาง (md)</option>
              <option value="lg">ใหญ่ (lg)</option>
              <option value="xl">ใหญ่มาก (xl)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">ระยะห่าง Section</label>
            <select value={layoutForm.sectionSpacing} onChange={(e) => updateLayout({ sectionSpacing: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="compact">Compact (แน่น)</option>
              <option value="normal">Normal (ปกติ)</option>
              <option value="spacious">Spacious (กว้าง)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">ความกว้างสูงสุด</label>
            <select value={layoutForm.maxWidth} onChange={(e) => updateLayout({ maxWidth: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="4xl">เล็ก (4xl)</option>
              <option value="5xl">กลาง (5xl)</option>
              <option value="6xl">ใหญ่ (6xl)</option>
              <option value="7xl">ใหญ่มาก (7xl)</option>
              <option value="full">เต็มจอ</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══ Card Variant + Live Preview ═══ */}
      <div className="glass-card space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Sparkles size={16} className="text-primary" /> รูปแบบการ์ดสินค้า (Variant)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
            ● Live Preview
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            { v: "split", label: "Split", desc: "รูปซ้าย ข้อมูลขวา" },
            { v: "poster", label: "Poster", desc: "รูปด้านบน ข้อมูลด้านล่าง" },
            { v: "compact", label: "Compact", desc: "แถวเดียว กะทัดรัด" },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => updateLayout({ productCardVariant: opt.v })}
              className={`text-left p-3 rounded-xl border transition-all ${
                cardVariant === opt.v
                  ? "bg-primary/10 border-primary/50 ring-1 ring-primary/40"
                  : "bg-muted/10 border-border/40 hover:border-primary/30"
              }`}
            >
              <p className="text-sm font-bold text-foreground">{opt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>

        {/* Status simulator */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">จำลองสถานะสินค้า</label>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { v: "available", label: "พร้อมขาย" },
              { v: "updating", label: "กำลังอัพเดท" },
              { v: "closed", label: "ปิดการขาย" },
              { v: "oos", label: "สินค้าหมด" },
            ] as const).map((s) => (
              <button
                key={s.v}
                onClick={() => setPreviewStatus(s.v)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  previewStatus === s.v
                    ? "bg-primary/90 text-primary-foreground border-primary"
                    : "bg-muted/20 text-muted-foreground border-border/40 hover:border-primary/40"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview panel */}
        <div className="rounded-2xl border border-dashed border-primary/25 bg-gradient-to-br from-background/60 via-primary/[0.03] to-accent/[0.05] p-5 sm:p-8">
          <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1.5">
            <Eye size={11} /> ตัวอย่างการ์ด — อัปเดตอัตโนมัติเมื่อเปลี่ยนค่า
          </p>
          <div className={`mx-auto ${cardVariant === "compact" ? "max-w-md" : cardVariant === "split" ? "max-w-lg" : "max-w-xs"}`}>
            <AdminCardPreview variant={cardVariant} layout={layoutForm} status={previewStatus} />
          </div>
        </div>
      </div>


      <div className="glass-card space-y-5">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Eye size={16} className="text-primary" /> รูปภาพสินค้า</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-muted/20 border border-border">
            <label className="flex items-center cursor-pointer">
              <div className={`toggle-slider ${layoutForm.showProductImage ? "toggle-active" : ""}`} onClick={() => updateLayout({ showProductImage: !layoutForm.showProductImage })} />
              <span className="text-sm font-semibold text-foreground">แสดงรูปสินค้า</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">อัตราส่วนรูป</label>
            <select value={layoutForm.productImageRatio} onChange={(e) => updateLayout({ productImageRatio: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="1:1">1:1 (สี่เหลี่ยมจัตุรัส)</option>
              <option value="4:3">4:3 (มาตรฐาน)</option>
              <option value="3:2">3:2 (กลาง)</option>
              <option value="16:9">16:9 (แนวนอน)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">โหมดกรอบรูป</label>
            <select value={layoutForm.productImageDisplay || "fixed"} onChange={(e) => updateLayout({ productImageDisplay: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="fixed">Fixed (สูงคงที่ กะทัดรัด)</option>
              <option value="ratio">Aspect Ratio (ตามอัตราส่วนด้านบน)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">การแสดงรูป (Fit)</label>
            <select value={layoutForm.productImageFit || "cover"} onChange={(e) => updateLayout({ productImageFit: e.target.value as any })} className="input-glass w-full px-3 py-2.5 text-sm">
              <option value="cover">Cover (เต็มกรอบ ครอบตัด)</option>
              <option value="contain">Contain (แสดงเต็มรูป ไม่ตัด)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">ซ่อนตัวเลือกสินค้าหลังจาก (รายการ)</label>
            <input
              type="number"
              min={0}
              value={layoutForm.productOptionsCollapseAfter ?? 4}
              onChange={(e) => updateLayout({ productOptionsCollapseAfter: Math.max(0, parseInt(e.target.value) || 0) })}
              className="input-glass w-full px-3 py-2.5 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">หากตัวเลือกของสินค้ามีเกินจำนวนนี้ จะถูกพับซ่อนพร้อมปุ่ม "ดูเพิ่ม" (0 = แสดงทั้งหมด)</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
        <p className="text-xs text-primary font-medium">💡 การเปลี่ยนแปลงจะมีผลทันทีหลังกดบันทึก ลองเปลี่ยนค่าแล้วดูตัวอย่างที่หน้าเว็บ</p>
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกเลย์เอาท์</button>
    </div>
  );
};

export default AdminLayoutTab;
