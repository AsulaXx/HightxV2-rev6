import { useEffect, useState } from "react";
import { Plus, Trash2, Zap, Power, KeyRound, Shield, Save, Eye, EyeOff, Loader2 } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { AdminTabProps } from "../shared/AdminTabProps";
import type { RuzienBypassConfig, RuzienBypassDuration } from "@/contexts/SiteSettingsContext";

const defaultCfg: RuzienBypassConfig = {
  enabled: true,
  title: "Ruizen Bypass UID",
  description: "กรอก UID ของคุณและเลือกจำนวนวันเพื่อรับคีย์",
  notice: "",
  durations: [
    { id: "d1", days: 1, price: 10, label: "1 วัน", enabled: true },
    { id: "d7", days: 7, price: 50, label: "7 วัน", enabled: true },
    { id: "d30", days: 30, price: 150, label: "30 วัน", enabled: true },
  ],
};

const AdminRuzienBypassTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const cfg: RuzienBypassConfig = form.ruzienBypass || defaultCfg;
  const update = (patch: Partial<RuzienBypassConfig>) =>
    setForm({ ...form, ruzienBypass: { ...cfg, ...patch } });

  const updateDur = (id: string, patch: Partial<RuzienBypassDuration>) =>
    update({ durations: cfg.durations.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const addDur = () =>
    update({ durations: [...cfg.durations, { id: `d${Date.now()}`, days: 1, price: 0, label: "", enabled: true }] });
  const removeDur = (id: string) => update({ durations: cfg.durations.filter((d) => d.id !== id) });

  // ── API credentials (stored at Firestore: secureConfig/ruzienBypass, owner-only) ──
  const [apiLoading, setApiLoading] = useState(true);
  const [apiSaving, setApiSaving] = useState(false);
  const [hasPublic, setHasPublic] = useState(false);
  const [hasSecret, setHasSecret] = useState(false);
  const [publicTail, setPublicTail] = useState("");
  const [secretTail, setSecretTail] = useState("");
  const [publicInput, setPublicInput] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [showPublic, setShowPublic] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "secureConfig", "ruzienBypass"));
        if (snap.exists()) {
          const d: any = snap.data();
          if (d.public_key) { setHasPublic(true); setPublicTail(String(d.public_key).slice(-4)); }
          if (d.secret)     { setHasSecret(true); setSecretTail(String(d.secret).slice(-4)); }
        }
      } catch (e) {
        console.warn("load ruzien creds:", e);
      } finally {
        setApiLoading(false);
      }
    })();
  }, []);

  const saveApi = async () => {
    const pk = publicInput.trim();
    const sk = secretInput.trim();
    if (!pk && !sk) { toast.error("กรอกค่าที่ต้องการอัปเดตอย่างน้อย 1 ช่อง"); return; }
    if (pk && (pk.length < 16 || pk.length > 512)) { toast.error("Public Key ต้องมีความยาว 16-512 อักขระ"); return; }
    if (sk && (sk.length < 16 || sk.length > 512)) { toast.error("Secret ต้องมีความยาว 16-512 อักขระ"); return; }
    setApiSaving(true);
    try {
      const payload: Record<string, any> = { updatedAt: new Date().toISOString() };
      if (pk) payload.public_key = pk;
      if (sk) payload.secret = sk;
      await setDoc(doc(db, "secureConfig", "ruzienBypass"), payload, { merge: true });
      if (pk) { setHasPublic(true); setPublicTail(pk.slice(-4)); setPublicInput(""); setShowPublic(false); }
      if (sk) { setHasSecret(true); setSecretTail(sk.slice(-4)); setSecretInput(""); setShowSecret(false); }
      toast.success("บันทึก API Credentials สำเร็จ (เข้ารหัสฝั่งเซิร์ฟเวอร์เท่านั้น)");
    } catch (e: any) {
      toast.error(e?.message?.includes("permission") ? "เฉพาะ Owner เท่านั้นที่บันทึกได้" : `บันทึกไม่สำเร็จ: ${e?.message || e}`);
    } finally {
      setApiSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Zap size={24} /> Ruizen Bypass UID
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ตั้งค่าหน้า <code className="text-primary">/Ruzien-bypass-uid</code> — ใช้เครดิตจากกระเป๋าหลักของผู้ใช้
        </p>
      </div>

      {/* API Credentials — owner only, written to Firestore secureConfig/ruzienBypass */}
      <div className="glass-card space-y-4 border-amber-500/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <KeyRound size={16} className="text-amber-400" /> API Credentials
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Shield size={11} /> ค่าจะถูกอ่านโดย Edge Function เท่านั้น ไม่ถูกส่งกลับให้เบราว์เซอร์หลังบันทึก
            </p>
          </div>
        </div>

        {apiLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
            <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Public Key</span>
                  {hasPublic && <span className="text-[10px] text-emerald-400">● ตั้งค่าแล้ว (••••{publicTail})</span>}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPublic ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    className="input-glass w-full pr-10 font-mono text-sm"
                    placeholder={hasPublic ? "กรอกเพื่อแทนที่ค่าเดิม" : "วาง Public Key ที่นี่"}
                    value={publicInput}
                    onChange={(e) => setPublicInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPublic((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title={showPublic ? "ซ่อน" : "แสดง"}
                  >
                    {showPublic ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Secret</span>
                  {hasSecret && <span className="text-[10px] text-emerald-400">● ตั้งค่าแล้ว (••••{secretTail})</span>}
                </label>
                <div className="relative mt-1">
                  <input
                    type={showSecret ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    className="input-glass w-full pr-10 font-mono text-sm"
                    placeholder={hasSecret ? "กรอกเพื่อแทนที่ค่าเดิม" : "วาง Secret ที่นี่"}
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title={showSecret ? "ซ่อน" : "แสดง"}
                  >
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/10 border border-border rounded-lg p-3 space-y-1">
              <p>🔒 <b>การจัดเก็บ:</b> เก็บที่ Firestore <code>secureConfig/ruzienBypass</code> — กฎความปลอดภัยจำกัดให้เฉพาะ Owner อ่าน/เขียนได้</p>
              <p>🛡️ <b>การใช้งาน:</b> Edge Function <code>ruzien-bypass-claim</code> อ่านค่าด้วย Service Account — ไม่เคยถูกส่งกลับให้ผู้ใช้</p>
              <p>♻️ <b>Fallback:</b> หากไม่มีค่าใน Firestore จะใช้ค่าจาก Environment Secret เดิม</p>
              <p>⚠️ ปล่อยช่องว่างไว้ = ไม่เปลี่ยนแปลงค่าที่บันทึกอยู่</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveApi}
                disabled={apiSaving || (!publicInput.trim() && !secretInput.trim())}
                className="px-4 py-2 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-black text-sm font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {apiSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                บันทึก API Credentials
              </button>
            </div>
          </>
        )}
      </div>


      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Power size={16} /> สถานะ</h3>
        <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-muted/20 border border-border">
          <div
            className={`toggle-slider ${cfg.enabled ? "toggle-active" : ""}`}
            onClick={() => update({ enabled: !cfg.enabled })}
          />
          <div>
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานบริการ</span>
            <p className="text-[11px] text-muted-foreground">เมื่อปิด ผู้ใช้จะเห็นข้อความปิดปรับปรุง</p>
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">ชื่อบริการ</label>
            <input
              className="input-glass w-full mt-1"
              value={cfg.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">คำอธิบายสั้น</label>
            <input
              className="input-glass w-full mt-1"
              value={cfg.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">ประกาศ (แสดงบนหน้า)</label>
          <textarea
            className="input-glass w-full mt-1"
            rows={2}
            placeholder="ว่าง = ไม่แสดง"
            value={cfg.notice || ""}
            onChange={(e) => update({ notice: e.target.value })}
          />
        </div>
      </div>

      <div className="glass-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">ตัวเลือกวัน & ราคา (เครดิต)</h3>
          <button
            onClick={addDur}
            className="px-3 py-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-semibold flex items-center gap-1"
          >
            <Plus size={14} /> เพิ่มตัวเลือก
          </button>
        </div>
        <div className="space-y-2">
          {cfg.durations.map((d) => (
            <div key={d.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-muted/10 border border-border">
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground">Label</label>
                <input
                  className="input-glass w-full text-sm"
                  value={d.label}
                  onChange={(e) => updateDur(d.id, { label: e.target.value })}
                  placeholder="1 วัน"
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground">จำนวนวัน</label>
                <input
                  type="number"
                  min={1}
                  className="input-glass w-full text-sm"
                  value={d.days}
                  onChange={(e) => updateDur(d.id, { days: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-muted-foreground">ราคา (เครดิต)</label>
                <input
                  type="number"
                  min={0}
                  className="input-glass w-full text-sm"
                  value={d.price}
                  onChange={(e) => updateDur(d.id, { price: Math.max(0, Number(e.target.value) || 0) })}
                />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div
                  className={`toggle-slider ${d.enabled ? "toggle-active" : ""}`}
                  onClick={() => updateDur(d.id, { enabled: !d.enabled })}
                />
                <span className="text-xs text-muted-foreground">เปิด</span>
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => removeDur(d.id)}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10"
                  title="ลบ"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {cfg.durations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีตัวเลือก — กดเพิ่มด้านบน</p>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          ราคา = จำนวนเครดิตที่จะหักจาก wallet ผู้ใช้เมื่อกดรับคีย์ (0 = ฟรี)
        </p>
      </div>
    </div>
  );
};

export default AdminRuzienBypassTab;
