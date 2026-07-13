import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { BackgroundEffect, LoaderStyle } from "@/contexts/SiteSettingsContext";
import Loader from "@/components/Loader";
import { Sparkles, Grid3x3, Waves, CircleDot, Layers, Terminal, Command, UserCog, LogOut, Save, Zap, Gauge, Leaf, Cpu, Eye, EyeOff, Palette, RefreshCw, Stars, Cloud, CloudRain, Box } from "lucide-react";
import { usePerformanceMode, setPerformancePreview, type PerformanceMode } from "@/hooks/usePerformanceMode";

interface Props {
  form: any;
  setForm: (v: any) => void;
  handleSave: () => void;
}

const EFFECTS: { id: BackgroundEffect; label: string; icon: any; desc: string }[] = [
  { id: "none",      label: "ไม่มี",       icon: Sparkles,  desc: "ปิดเอฟเฟกต์" },
  { id: "grid",      label: "Grid",        icon: Grid3x3,   desc: "ตารางเรืองแสง" },
  { id: "dots",      label: "Dots",        icon: CircleDot, desc: "จุดๆ แบบพิมพ์เขียว" },
  { id: "waves",     label: "Waves",       icon: Waves,     desc: "คลื่นเคลื่อนไหว" },
  { id: "aurora",    label: "Aurora",      icon: Layers,    desc: "แสงเหนือลอย" },
  { id: "matrix",    label: "Matrix",      icon: Terminal,  desc: "ตัวอักษรตก" },
  { id: "starfield", label: "Starfield 3D",icon: Stars,     desc: "ดาววิ่งลึกเข้าออกจอ" },
  { id: "mesh",      label: "Gradient Mesh",icon: Cloud,    desc: "ก้อนสีนุ่มไหลช้าๆ" },
  { id: "noise",     label: "Noise/Grain", icon: Sparkles,  desc: "เม็ดฟิล์มเพิ่ม depth" },
  { id: "ripple",    label: "Ripple Pulse",icon: CloudRain, desc: "วงกลม pulse ออกจากจุดสุ่ม" },
];

const LOADERS: { id: LoaderStyle; label: string }[] = [
  { id: "atom",    label: "Atom" },
  { id: "ring",    label: "Ring" },
  { id: "dots",    label: "Dots" },
  { id: "bars",    label: "Bars" },
  { id: "pulse",   label: "Pulse" },
  { id: "orbit",   label: "Orbit" },
  { id: "quantum", label: "Quantum" },
  { id: "wave",    label: "Wave" },
  { id: "nebula",  label: "Nebula" },
  { id: "cube3d",  label: "Cube 3D" },
];

