import { Save, Upload } from "lucide-react";
import { AdminTabProps } from "../shared/AdminTabProps";
import type { BgMusicConfig } from "@/contexts/SiteSettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseUploadPrefix } from "@/lib/supabaseSync";
import { toast } from "sonner";
import ImageUploadField from "../shared/ImageUploadField";


const AdminMusicTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const music = form.bgMusic || { enabled: false, url: "", coverUrl: "", title: "", artist: "", startTime: 0, autoPlay: true };
  const updateMusic = (updates: Partial<BgMusicConfig>) => setForm({ ...form, bgMusic: { ...music, ...updates } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">🎵 เพลงพื้นหลัง</h1>
        <p className="text-sm text-muted-foreground mt-1">ตั้งค่าเพลงพื้นหลังสำหรับเว็บหลัก</p>
      </div>

      <div className="glass-card space-y-5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-foreground">เปิดใช้เพลงพื้นหลัง</label>
          <button onClick={() => updateMusic({ enabled: !music.enabled })} className={`w-12 h-6 rounded-full transition-colors duration-200 ${music.enabled ? 'bg-primary' : 'bg-muted'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${music.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">เพลง (URL หรืออัปโหลดไฟล์ MP3)</label>
          <div className="flex gap-2">
            <input type="url" value={music.url} onChange={(e) => updateMusic({ url: e.target.value })} className="input-glass flex-1 px-4 py-3 text-sm" placeholder="https://example.com/music.mp3 หรืออัปโหลดไฟล์" />
            <label className="btn-glass px-4 py-3 text-sm flex items-center gap-2 cursor-pointer shrink-0">
              <Upload size={16} /> อัปโหลด
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 20 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 20MB"); return; }
                  const ext = file.name.split(".").pop() || "mp3";
                  toast.loading("กำลังอัปโหลดเพลง...", { id: "music-upload" });
                  let path: string;
                  try {
                    const prefix = await getSupabaseUploadPrefix();
                    path = `${prefix}/${Date.now()}.${ext}`;
                  } catch {
                    try {
                      const { syncSupabaseSession } = await import("@/lib/supabaseSync");
                      const uid = await syncSupabaseSession(true);
                      if (!uid) throw new Error("no uid");
                      path = `${uid}/${Date.now()}.${ext}`;
                    } catch (err: any) {
                      toast.error("เชื่อมต่อ Storage ไม่สำเร็จ ลองรีเฟรชหน้าแล้วอัปโหลดใหม่", { id: "music-upload" });
                      return;
                    }
                  }
                  const { error } = await supabase.storage.from("music").upload(path, file, { cacheControl: "3600", upsert: false });
                  if (error) { toast.error("อัปโหลดล้มเหลว: " + error.message, { id: "music-upload" }); return; }

                  const { data: urlData } = supabase.storage.from("music").getPublicUrl(path);
                  updateMusic({ url: urlData.publicUrl });
                  toast.success("อัปโหลดเพลงสำเร็จ!", { id: "music-upload" });
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {music.url && <p className="text-xs text-muted-foreground mt-1 truncate">{music.url}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">ชื่อเพลง</label>
            <input type="text" value={music.title} onChange={(e) => updateMusic({ title: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="ชื่อเพลง" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">ศิลปิน</label>
            <input type="text" value={music.artist} onChange={(e) => updateMusic({ artist: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="ชื่อศิลปิน" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">รูปหน้าปก</label>
          <ImageUploadField value={music.coverUrl || ""} onChange={(url) => updateMusic({ coverUrl: url })} folder="music-cover" previewClassName="w-16 h-16 rounded-xl object-cover" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">เวลาเริ่มเล่น (วินาที)</label>
            <input type="number" min={0} value={music.startTime} onChange={(e) => updateMusic({ startTime: parseInt(e.target.value) || 0 })} className="input-glass w-full px-4 py-3 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              ระดับเสียงเริ่มต้น ({Math.round(((music.defaultVolume ?? 0.5)) * 100)}%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={Math.round(((music.defaultVolume ?? 0.5)) * 100)}
              onChange={(e) => {
                const pct = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                updateMusic({ defaultVolume: pct / 100 });
              }}
              className="input-glass w-full px-4 py-3 text-sm"
              placeholder="0-100"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <label className="text-sm font-semibold text-foreground">เล่นอัตโนมัติ</label>
            <button onClick={() => updateMusic({ autoPlay: !music.autoPlay })} className={`w-12 h-6 rounded-full transition-colors duration-200 ${music.autoPlay ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${music.autoPlay ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกตั้งค่าเพลง</button>
    </div>
  );
};

export default AdminMusicTab;
