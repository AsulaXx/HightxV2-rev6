import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, Copy, CheckCircle, AlertTriangle, Wallet, Lock, RefreshCw, KeyRound, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useWallet } from "@/hooks/useWallet";
import { recordLedgerOnly, safeAddHistory } from "@/lib/walletLedger";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { supabase } from "@/integrations/supabase/client";
import RedirectToLogin from "@/components/RedirectToLogin";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { toast } from "sonner";

interface ClaimResult {
  key: string;
  license_id?: string;
  expires_at?: string;
}

const RuzienBypassPage = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { settings } = useSiteSettings();
  const { balance } = useWallet();
  const { isSubmitting, run } = useSubmitGuard(1200);

  const cfg = settings.ruzienBypass;
  const durations = useMemo(
    () => (cfg?.durations || []).filter((d) => d.enabled),
    [cfg]
  );

  const [uid, setUid] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Change UID / Check license states
  const [licKey, setLicKey] = useState("");
  const [oldUid, setOldUid] = useState("");
  const [newUid, setNewUid] = useState("");
  const [manageLoading, setManageLoading] = useState<"check" | "change" | null>(null);
  const [manageInfo, setManageInfo] = useState<{ ok: boolean; msg: string; data?: any } | null>(null);

  if (authLoading) return <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>;
  if (!user) return <RedirectToLogin />;

  if (!cfg?.enabled) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="glass-card p-8">
          <AlertTriangle size={40} className="mx-auto text-amber-400 mb-3" />
          <h2 className="text-xl font-bold text-foreground">บริการปิดปรับปรุง</h2>
          <p className="text-sm text-muted-foreground mt-2">กรุณากลับมาใหม่ภายหลัง</p>
        </div>
      </div>
    );
  }

  const selected = durations.find((d) => d.id === selectedId) || durations[0];
  const price = selected?.price ?? 0;
  const canAfford = balance >= price;

  const handleClaim = () =>
    run(async () => {
      setResult(null);
      if (!/^\d{4,20}$/.test(uid.trim())) {
        toast.error("กรุณากรอก UID เป็นตัวเลข 4-20 หลัก");
        return;
      }
      if (!selected) {
        toast.error("กรุณาเลือกจำนวนวัน");
        return;
      }
      if (!canAfford) {
        toast.error("เครดิตไม่พอ");
        return;
      }

      // Edge function handles balance check + atomic deduction + refund-on-failure server-side.
      try {
        const { getIdToken } = await import("@/lib/firebaseIdToken");
        const idToken = await getIdToken(true);
        const { data, error } = await supabase.functions.invoke("ruzien-bypass-claim", {
          body: { game_uid: uid.trim(), days: selected.days, idToken },
        });
        if (error) throw new Error(error.message || "Edge function error");
        if (!data?.success) throw new Error(data?.error || "ไม่สามารถออกคีย์ได้");

        setResult({ key: data.key, license_id: data.license_id, expires_at: data.expires_at });
        toast.success("รับคีย์สำเร็จ!");

        // Audit-only ledger entry (balance was modified server-side)
        if (price > 0) {
          await recordLedgerOnly({
            type: "purchase",
            amount: -price,
            description: `Ruizen Bypass UID ${selected.days} วัน (UID: ${uid.trim()})`,
            userId: user.uid,
            userEmail: profile.email,
            userName: profile.displayName,
            method: "ruzien-bypass",
            meta: { game_uid: uid.trim(), days: selected.days, durationId: selected.id, license_id: data.license_id || null },
          });
        }

        await safeAddHistory("ruzienBypassClaims", {
          userId: user.uid,
          userEmail: profile.email,
          userName: profile.displayName,
          game_uid: uid.trim(),
          key: data.key,
          key_preview: data.key_preview || (data.key ? `••••${String(data.key).slice(-4)}` : ""),
          license_id: data.license_id || null,
          expires_at: data.expires_at || null,
          days: selected.days,
          durationId: selected.id,
          durationLabel: selected.label || `${selected.days} วัน`,
          price,
        });
      } catch (e: any) {
        toast.error(`ออกคีย์ไม่สำเร็จ: ${e?.message || e}`);
      }
    });


  const copyKey = async () => {
    if (!result?.key) return;
    await navigator.clipboard.writeText(result.key);
    setCopied(true);
    toast.success("คัดลอกคีย์แล้ว");
    setTimeout(() => setCopied(false), 1500);
  };

  const callManage = async (action: "get_license" | "change_uid") => {
    setManageInfo(null);
    if (!licKey.trim()) { toast.error("กรุณากรอก License Key"); return; }
    if (action === "change_uid" && !/^\d{4,20}$/.test(newUid.trim())) {
      toast.error("UID ใหม่ไม่ถูกต้อง (ตัวเลข 4-20 หลัก)"); return;
    }
    if (action === "change_uid" && oldUid && !/^\d{4,20}$/.test(oldUid.trim())) {
      toast.error("UID เดิมไม่ถูกต้อง"); return;
    }
    setManageLoading(action === "get_license" ? "check" : "change");
    try {
      const { getIdToken } = await import("@/lib/firebaseIdToken");
      const idToken = await getIdToken(true);
      const body: any = { action, idToken, license_key: licKey.trim() };
      if (action === "change_uid") {
        body.new_uid = newUid.trim();
        if (oldUid.trim()) body.old_uid = oldUid.trim();
      }
      const { data, error } = await supabase.functions.invoke("ruzien-bypass-claim", { body });
      if (error) throw new Error(error.message || "Edge function error");
      if (!data?.success) throw new Error(data?.error || "ไม่สำเร็จ");
      setManageInfo({ ok: true, msg: action === "get_license" ? "ตรวจสอบสำเร็จ" : "เปลี่ยน UID สำเร็จ", data: data.data });
      toast.success(action === "get_license" ? "ตรวจสอบสำเร็จ" : "เปลี่ยน UID สำเร็จ");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setManageInfo({ ok: false, msg });
      toast.error(msg);
    } finally {
      setManageLoading(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: cfg.title || "Ruizen Bypass UID" }]}
        title={cfg.title || "Ruizen Bypass UID"}
        subtitle={cfg.description}
        icon={Zap}
      />

      {cfg.notice && (
        <div className="mt-4 p-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{cfg.notice}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card mt-6 space-y-5">
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
          <span className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wallet size={16} className="text-primary" /> เครดิตคงเหลือ
          </span>
          <span className="text-lg font-bold text-primary">฿{balance.toLocaleString()}</span>
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground">UID ในเกม</label>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value.replace(/\D/g, ""))}
            placeholder="123456789"
            inputMode="numeric"
            maxLength={20}
            className="input-glass w-full mt-2"
            disabled={isSubmitting}
          />
          <p className="text-[11px] text-muted-foreground mt-1">ตัวเลขเท่านั้น (4-20 หลัก)</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground">เลือกจำนวนวัน</label>
          {durations.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">ยังไม่มีตัวเลือก — กรุณาติดต่อแอดมิน</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {durations.map((d) => {
                const active = (selectedId || durations[0]?.id) === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    disabled={isSubmitting}
                    className={`p-3 rounded-xl border text-center transition-all active:scale-95 ${
                      active
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border bg-muted/10 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <div className="text-sm font-bold">{d.label || `${d.days} วัน`}</div>
                    <div className="text-xs mt-1">{d.price === 0 ? "ฟรี" : `฿${d.price.toLocaleString()}`}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={handleClaim}
          disabled={isSubmitting || !selected || !canAfford || !uid}
          className="btn-gradient w-full py-3 rounded-xl font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            "กำลังออกคีย์..."
          ) : !canAfford && price > 0 ? (
            <><Lock size={16} /> เครดิตไม่พอ</>
          ) : (
            <><Zap size={16} /> รับคีย์ {price > 0 ? `(฿${price.toLocaleString()})` : "(ฟรี)"}</>
          )}
        </button>
      </motion.div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card mt-6 space-y-3 border-emerald-500/30">
          <h3 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <CheckCircle size={18} /> คีย์ของคุณ
          </h3>
          <div className="p-3 rounded-xl bg-muted/20 border border-border break-all font-mono text-sm text-foreground select-all">
            {result.key}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={copyKey}
              className="px-3 py-2 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-sm font-semibold flex items-center gap-1.5"
            >
              {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied ? "คัดลอกแล้ว" : "คัดลอกคีย์"}
            </button>
            {result.expires_at && (
              <span className="text-xs text-muted-foreground">
                หมดอายุ: {new Date(result.expires_at).toLocaleString("th-TH")}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">⚠️ เก็บคีย์ไว้ในที่ปลอดภัย หน้านี้จะไม่แสดงคีย์อีกเมื่อรีเฟรช</p>
        </motion.div>
      )}

      {/* จัดการ License: ตรวจสอบ / เปลี่ยน UID */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={18} className="text-primary" />
          <h3 className="text-base font-bold text-foreground">จัดการ License / เปลี่ยน UID</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          ใช้ License Key ที่คุณได้รับเพื่อตรวจสอบสถานะหรือเปลี่ยน UID ในเกม
          (เก็บ License Key ไว้เป็นความลับเหมือนรหัสผ่าน)
        </p>

        <div>
          <label className="text-sm font-semibold text-foreground flex items-center gap-1.5"><KeyRound size={14} /> License Key</label>
          <input
            value={licKey}
            onChange={(e) => setLicKey(e.target.value)}
            placeholder="กรอก License Key ของคุณ"
            className="input-glass w-full mt-2 font-mono text-sm"
            disabled={!!manageLoading}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-foreground">UID เดิม (แนะนำ)</label>
            <input
              value={oldUid}
              onChange={(e) => setOldUid(e.target.value.replace(/\D/g, ""))}
              placeholder="UID ปัจจุบัน"
              inputMode="numeric"
              maxLength={20}
              className="input-glass w-full mt-2"
              disabled={!!manageLoading}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-foreground">UID ใหม่</label>
            <input
              value={newUid}
              onChange={(e) => setNewUid(e.target.value.replace(/\D/g, ""))}
              placeholder="UID ที่ต้องการเปลี่ยน"
              inputMode="numeric"
              maxLength={20}
              className="input-glass w-full mt-2"
              disabled={!!manageLoading}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => callManage("get_license")}
            disabled={!!manageLoading || !licKey.trim()}
            className="flex-1 py-2.5 rounded-xl font-semibold bg-muted/20 hover:bg-muted/30 border border-border text-foreground disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search size={16} />
            {manageLoading === "check" ? "กำลังตรวจสอบ..." : "ตรวจสอบ License"}
          </button>
          <button
            onClick={() => callManage("change_uid")}
            disabled={!!manageLoading || !licKey.trim() || !newUid.trim()}
            className="btn-gradient flex-1 py-2.5 rounded-xl font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            {manageLoading === "change" ? "กำลังเปลี่ยน..." : "เปลี่ยน UID"}
          </button>
        </div>

        {manageInfo && (
          <div className={`p-3 rounded-xl border text-sm break-all ${
            manageInfo.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}>
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              {manageInfo.ok ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              {manageInfo.msg}
            </div>
            {manageInfo.data && (
              <pre className="text-[11px] font-mono whitespace-pre-wrap text-foreground/80 mt-1">
                {JSON.stringify(manageInfo.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default RuzienBypassPage;
