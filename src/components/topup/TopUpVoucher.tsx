import { Gift, Link2, AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  voucherUrl: string;
  verifying: boolean;
  verifyResult: any;
  verifyError: string | null;
  truewalletPhone: string;
  onUrlChange: (url: string) => void;
  onVerify: () => void;
}

const TopUpVoucher = ({ voucherUrl, verifying, verifyResult, verifyError, truewalletPhone, onUrlChange, onVerify }: Props) => (
  <div>
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
      <Gift size={16} className="text-emerald-500" /> เติมเงินผ่านซองอั่งเปา
    </h3>
    <p className="text-[10px] text-muted-foreground/60 mb-4">วางลิงก์ซองอั่งเปา TrueWallet (gift.truemoney.com) ด้านล่าง</p>

    <div className="space-y-3">
      <div className="relative">
        <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          value={voucherUrl}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://gift.truemoney.com/campaign/?v=..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border/30 bg-muted/5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
      </div>

      {voucherUrl.trim() && !verifyResult && !verifyError && (
        <button
          onClick={onVerify}
          disabled={verifying}
          className="w-full btn-glass !bg-emerald-500/10 hover:!bg-emerald-500/20 !border-emerald-500/20 !text-emerald-500 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {verifying ? (
            <><Loader2 size={16} className="animate-spin" /> กำลังรับซองอั่งเปา...</>
          ) : (
            <><Gift size={16} /> รับซองและเติมเงิน</>
          )}
        </button>
      )}

      {!truewalletPhone && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
          <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
          <p className="text-[10px] text-yellow-500">Admin ยังไม่ได้ตั้งค่าเบอร์ TrueWallet - กรุณาแจ้ง Admin ตั้งค่าก่อน</p>
        </div>
      )}
    </div>
  </div>
);

export default TopUpVoucher;
