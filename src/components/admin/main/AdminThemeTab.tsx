import { useState } from "react";
import { Save, Image, Palette, Sparkles } from "lucide-react";
import AdminSection from "../shared/AdminSection";
import { AdminTabProps } from "../shared/AdminTabProps";
import { type ParticlesConfig } from "@/contexts/SiteSettingsContext";
import ImageUploadField from "../shared/ImageUploadField";

const hslToHex = (hslStr: string): string => {
  try {
    const parts = hslStr.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return "#6366f1";
    const h = parseFloat(parts[0]);
    const s = parseFloat(parts[1]) / 100;
    const l = parseFloat(parts[2]) / 100;
    const a2 = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return "#6366f1"; }
};

const hexToHsl = (hex: string): string => {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
        case g: h = ((b - r) / d + 2) * 60; break;
        case b: h = ((r - g) / d + 4) * 60; break;
      }
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  } catch { return "234 85% 65%"; }
};

const COLOR_PRESETS = [
  { name: "🌌 ค่าเริ่มต้น", primary: "234 85% 65%", secondary: "270 60% 55%", accent: "300 70% 70%" },
  { name: "🔥 ไฟแดง", primary: "0 80% 55%", secondary: "25 90% 55%", accent: "45 95% 60%" },
  { name: "🌊 มหาสมุทร", primary: "200 80% 50%", secondary: "220 70% 45%", accent: "180 60% 55%" },
  { name: "🌿 ธรรมชาติ", primary: "140 60% 45%", secondary: "160 50% 40%", accent: "80 60% 55%" },
  { name: "🌸 ซากุระ", primary: "330 70% 65%", secondary: "350 60% 55%", accent: "300 50% 70%" },
  { name: "☀️ พระอาทิตย์", primary: "35 90% 55%", secondary: "15 80% 50%", accent: "50 95% 60%" },
  { name: "🍇 องุ่น", primary: "280 70% 55%", secondary: "300 60% 50%", accent: "260 50% 65%" },
  { name: "🖤 มินิมอล", primary: "220 10% 50%", secondary: "220 15% 40%", accent: "220 20% 60%" },
  { name: "🌅 ซันเซ็ต", primary: "12 90% 58%", secondary: "340 75% 55%", accent: "45 90% 55%" },
  { name: "💎 ไซเบอร์", primary: "180 100% 45%", secondary: "260 80% 60%", accent: "320 70% 55%" },
  { name: "🍂 ฤดูใบไม้ร่วง", primary: "25 70% 48%", secondary: "15 60% 40%", accent: "45 65% 55%" },
  { name: "🧊 น้ำแข็ง", primary: "195 85% 55%", secondary: "210 70% 50%", accent: "175 60% 60%" },
];

