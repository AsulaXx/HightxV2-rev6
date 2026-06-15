import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { QrCode, Loader2, CheckCircle, RefreshCw, Clock, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface Props {
  userId: string;
  defaultAmount?: number;
  minAmount?: number;
  maxAmount?: number;
  provider: 'promptpay' | 'plernpay' | 'rdcw';
  promptpayTarget: string;
  onPaid: (info: { amount: number; reference: string }) => Promise<void>;
}

export default function TopUpQR({ userId, defaultAmount = 100, minAmount = 0, maxAmount = 0, provider, promptpayTarget, onPaid }: Props) {
  const { settings } = useSiteSettings();
  const brand = (settings?.brandName || 'TOPUP').toUpperCase();
  const storageKey = `topup-qr-session:${userId}:${provider}`;

  // Restore persisted QR session so refreshing the page does NOT lose an in-progress payment
  const restored = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (!raw) return null;
      const s = JSON.parse(raw) as { reference: string; qrPayload: string; expiresAt: string; provider: string; amount: number };
      // Drop only if expired for more than 30 min (still show "expired" state briefly otherwise)
      if (new Date(s.expiresAt).getTime() < Date.now() - 30 * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return null;
      }
      return s;
    } catch { return null; }
  })();

  const [amount, setAmount] = useState<string>(restored ? String(restored.amount) : String(defaultAmount));
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<{ reference: string; qrPayload: string; expiresAt: string; provider: string } | null>(
    restored ? { reference: restored.reference, qrPayload: restored.qrPayload, expiresAt: restored.expiresAt, provider: restored.provider } : null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [status, setStatus] = useState<'pending' | 'paid' | 'expired' | 'failed' | null>(restored ? 'pending' : null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const creditedRef = useRef(false);
  const warnedRef = useRef(false);
  const expiredToastRef = useRef(false);

  // Render QR canvas with watermark when payload changes
  useEffect(() => {
    if (!session?.qrPayload) { setQrDataUrl(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const size = 360;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        await QRCode.toCanvas(canvas, session.qrPayload, {
          width: size, margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const ts = new Date().toLocaleString('th-TH', { hour12: false });
          const ref = session.reference.slice(-8).toUpperCase();
          const amt = Number(amount).toLocaleString();
          const wmText = `${brand} • ฿${amt} • ${ref}`;

          // Diagonal repeating watermark
          ctx.save();
          ctx.translate(size / 2, size / 2);
          ctx.rotate(-Math.PI / 6);
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(220, 38, 38, 0.32)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          for (let y = -size; y <= size; y += 38) {
            for (let x = -size; x <= size; x += 220) {
              ctx.fillText(wmText, x, y);
            }
          }
          ctx.restore();

          // Bottom timestamp bar
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(0, size - 22, size, 22);
          ctx.fillStyle = '#ffffff';
          ctx.font = '11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${brand} • ${ts} • ใช้ครั้งเดียว`, size / 2, size - 11);
        }
        if (!cancelled) setQrDataUrl(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    })();
    return () => { cancelled = true; };
  }, [session?.qrPayload, session?.reference, amount, brand]);

  // Countdown
  useEffect(() => {
    if (!session) return;
    const update = () => {
      const left = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (status === 'pending') {
        if (left > 0 && left <= 60 && !warnedRef.current) {
          warnedRef.current = true;
          toast.warning('QR ใกล้หมดอายุ', { description: 'เหลือเวลาไม่ถึง 1 นาที กรุณาชำระเงิน' });
        }
        if (left === 0) {
          setStatus('expired');
          if (!expiredToastRef.current) {
            expiredToastRef.current = true;
            toast.error('QR หมดอายุแล้ว', { description: 'กดปุ่มเพื่อสร้าง QR ใหม่ทันที' });
          }
        }
      }
    };
    update();
    tickRef.current = window.setInterval(update, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, [session, status]);

  // Polling (paused when tab is hidden) — no client rate limit
  useEffect(() => {
    if (!session || status !== 'pending') return;
    let stopped = false;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const { data, error } = await supabase.functions.invoke('topup-qr', {
          body: { action: 'status', reference: session.reference },
        });
        if (error || !data?.success) return;
        if (data.status && data.status !== 'pending') {
          setStatus(data.status);
          if (data.status === 'paid' && !creditedRef.current) {
            creditedRef.current = true;
            await onPaid({ amount: data.amount, reference: session.reference });
            const { getIdToken } = await import("@/lib/firebaseIdToken");
            const idToken = await getIdToken();
            await supabase.functions.invoke('topup-qr', { body: { action: 'mark_credited', reference: session.reference, idToken } });
          }
        }
      } catch { /* ignore */ }
    };
    pollRef.current = window.setInterval(() => { if (!stopped) poll(); }, 2000);
    poll();
    // Re-check immediately when tab becomes visible again
    const onVisible = () => { if (!document.hidden && !stopped) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, status, onPaid]);

  const create = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("กรุณาใส่จำนวนเงิน"); return; }
    if (minAmount && amt < minAmount) { toast.error(`ขั้นต่ำ ฿${minAmount}`); return; }
    if (maxAmount && amt > maxAmount) { toast.error(`สูงสุด ฿${maxAmount}`); return; }
    if (provider !== 'plernpay' && !promptpayTarget) {
      toast.error("ผู้ดูแลยังไม่ได้ตั้งค่า PromptPay target"); return;
    }
    setLoading(true);
    creditedRef.current = false;
    warnedRef.current = false;
    expiredToastRef.current = false;
    try {
      const { getIdToken } = await import("@/lib/firebaseIdToken");
      const idToken = await getIdToken();
      const { data, error } = await supabase.functions.invoke('topup-qr', {
        body: { action: 'create', provider, amount: amt, promptpayTarget, idToken },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error?.message || 'สร้าง QR ไม่สำเร็จ');
      const next = { reference: data.reference, qrPayload: data.qrPayload, expiresAt: data.expiresAt, provider: data.provider };
      setSession(next);
      setStatus('pending');
      try { localStorage.setItem(storageKey, JSON.stringify({ ...next, amount: amt })); } catch { /* ignore */ }
    } catch (e: any) {
      toast.error(e?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  // Clear persisted session when status reaches a terminal state (paid only — keep expired so user sees it)
  useEffect(() => {
    if (status === 'paid') {
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    }
  }, [status, storageKey]);

  const reset = () => {
    setSession(null);
    setStatus(null);
    setQrDataUrl("");
    creditedRef.current = false;
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  const copyPayload = () => {
    if (!session?.qrPayload) return;
    navigator.clipboard.writeText(session.qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {!session ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <Sparkles size={13} className="text-blue-500 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              กรอกจำนวนเงินเพื่อสร้าง QR สำหรับชำระ
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">จำนวนเงิน (บาท)</label>
            <input
              type="number" inputMode="decimal" min="1" step="1"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="input-glass w-full px-4 py-3 text-lg font-bold text-center"
              placeholder="0.00"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {[50, 100, 200, 500, 1000].map(v => (
                <button key={v} onClick={() => setAmount(String(v))} className="btn-glass px-3 py-1.5 text-xs">฿{v}</button>
              ))}
            </div>
          </div>

          <button onClick={create} disabled={loading} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            {loading ? 'กำลังสร้าง QR...' : 'สร้าง QR Code'}
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
          {status === 'paid' ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle size={40} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-500">เติมเงินสำเร็จ!</p>
                <p className="text-2xl font-bold text-foreground mt-1">฿{Number(amount).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Ref: {session.reference}</p>
              </div>
              <button onClick={reset} className="btn-glass px-4 py-2 text-xs">เติมเพิ่ม</button>
            </div>
          ) : status === 'expired' || status === 'failed' ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-20 h-20 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center mx-auto">
                <Clock size={40} className="text-destructive" />
              </div>
              <div>
                <p className="text-base font-bold text-destructive">{status === 'expired' ? 'QR หมดอายุแล้ว' : 'รายการล้มเหลว'}</p>
                <p className="text-xs text-muted-foreground mt-1">กดปุ่มเพื่อสร้าง QR ใหม่ทันที (จำนวน ฿{Number(amount).toLocaleString()})</p>
              </div>
              <div className="flex gap-2 justify-center">
                <button onClick={create} disabled={loading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {loading ? 'กำลังสร้าง...' : 'สร้าง QR ใหม่ทันที'}
                </button>
                <button onClick={reset} className="btn-glass px-4 py-2 text-sm">เปลี่ยนจำนวน</button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-4 mx-auto w-fit border border-border/30 shadow-lg">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="PromptPay QR" className="w-64 h-64" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">จำนวน</p>
                <p className="text-3xl font-bold text-foreground">฿{Number(amount).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground/60">Ref: {session.reference}</p>
              </div>
              <div className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border ${secondsLeft <= 60 ? 'bg-destructive/10 border-destructive/30 animate-pulse' : 'bg-amber-500/5 border-amber-500/20'}`}>
                <Clock size={13} className={secondsLeft <= 60 ? 'text-destructive' : 'text-amber-500'} />
                <p className={`text-xs font-medium ${secondsLeft <= 60 ? 'text-destructive' : 'text-amber-500'}`}>
                  {secondsLeft <= 60 ? 'ใกล้หมดอายุ! ' : ''}หมดอายุใน {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin" /> กำลังตรวจสอบการชำระ...
              </div>
              <div className="flex gap-2">
                <button onClick={copyPayload} className="btn-glass flex-1 py-2 text-xs flex items-center justify-center gap-1.5">
                  {copied ? <Check size={12} /> : <Copy size={12} />} คัดลอก Payload
                </button>
                <button onClick={reset} className="btn-glass flex-1 py-2 text-xs flex items-center justify-center gap-1.5">
                  <RefreshCw size={12} /> ยกเลิก
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