const AdminEffectsTab = ({ form, setForm, handleSave }: Props) => {
  const { realProfile, startImpersonation, stopImpersonation, impersonating, profile } = useAuth();
  const isOwner = realProfile?.role === "owner";
  const [impUid, setImpUid] = useState("");

  const theme = form.theme || {};
  const bg = theme.bgEffect || { effect: "none", opacity: 0.35, color: "auto", speed: 1 };

  const setBg = (patch: Partial<typeof bg>) =>
    setForm({ ...form, theme: { ...theme, bgEffect: { ...bg, ...patch } } });

  const setLoader = (l: LoaderStyle) =>
    setForm({ ...form, theme: { ...theme, loaderStyle: l } });

  const setPalette = (v: boolean) =>
    setForm({ ...form, theme: { ...theme, commandPaletteEnabled: v } });

  const perfMode: PerformanceMode = theme.performanceMode || "auto";
  const setPerf = (m: PerformanceMode) =>
    setForm({ ...form, theme: { ...theme, performanceMode: m } });
  const perf = usePerformanceMode();

  const PERF_OPTS: { id: PerformanceMode; label: string; icon: any; desc: string }[] = [
    { id: "auto",     label: "อัตโนมัติ", icon: Cpu,   desc: "ปรับตามอุปกรณ์" },
    { id: "high",     label: "เต็มพลัง",  icon: Zap,   desc: "แสดงเอฟเฟกต์ทุกอย่าง" },
    { id: "balanced", label: "สมดุล",     icon: Gauge, desc: "ลดจำนวน/ความเร็ว 40-50%" },
    { id: "saver",    label: "ประหยัด",   icon: Leaf,  desc: "ปิดเอฟเฟกต์หนักทั้งหมด" },
  ];

  // Clear any active preview when leaving the tab
  useEffect(() => () => setPerformancePreview(null), []);

  const doImpersonate = async () => {
    if (!impUid.trim()) return;
    try {
      await startImpersonation(impUid.trim());
      toast.success("เริ่ม impersonate แล้ว");
      setImpUid("");
    } catch (e: any) {
      toast.error(e?.message || "ไม่สามารถ impersonate ได้");
    }
  };

  // UI Version preset (V1 = Liquid Glass, V2 = Awang Violet)
  const uiVersion: "v1" | "v2" = form.uiVersion === "v2" ? "v2" : "v1";
  const [uiPreview, setUiPreview] = useState<"v1" | "v2" | null>(null);
  const setUiVersion = (v: "v1" | "v2") => setForm({ ...form, uiVersion: v });
  useEffect(() => {
    if (uiPreview) document.documentElement.setAttribute("data-ui-version", uiPreview);
    return () => {
      // restore saved
      document.documentElement.setAttribute("data-ui-version", uiVersion);
    };
  }, [uiPreview, uiVersion]);

  const UI_PRESETS = [
    {
      id: "v1" as const,
      label: "V1 — Liquid Glass",
      desc: "โทนเดิม กระจกเบลอ ม่วง-ครามอ่อน",
      swatch: ["#6366f1", "#a855f7", "#c4b5fd", "#1e1b4b"],
    },
    {
      id: "v2" as const,
      label: "Main Preset Hx",
      desc: "พรีเซ็ตหลักของ Hx — ดำสนิท ม่วงนีออน solid card ปุ่ม pill",
      swatch: ["#7c3aed", "#a855f7", "#c084fc", "#0a0510"],
    },
  ];

  return (
    <div className="space-y-6">

      {/* UI Preset — V1 / V2 with realtime preview */}
      <section className="glass-card !p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-primary" />
          <h3 className="text-sm font-bold">รูปแบบ UI ทั้งเว็บ (Global Preset)</h3>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            บันทึกไว้: {uiVersion.toUpperCase()}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          เปลี่ยนหน้าตาทั้งเว็บทีเดียว เอฟเฟกต์และสีจะปรับตาม preset ที่เลือก
          <b> วางเมาส์เพื่อพรีวิวสด</b> — กด "ตั้งเป็นค่านี้" เพื่อบันทึก จากนั้นกดปุ่มบันทึกด้านล่าง
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {UI_PRESETS.map((p) => {
            const isSaved = uiVersion === p.id;
            const isPreviewing = uiPreview === p.id;
            return (
              <div
                key={p.id}
                onMouseEnter={() => setUiPreview(p.id)}
                onMouseLeave={() => setUiPreview(null)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSaved
                    ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                    : isPreviewing
                    ? "border-amber-500/60 bg-amber-500/10"
                    : "border-border/50 bg-muted/20 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    {p.swatch.map((c) => (
                      <span key={c} className="w-4 h-4 rounded-full ring-1 ring-black/30" style={{ background: c }} />
                    ))}
                  </div>
                  {isSaved && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary">ใช้อยู่</span>}
                  {!isSaved && isPreviewing && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">กำลังพรีวิว</span>}
                </div>
                <div className="text-sm font-bold text-foreground">{p.label}</div>
                <div className="text-[11px] text-muted-foreground mt-1 mb-3">{p.desc}</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setUiVersion(p.id); setUiPreview(null); toast.success(`เลือก ${p.label} แล้ว — อย่าลืมกดบันทึก`); }}
                  disabled={isSaved}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                    isSaved
                      ? "bg-muted/40 text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:brightness-110"
                  }`}
                >
                  {isSaved ? "ค่านี้ถูกใช้อยู่" : "ตั้งเป็นค่านี้"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-border/50 hover:border-primary/40 hover:bg-muted/30 transition-colors"
          >
            <RefreshCw size={12} /> รีเฟรชหน้าเพื่อดูผลเต็มรูปแบบ
          </button>
          <span className="text-[10px] text-muted-foreground">
            แนะนำให้รีเฟรชหลังบันทึก เพื่อให้ทุกหน้าอัปเดตพร้อมกัน
          </span>
        </div>
      </section>




      {/* Performance Mode */}
      <section className="glass-card !p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-primary" />
          <h3 className="text-sm font-bold">โหมดประหยัดทรัพยากร</h3>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            ตอนนี้: {perf.mode.toUpperCase()}
            {perfMode === "auto" && <span className="opacity-60"> (ตรวจจาก {perf.detected})</span>}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ปิดหรือย่อเอฟเฟกต์ที่กิน GPU/CPU (Glow, Particles, Waves, Matrix…) โหมด <b>อัตโนมัติ</b> จะเลือกให้เองจาก
          จำนวน core, RAM, การเชื่อมต่อ, save-data และ reduced-motion ของผู้ใช้
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PERF_OPTS.map((o) => {
            const active = perfMode === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setPerf(o.id)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <o.icon size={16} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{o.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{o.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Real-time preview */}
        <div className="pt-3 mt-1 border-t border-border/40 space-y-2">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-primary" />
            <span className="text-[11px] font-semibold">พรีวิวแบบเรียลไทม์ (ไม่บันทึก)</span>
            {perf.isPreviewing && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">
                กำลังพรีวิว: {perf.preview?.toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERF_OPTS.map((o) => {
              const active = perf.preview === o.id;
              return (
                <button
                  key={o.id}
                  onMouseEnter={() => { if (!perf.isPreviewing) setPerformancePreview(o.id); }}
                  onMouseLeave={() => { if (perf.preview === o.id) setPerformancePreview(null); }}
                  onClick={() => setPerformancePreview(active ? null : o.id)}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                    active
                      ? "border-amber-500/60 bg-amber-500/15 text-amber-300"
                      : "border-border/40 hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  title="hover เพื่อดูชั่วคราว, คลิกเพื่อล็อกพรีวิว"
                >
                  <o.icon size={12} />
                  {o.label}
                </button>
              );
            })}
            <button
              onClick={() => setPerformancePreview(null)}
              disabled={!perf.isPreviewing}
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border border-border/40 hover:bg-muted/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <EyeOff size={12} /> ปิดพรีวิว
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            เอาเมาส์ไปวางเพื่อดูชั่วขณะ • คลิกเพื่อล็อกไว้ทดสอบ • กด <b>บันทึก</b> ด้านล่างเพื่อใช้จริง
          </p>
        </div>
      </section>

      {/* Backgrounds */}
      <section className="glass-card !p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-bold">พื้นหลัง / เอฟเฟกต์</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EFFECTS.map((e) => {
            const active = bg.effect === e.id;
            return (
              <button
                key={e.id}
                onClick={() => setBg({ effect: e.id })}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <e.icon size={16} />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{e.label}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{e.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {bg.effect !== "none" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">ความเข้ม ({Math.round((bg.opacity ?? 0.35) * 100)}%)</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={bg.opacity ?? 0.35}
                onChange={(e) => setBg({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">ความเร็ว ({(bg.speed ?? 1).toFixed(1)}x)</span>
              <input
                type="range" min={0.1} max={3} step={0.1}
                value={bg.speed ?? 1}
                onChange={(e) => setBg({ speed: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">สี</span>
              <div className="flex gap-1.5">
                <input
                  type="color"
                  value={bg.color?.startsWith("#") ? bg.color : "#ffffff"}
                  onChange={(e) => setBg({ color: e.target.value })}
                  className="h-9 w-12 rounded-lg bg-transparent border border-border/40 cursor-pointer"
                />
                <button
                  onClick={() => setBg({ color: "auto" })}
                  className={`flex-1 text-xs rounded-lg border px-2 ${bg.color === "auto" ? "border-primary text-primary bg-primary/10" : "border-border/40"}`}
                >
                  Auto (จากธีม)
                </button>
              </div>
            </label>
          </div>
        )}
      </section>

      {/* Loaders */}
      <section className="glass-card !p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-sm font-bold">ตัวโหลด (Loader)</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LOADERS.map((l) => {
            const active = (theme.loaderStyle || "atom") === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLoader(l.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/40 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className="h-16 flex items-center justify-center">
                  <Loader style={l.id} size={48} />
                </div>
                <span className="text-xs font-semibold">{l.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Command Palette */}
      <section className="glass-card !p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Command size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Command Palette (Cmd/Ctrl + K)</h3>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={theme.commandPaletteEnabled !== false}
            onChange={(e) => setPalette(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <div>
            <div className="text-xs font-semibold">เปิดใช้งาน Command Palette</div>
            <div className="text-[11px] text-muted-foreground">ค้นหาสินค้า/ผู้ใช้/หน้าได้เร็วด้วยคีย์ลัด Ctrl+K</div>
          </div>
        </label>
      </section>

      {/* Impersonate (Owner only) */}
      {isOwner && (
        <section className="glass-card !p-5 space-y-3">
          <div className="flex items-center gap-2">
            <UserCog size={16} className="text-amber-400" />
            <h3 className="text-sm font-bold">Impersonate User (Owner)</h3>
          </div>
          <p className="text-[11px] text-muted-foreground">
            สลับมุมมองเป็นผู้ใช้อื่น (view-only — ทุก action ที่เขียนข้อมูลยังทำในนาม Owner จริง)
          </p>
          {impersonating ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <UserCog size={14} className="text-amber-400" />
              <div className="text-xs flex-1 min-w-0">
                กำลังดูเป็น <b>{profile?.displayName || profile?.email}</b>
              </div>
              <button
                onClick={() => { stopImpersonation(); toast.success("ออกจาก impersonation แล้ว"); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
              >
                <LogOut size={12} /> หยุด
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={impUid}
                onChange={(e) => setImpUid(e.target.value)}
                placeholder="ใส่ UID ของผู้ใช้"
                className="flex-1 h-9 px-3 rounded-lg bg-muted/40 border border-border/40 text-xs outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={doImpersonate}
                className="btn-gradient text-white text-xs font-semibold px-4 rounded-lg"
              >
                เริ่ม
              </button>
            </div>
          )}
        </section>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="btn-gradient text-white text-xs font-semibold px-4 h-9 rounded-lg flex items-center gap-1.5"
        >
          <Save size={13} /> บันทึก
        </button>
      </div>
    </div>
  );
};

export default AdminEffectsTab;
