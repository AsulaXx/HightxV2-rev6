import { Gift, Loader2 } from "lucide-react";

interface Props {
  giftCodeInput: string;
  redeeming: boolean;
  onCodeChange: (code: string) => void;
  onRedeem: () => void;
}

const TopUpGiftCode = ({ giftCodeInput, redeeming, onCodeChange, onRedeem }: Props) => (
  <div>
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
      <Gift size={16} className="text-purple-500" /> เติมเงินด้วย Gift Code
    </h3>
    <p className="text-[10px] text-muted-foreground/60 mb-4">กรอก Gift Code ที่ได้รับมาเพื่อเติมเครดิต</p>

    <div className="space-y-3">
      <input
        type="text"
        value={giftCodeInput}
        onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
        placeholder="กรอก Gift Code..."
        className="w-full px-4 py-3 rounded-xl border border-border/30 bg-muted/5 text-sm font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all tracking-wider"
      />

      {giftCodeInput.trim() && (
        <button
          onClick={onRedeem}
          disabled={redeeming}
          className="w-full btn-glass !bg-purple-500/10 hover:!bg-purple-500/20 !border-purple-500/20 !text-purple-500 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {redeeming ? (
            <><Loader2 size={16} className="animate-spin" /> กำลังตรวจสอบ...</>
          ) : (
            <><Gift size={16} /> แลก Gift Code</>
          )}
        </button>
      )}
    </div>
  </div>
);

export default TopUpGiftCode;