const FONT_PRESETS = [
  { name: "ค่าเริ่มต้น", heading: '"Space Grotesk"', body: '"Inter"', sample: "Space Grotesk" },
  { name: "สะอาดตา", heading: '"Poppins"', body: '"Nunito"', sample: "Poppins" },
  { name: "เรโทร", heading: '"Press Start 2P"', body: '"VT323"', sample: "Press Start 2P" },
  { name: "หรูหรา", heading: '"Playfair Display"', body: '"Lora"', sample: "Playfair Display" },
  { name: "ทันสมัย", heading: '"Outfit"', body: '"DM Sans"', sample: "Outfit" },
  { name: "เรียบง่าย", heading: '"IBM Plex Sans"', body: '"IBM Plex Sans"', sample: "IBM Plex Sans" },
  { name: "เกมมิ่ง", heading: '"Orbitron"', body: '"Rajdhani"', sample: "Orbitron" },
  { name: "มินิมอล", heading: '"Montserrat"', body: '"Source Sans 3"', sample: "Montserrat" },
  // —— Sans-serif TH+EN (อังกฤษสวย + ไทยไม่มีหัว) ——
  { name: "🌐 Inter + Prompt", heading: '"Inter", "Prompt"', body: '"Inter", "Prompt"', sample: "Inter + Prompt ไทย/EN" },
  { name: "🌐 Poppins + Kanit", heading: '"Poppins", "Kanit"', body: '"Poppins", "Kanit"', sample: "Poppins + Kanit ไทย/EN" },
  { name: "🌐 Outfit + Anuphan", heading: '"Outfit", "Anuphan"', body: '"DM Sans", "Anuphan"', sample: "Outfit + Anuphan ไทย/EN" },
  { name: "🌐 Sora + K2D", heading: '"Sora", "K2D"', body: '"Sora", "K2D"', sample: "Sora + K2D ไทย/EN" },
  { name: "🌐 Space Grotesk + Bai Jamjuree", heading: '"Space Grotesk", "Bai Jamjuree"', body: '"Inter", "Bai Jamjuree"', sample: "Space Grotesk + Bai Jamjuree" },
  { name: "🌐 Montserrat + Mitr", heading: '"Montserrat", "Mitr"', body: '"Source Sans 3", "Mitr"', sample: "Montserrat + Mitr ไทย/EN" },
  { name: "🌐 IBM Plex (TH+EN)", heading: '"IBM Plex Sans", "IBM Plex Sans Thai"', body: '"IBM Plex Sans", "IBM Plex Sans Thai"', sample: "IBM Plex ไทย/EN" },
  { name: "🌐 Chakra Petch (TH+EN)", heading: '"Chakra Petch"', body: '"Chakra Petch"', sample: "Chakra Petch ไทย/EN" },
  // —— Thai loopless (ไม่มีหัว) ——
  { name: "🇹🇭 ไทยมินิมอล", heading: '"Prompt"', body: '"Prompt"', sample: "ไทยมินิมอล Prompt" },
  { name: "🇹🇭 ไทยโมเดิร์น", heading: '"Kanit"', body: '"Sarabun"', sample: "ไทยโมเดิร์น Kanit" },
  { name: "🇹🇭 ไทยคม", heading: '"Bai Jamjuree"', body: '"Bai Jamjuree"', sample: "ไทยคม Bai Jamjuree" },
  { name: "🇹🇭 ไทยนุ่ม", heading: '"K2D"', body: '"K2D"', sample: "ไทยนุ่ม K2D" },
  { name: "🇹🇭 ไทยซอฟต์", heading: '"Krub"', body: '"Krub"', sample: "ไทยซอฟต์ Krub" },
  { name: "🇹🇭 ไทยกลม", heading: '"Mitr"', body: '"Mitr"', sample: "ไทยกลม Mitr" },
  { name: "🇹🇭 ไทยคลีน", heading: '"Anuphan"', body: '"Anuphan"', sample: "ไทยคลีน Anuphan" },
  { name: "🇹🇭 ไทยบาง", heading: '"Athiti"', body: '"Athiti"', sample: "ไทยบาง Athiti" },
  { name: "🇹🇭 ไทยเทค", heading: '"Chakra Petch"', body: '"IBM Plex Sans Thai"', sample: "ไทยเทค Chakra Petch" },
  { name: "🇹🇭 ไทยพรีเมียม", heading: '"IBM Plex Sans Thai"', body: '"IBM Plex Sans Thai"', sample: "ไทยพรีเมียม IBM Plex" },
  // —— สไตล์เว็บ VersX (thai-rg) ——
  { name: "🔥 VersX Style (thai-rg)", heading: '"Thai-RG", "Noto Sans Thai", "Sarabun", "Inter"', body: '"Thai-RG", "Noto Sans Thai", "Sarabun", "Inter"', sample: "VersX Style thai-rg ไทย/EN" },
];

const AdminThemeTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [colorInputMode, setColorInputMode] = useState<"hsl" | "hex" | "rgb">("hex");

  const hslToRgb = (hslStr: string): { r: number; g: number; b: number } => {
    try {
      const hex = hslToHex(hslStr);
      return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
    } catch { return { r: 99, g: 102, b: 241 }; }
  };

  const rgbToHsl = (r: number, g: number, b: number): string => {
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    return hexToHsl(hex);
  };

  const DirectColorPicker = ({ label, value, onChange, defaultVal = "234 85% 65%" }: { label: string; value: string; onChange: (v: string) => void; defaultVal?: string }) => {
    const currentHex = hslToHex(value || defaultVal);
    const currentRgb = hslToRgb(value || defaultVal);
    return (
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">{label}</label>
        <div className="flex items-center gap-3">
          <input type="color" value={currentHex} onInput={(e) => onChange(hexToHsl((e.target as HTMLInputElement).value))} onChange={(e) => onChange(hexToHsl(e.target.value))} className="h-10 w-10 shrink-0 rounded-xl border-2 border-border bg-transparent cursor-pointer" />
          <div className="flex-1 space-y-1">
            <div className="flex gap-1">
              {(["hex", "hsl", "rgb"] as const).map((m) => (
                <button key={m} onClick={() => setColorInputMode(m)} className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all ${colorInputMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{m}</button>
              ))}
            </div>
            {colorInputMode === "hex" && (
              <input type="text" value={currentHex} onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(hexToHsl(v)); }} className="input-glass w-full px-3 py-2 text-xs font-mono" placeholder="#6366f1" />
            )}
            {colorInputMode === "hsl" && (
              <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="input-glass w-full px-3 py-2 text-xs font-mono" placeholder={defaultVal} />
            )}
            {colorInputMode === "rgb" && (
              <div className="flex gap-1.5">
                {(["r", "g", "b"] as const).map((ch) => (
                  <div key={ch} className="flex-1">
                    <label className="block text-[8px] text-muted-foreground mb-0.5 uppercase">{ch}</label>
                    <input type="number" min="0" max="255" value={currentRgb[ch]} onChange={(e) => { const newRgb = { ...currentRgb, [ch]: Math.min(255, Math.max(0, parseInt(e.target.value) || 0)) }; onChange(rgbToHsl(newRgb.r, newRgb.g, newRgb.b)); }} className="input-glass w-full px-2 py-1.5 text-xs text-center font-mono" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ธีมและพื้นหลัง</h1>
        <p className="text-sm text-muted-foreground mt-1">ปรับแต่งสี ฟอนต์ พื้นหลัง และเอฟเฟกต์</p>
      </div>


      <AdminSection title="สีและฟอนต์" icon={<Palette size={18} />}>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">Preset สี</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => setForm({ ...form, theme: { ...form.theme, primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent } })}
                className="btn-glass p-3 rounded-xl text-xs font-semibold text-left space-y-2 hover:border-primary/30">
                <span>{preset.name}</span>
                <div className="flex gap-1">
                  <div className="w-5 h-5 rounded-lg" style={{ background: `hsl(${preset.primary})` }} />
                  <div className="w-5 h-5 rounded-lg" style={{ background: `hsl(${preset.secondary})` }} />
                  <div className="w-5 h-5 rounded-lg" style={{ background: `hsl(${preset.accent})` }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-3">Preset ฟอนต์</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FONT_PRESETS.map((preset) => (
              <button key={preset.name} onClick={() => setForm({ ...form, theme: { ...form.theme, fontHeading: preset.heading, fontBody: preset.body } as any })}
                className="btn-glass p-3 rounded-xl text-left hover:border-primary/30 space-y-1.5">
                <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                <p style={{ fontFamily: `${preset.sample}, sans-serif` }} className="text-sm font-bold text-foreground leading-tight">{preset.sample}</p>
                <p className="text-[10px] text-muted-foreground">H: {preset.heading.replace(/"/g, '')} / B: {preset.body.replace(/"/g, '')}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <DirectColorPicker label="สีหลัก (Primary)" value={form.theme?.primaryColor || "234 85% 65%"} onChange={(v) => setForm({ ...form, theme: { ...form.theme, primaryColor: v } })} />
          <DirectColorPicker label="สีรอง (Secondary)" value={form.theme?.secondaryColor || "270 60% 55%"} onChange={(v) => setForm({ ...form, theme: { ...form.theme, secondaryColor: v } })} />
          <DirectColorPicker label="สีเน้น (Accent)" value={form.theme?.accentColor || "300 70% 70%"} onChange={(v) => setForm({ ...form, theme: { ...form.theme, accentColor: v } })} />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ตัวอย่าง Gradient</label>
          <div className="h-14 rounded-2xl" style={{ background: `linear-gradient(135deg, hsl(${form.theme?.primaryColor}) 0%, hsl(${form.theme?.secondaryColor}) 50%, hsl(${form.theme?.accentColor || "300 70% 70%"}) 100%)` }} />
        </div>
      </AdminSection>

      <AdminSection title="พื้นหลังเว็บไซต์" icon={<Image size={16} />}>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">ลำดับเลเยอร์</label>
          <div className="flex gap-2">
            <button onClick={() => setForm({ ...form, theme: { ...form.theme, backgroundLayerOrder: "image-on-top" } })} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold ${form.theme?.backgroundLayerOrder === "image-on-top" || !form.theme?.backgroundLayerOrder ? "btn-gradient" : "btn-glass"}`}>รูปอยู่บน</button>
            <button onClick={() => setForm({ ...form, theme: { ...form.theme, backgroundLayerOrder: "color-on-top" } })} className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold ${form.theme?.backgroundLayerOrder === "color-on-top" ? "btn-gradient" : "btn-glass"}`}>สีอยู่บน</button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">สีพื้นหลัง (HSL)</label>
          <div className="flex items-center gap-3">
            <input type="color" value={hslToHex(form.theme?.backgroundColor || "230 25% 10%")} onChange={(e) => setForm({ ...form, theme: { ...form.theme, backgroundColor: hexToHsl(e.target.value) } })} className="h-10 w-10 shrink-0 rounded-xl border-2 border-border bg-transparent cursor-pointer" />
            <input type="text" value={form.theme?.backgroundColor || ""} onChange={(e) => setForm({ ...form, theme: { ...form.theme, backgroundColor: e.target.value } })} className="input-glass flex-1 px-3 py-2.5 text-sm font-mono" placeholder="เว้นว่าง = ไม่ใช้" />
            {form.theme?.backgroundColor && <button onClick={() => setForm({ ...form, theme: { ...form.theme, backgroundColor: "" } })} className="btn-glass px-3 py-2 text-xs">ล้าง</button>}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">รูปพื้นหลัง</label>
          <ImageUploadField value={form.theme?.backgroundImage || ""} onChange={(url) => setForm({ ...form, theme: { ...form.theme, backgroundImage: url } })} folder="theme-bg" maxSizeMB={8} compact />
        </div>
        {form.theme?.backgroundImage && (
          <div className="rounded-xl overflow-hidden border border-border h-32 relative">
            <img src={form.theme.backgroundImage} alt="Preview" className="w-full h-full object-cover" style={{ opacity: form.theme?.backgroundOpacity || 0.3, filter: form.theme?.backgroundBlur ? `blur(${form.theme.backgroundBlur}px)` : undefined }} />
            <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs font-bold text-foreground bg-background/70 px-2 py-1 rounded-lg">Preview</span></div>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">ความโปร่งแสง ({Math.round((form.theme?.backgroundOpacity || 0.3) * 100)}%)</label>
          <input type="range" min="0" max="1" step="0.05" value={form.theme?.backgroundOpacity || 0.3} onChange={(e) => setForm({ ...form, theme: { ...form.theme, backgroundOpacity: parseFloat(e.target.value) } })} className="w-full accent-primary" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">ความเบลอ ({form.theme?.backgroundBlur || 0}px)</label>
          <input type="range" min="0" max="20" step="1" value={form.theme?.backgroundBlur || 0} onChange={(e) => setForm({ ...form, theme: { ...form.theme, backgroundBlur: parseInt(e.target.value) } })} className="w-full accent-primary" />
        </div>
      </AdminSection>

      <AdminSection title="เอฟเฟกต์ 3D" icon={<Sparkles size={18} />}>
        <p className="text-xs text-muted-foreground -mt-1">ควบคุมความแรง glow, มุมเอียง tilt และสี gradient — มีผลทั้งเว็บทันที</p>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            ความแรง Glow ({form.theme?.fx3d?.glow ?? 55}%)
          </label>
          <input
            type="range" min="0" max="100" step="5"
            value={form.theme?.fx3d?.glow ?? 55}
            onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), glow: parseInt(e.target.value) } } })}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">
            มุมเอียง Tilt ({form.theme?.fx3d?.tilt ?? 3}°)
          </label>
          <input
            type="range" min="0" max="8" step="0.5"
            value={form.theme?.fx3d?.tilt ?? 3}
            onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), tilt: parseFloat(e.target.value) } } })}
            className="w-full accent-primary"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">Gradient From</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.theme?.fx3d?.gradientFrom || "#6366f1"}
                onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), gradientFrom: e.target.value } } })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={form.theme?.fx3d?.gradientFrom || "#6366f1"}
                onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), gradientFrom: e.target.value } } })}
                className="input-glass flex-1 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">Gradient To</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.theme?.fx3d?.gradientTo || "#a855f7"}
                onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), gradientTo: e.target.value } } })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={form.theme?.fx3d?.gradientTo || "#a855f7"}
                onChange={(e) => setForm({ ...form, theme: { ...form.theme, fx3d: { ...(form.theme?.fx3d || { glow: 55, tilt: 3, gradientFrom: "#6366f1", gradientTo: "#a855f7" }), gradientTo: e.target.value } } })}
                className="input-glass flex-1 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>
        </div>
        {/* Live preview */}
        <div className="glass-card glass-card-hover mt-1 !p-4 text-center space-y-2">
          <div className="text-xs text-muted-foreground">ตัวอย่าง</div>
          <div className="gradient-text text-xl font-bold">Liquid Glass 3D</div>
          <button type="button" className="btn-gradient px-4 py-2 text-xs">ปุ่มตัวอย่าง</button>
        </div>
      </AdminSection>

      <AdminSection title="อนุภาคพื้นหลัง" icon={<Sparkles size={16} />}
        headerRight={<div onClick={() => setForm({ ...form, theme: { ...form.theme, particles: { ...(form.theme?.particles || { count: 40, speed: 0.5, size: 2, color: "255, 255, 255", opacity: 0.5, linked: false, linkDistance: 120 }), enabled: !form.theme?.particles?.enabled } as ParticlesConfig } })} className={`toggle-slider ${form.theme?.particles?.enabled ? "toggle-active" : ""}`} />}
      >
        {form.theme?.particles?.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">รูปแบบ</label>
              <select value={form.theme.particles.mode || "default"} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, mode: e.target.value as any } } })} className="input-glass w-full px-3 py-2.5 text-sm">
                <option value="default">✨ ปกติ</option>
                <option value="snow">❄️ หิมะ</option>
                <option value="stars">⭐ ดาว</option>
                <option value="bubbles">🫧 ฟองสบู่</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">จำนวน ({form.theme.particles.count ?? 40})</label>
              <input type="range" min="5" max="150" step="5" value={form.theme.particles.count ?? 40} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, count: parseInt(e.target.value) } } })} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">ความเร็ว ({form.theme.particles.speed ?? 0.5})</label>
              <input type="range" min="0.1" max="3" step="0.1" value={form.theme.particles.speed ?? 0.5} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, speed: parseFloat(e.target.value) } } })} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">ขนาด ({form.theme.particles.size ?? 2})</label>
              <input type="range" min="0.5" max="6" step="0.5" value={form.theme.particles.size ?? 2} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, size: parseFloat(e.target.value) } } })} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">ความโปร่งแสง ({Math.round((form.theme.particles.opacity ?? 0.5) * 100)}%)</label>
              <input type="range" min="0.05" max="1" step="0.05" value={form.theme.particles.opacity ?? 0.5} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, opacity: parseFloat(e.target.value) } } })} className="w-full accent-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">สี</label>
              <select value={form.theme.particles.color || "auto"} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, color: e.target.value } } })} className="input-glass w-full px-3 py-2.5 text-sm">
                <option value="auto">อัตโนมัติ</option>
                <option value="255, 255, 255">ขาว</option>
                <option value="99, 102, 241">น้ำเงิน</option>
                <option value="168, 85, 247">ม่วง</option>
                <option value="236, 72, 153">ชมพู</option>
                <option value="34, 197, 94">เขียว</option>
              </select>
            </div>
            {(form.theme.particles.mode || "default") === "default" && (
              <>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">เชื่อมเส้น</label>
                  <div onClick={() => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, linked: !form.theme.particles!.linked } } })} className={`toggle-slider ${form.theme.particles.linked ? "toggle-active" : ""}`} />
                </div>
                {form.theme.particles.linked && (
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">ระยะเชื่อม ({form.theme.particles.linkDistance ?? 120}px)</label>
                    <input type="range" min="50" max="300" step="10" value={form.theme.particles.linkDistance ?? 120} onChange={(e) => setForm({ ...form, theme: { ...form.theme, particles: { ...form.theme.particles!, linkDistance: parseInt(e.target.value) } } })} className="w-full accent-primary" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </AdminSection>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
        <Save size={16} /> บันทึกธีม
      </button>
    </div>
  );
};

export default AdminThemeTab;
