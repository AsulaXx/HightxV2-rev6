import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save, Plug, Loader2, Eye, EyeOff, Zap, Wallet,
  CheckCircle2, XCircle, KeyRound, AlertCircle, Radio, Shield,
} from "lucide-react";


interface ProviderCreds {
  thunder: { apiKey: string; enabled: boolean };
  plernpay: { clientId: string; clientSecret: string; enabled: boolean };
}

const DEFAULT: ProviderCreds = {
  thunder: { apiKey: "", enabled: true },
  plernpay: { clientId: "", clientSecret: "", enabled: false },
};

type ProviderKey = keyof ProviderCreds;

const META: Record<ProviderKey, {
  name: string; tag: string; color: string; icon: typeof Zap;
  desc: string; docs?: string;
}> = {
  thunder: { name: "Thunder", tag: "ตรวจสลิปธนาคาร + TrueWallet (รูป)", color: "from-amber-500 to-orange-500", icon: Zap, desc: "API ตรวจสอบสลิปด้วยรูปภาพ พร้อม Whitelist บัญชี (บังคับตรวจปลายทาง)", docs: "https://document.thunder.in.th" },
  plernpay: { name: "PlernPay", tag: "Payment Gateway (สร้าง QR + auto verify)", color: "from-violet-500 to-fuchsia-500", icon: Wallet, desc: "สร้าง PromptPay QR ให้ลูกค้าสแกน — ระบบยืนยันการชำระอัตโนมัติผ่าน webhook" },
};

export default function AdminTopUpProviders() {
  const [creds, setCreds] = useState<ProviderCreds>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<ProviderKey | null>(null);
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Partial<Record<ProviderKey, { ok: boolean; message: string }>>>({});
  const [needsClaim, setNeedsClaim] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<{
    hasOwner: boolean; count: number; latestClaimedAt: string | null; latestUid: string | null;
    owners?: Array<{ uid: string; addedAt: string; note?: string }>;
  } | null>(null);

  const getIdToken = async (): Promise<string> => {
    const u = auth.currentUser;
    if (!u) throw new Error("ต้องเข้าสู่ระบบก่อน");
    return await u.getIdToken();
  };

  const saveConfig = async (next: ProviderCreds) => {
    const idToken = await getIdToken();
    // Persist only supported providers (thunder + plernpay). Clear legacy fields.
    const payload = {
      thunder: next.thunder,
      plernpay: next.plernpay,
      rdcw: { clientId: "", clientSecret: "", enabled: false },
      slip2go: { apiKey: "", enabled: false },
      truewallet: { apiUrl: "", enabled: false },
    };
    const { data, error } = await supabase.functions.invoke("topup-qr", {
      body: { action: "save_config", idToken, config: payload },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error?.message || "save failed");
    try {
      await setDoc(doc(db, "settings", "site"), {
        slipProvider: "thunder",
        truewalletProvider: "thunder",
        topUp: { qrProvider: "plernpay" },
      }, { merge: true });
    } catch (e) { console.warn("sync settings failed", e); }
    supabase.functions.invoke("verify-slip", { body: { action: "invalidate_cache", idToken } }).catch(() => {});
  };

  const reload = async () => {
    setLoading(true);
    setNeedsClaim(false);
    try {
      const own = await supabase.functions.invoke("topup-qr", { body: { action: "has_owner" } });
      const o = own.data || {};
      setOwnerInfo({
        hasOwner: !!o.hasOwner,
        count: o.count || 0,
        latestClaimedAt: o.latestClaimedAt || null,
        latestUid: o.latestUid || null,
        owners: o.owners || [],
      });
      if (!o.hasOwner) setNeedsClaim(true);

      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke("topup-qr", {
        body: { action: "load_config", idToken },
      });
      if (error) throw new Error(error.message);
      if (data?.success) {
        const d = (data.config || {}) as Partial<ProviderCreds>;
        setCreds({
          thunder: { ...DEFAULT.thunder, ...(d.thunder || {}), enabled: true },
          plernpay: { ...DEFAULT.plernpay, ...(d.plernpay || {}) },
        });
      } else {
        const msg = data?.error?.message || "";
        if (msg.includes("requires owner") || msg.includes("ยึดสิทธิ์")) setNeedsClaim(true);
        else toast.warning("โหลดค่าไม่สำเร็จ: " + msg);
      }
    } catch (e: any) {
      toast.error("โหลดการตั้งค่าไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke("topup-qr", { body: { action: "claim_owner", idToken } });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error?.message || "claim failed");
      toast.success("ยึดสิทธิ์เจ้าของระบบสำเร็จ");
      await reload();
    } catch (e: any) {
      toast.error("ยึดสิทธิ์ไม่สำเร็จ: " + (e?.message || e));
    } finally { setClaiming(false); }
  };

  const update = <K extends ProviderKey>(k: K, patch: Partial<ProviderCreds[K]>) => {
    setCreds(prev => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  };

  const toggleEnabled = (k: ProviderKey) => {
    // Thunder is always on (single slip verifier)
    if (k === "thunder") return;
    setCreds(prev => ({ ...prev, [k]: { ...prev[k], enabled: !prev[k].enabled } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(creds);
      toast.success("บันทึกค่า API Providers สำเร็จ");
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (provider: ProviderKey) => {
    setTesting(provider);
    setResults(prev => ({ ...prev, [provider]: undefined }));
    try {
      await saveConfig(creds);
      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke("topup-qr", {
        body: { action: "test_provider", provider, idToken },
      });
      if (error) throw new Error(error.message);
      const ok = !!data?.ok;
      const message = data?.message || (ok ? "OK" : "Failed");
      setResults(prev => ({ ...prev, [provider]: { ok, message } }));
      ok ? toast.success(`${META[provider].name}: ${message}`) : toast.error(`${META[provider].name}: ${message}`);
    } catch (e: any) {
      setResults(prev => ({ ...prev, [provider]: { ok: false, message: e?.message || String(e) } }));
      toast.error(e?.message || "เกิดข้อผิดพลาด");
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderField = (provider: ProviderKey, fieldKey: string, label: string, isSecret: boolean, value: string, onChange: (v: string) => void, placeholder?: string) => {
    const id = `${provider}-${fieldKey}`;
    const visible = show[id];
    return (
      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</label>
        <div className="relative">
          <input
            type={isSecret && !visible ? "password" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || label}
            className="input-glass w-full px-3 py-2 pr-9 text-xs font-mono"
            autoComplete="off"
          />
          {isSecret && (
            <button
              type="button"
              onClick={() => setShow(s => ({ ...s, [id]: !s[id] }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
              aria-label="toggle visibility"
            >
              {visible ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const cards: { key: ProviderKey; fields: React.ReactNode }[] = [
    {
      key: "thunder",
      fields: renderField("thunder", "apiKey", "API Key", true, creds.thunder.apiKey, (v) => update("thunder", { apiKey: v }), "Bearer token จาก Thunder dashboard"),
    },
    {
      key: "plernpay",
      fields: (
        <div className="space-y-2">
          {renderField("plernpay", "clientId", "Client ID", false, creds.plernpay.clientId, (v) => update("plernpay", { clientId: v }))}
          {renderField("plernpay", "clientSecret", "Client Secret", true, creds.plernpay.clientSecret, (v) => update("plernpay", { clientSecret: v }))}
        </div>
      ),
    },
  ];

  return (
    <div className="glass-card space-y-5 border-2 border-primary/20">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <KeyRound size={16} className="text-primary" /> API Providers — ตั้งค่า Credentials
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            ใช้เฉพาะ <strong className="text-amber-500">Thunder</strong> (ตรวจสลิป) และ <strong className="text-violet-500">PlernPay</strong> (Payment Gateway) — ระบบซองอั่งเปาใช้ tw-angpao ไม่ต้องตั้งค่า API
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            บันทึกทั้งหมด
          </button>
        </div>
      </div>

      {needsClaim && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle size={14} className="text-violet-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-foreground">
              <strong className="text-violet-400">ยังไม่มีเจ้าของระบบ:</strong> กดปุ่มเพื่อยึดสิทธิ์ Owner
            </p>
          </div>
          <button onClick={handleClaim} disabled={claiming} className="btn-primary px-3 py-1.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50 shrink-0">
            {claiming ? <Loader2 size={11} className="animate-spin" /> : <Shield size={11} />}
            ยึดสิทธิ์เจ้าของ
          </button>
        </div>
      )}

      {ownerInfo && ownerInfo.hasOwner && (() => {
        const isMe = ownerInfo.latestUid && auth.currentUser?.uid === ownerInfo.latestUid;
        const claimedAt = ownerInfo.latestClaimedAt ? new Date(ownerInfo.latestClaimedAt) : null;
        const claimedStr = claimedAt ? claimedAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "—";
        const uidShort = ownerInfo.latestUid ? `${ownerInfo.latestUid.slice(0, 6)}…${ownerInfo.latestUid.slice(-4)}` : "—";
        return (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex-wrap">
            <div className="flex items-start gap-2 min-w-0">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-foreground">
                  <strong className="text-emerald-500">มีเจ้าของระบบแล้ว</strong>
                  <span className="text-muted-foreground"> · ทั้งหมด {ownerInfo.count} บัญชี</span>
                  {isMe && <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">คุณเป็นเจ้าของ</span>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  Claim ล่าสุด: <span className="text-foreground">{claimedStr}</span>
                  <span className="mx-1.5 opacity-40">·</span>
                  UID: <span className="text-foreground">{uidShort}</span>
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
        <Radio size={13} className="text-amber-500 shrink-0" />
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-amber-500">Thunder</strong>: ใช้สำหรับตรวจสลิปธนาคาร + TrueWallet ทั้งหมด (มีระบบตรวจปลายทางบังคับ)
          <br />
          <strong className="text-violet-500">PlernPay</strong>: ใช้สร้าง QR PromptPay อัตโนมัติ (ลูกค้าสแกน → เครดิตอัตโนมัติผ่าน webhook)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {cards.map(({ key, fields }) => {
          const m = META[key];
          const Icon = m.icon;
          const result = results[key];
          const isThunder = key === "thunder";
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`relative rounded-2xl border overflow-hidden transition-all ${creds[key].enabled ? "border-border/40 bg-card/80" : "border-border/20 bg-muted/20 opacity-75"}`}
            >
              <div className={`h-1 w-full bg-gradient-to-r ${m.color}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center shrink-0 shadow-md`}>
                      <Icon size={16} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                        {m.name}
                        {creds[key].enabled && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                            {isThunder ? "บังคับใช้" : "กำลังใช้งาน"}
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate">{m.tag}</p>
                    </div>
                  </div>
                  {!isThunder && (
                    <div className={`toggle-slider scale-75 ${creds[key].enabled ? "toggle-active" : ""}`} onClick={() => toggleEnabled(key)} />
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{m.desc}</p>

                {fields}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => handleTest(key)}
                    disabled={testing === key}
                    className="btn-glass px-3 py-1.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {testing === key ? <Loader2 size={11} className="animate-spin" /> : <Plug size={11} />}
                    ทดสอบเชื่อมต่อ
                  </button>
                  {result && (
                    <span className={`text-[10px] flex items-center gap-1 truncate min-w-0 ${result.ok ? "text-emerald-500" : "text-destructive"}`}>
                      {result.ok ? <CheckCircle2 size={11} className="shrink-0" /> : <XCircle size={11} className="shrink-0" />}
                      <span className="truncate">{result.message}</span>
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
