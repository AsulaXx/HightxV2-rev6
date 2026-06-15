import React, { useRef } from "react";
import { Camera, Smartphone, X, CheckCircle, Loader2 } from "lucide-react";

interface Props {
  slipImage: string | null;
  verifying: boolean;
  verifyResult: any;
  verifyError: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onVerify: () => void;
  onReset: () => void;
}

const TopUpTrueWallet = ({ slipImage, verifying, verifyResult, verifyError, onFileSelect, onPaste, onVerify, onReset }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div onPaste={onPaste}>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-1">
        <Smartphone size={16} className="text-orange-500" /> เติมเงินผ่าน TrueWallet
      </h3>
      <p className="text-[10px] text-muted-foreground/60 mb-4">อัปโหลดรูปสลิป TrueWallet หรือวางรูป (Ctrl+V)</p>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />

      {!slipImage ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border/40 hover:border-orange-500/30 rounded-2xl p-8 flex flex-col items-center gap-3 transition-all duration-300 hover:bg-orange-500/[0.02] group"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-400/10 border border-orange-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Camera size={28} className="text-orange-500/60" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">คลิกเพื่ออัปโหลดรูปสลิป TrueWallet</p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">หรือวางรูป (Ctrl+V) ได้เลย</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">รองรับ JPG, PNG, WEBP สูงสุด 10MB</p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative group">
            <img src={slipImage} alt="TrueWallet slip preview" className="w-full max-h-80 object-contain rounded-xl border border-border/20" />
            <button
              onClick={onReset}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur border border-border/30 flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/30 transition-all"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {!verifyResult && !verifyError && (
            <button
              onClick={onVerify}
              disabled={verifying}
              className="w-full btn-glass !bg-orange-500/10 hover:!bg-orange-500/20 !border-orange-500/20 !text-orange-500 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verifying ? (
                <><Loader2 size={16} className="animate-spin" /> กำลังตรวจสอบสลิป...</>
              ) : (
                <><CheckCircle size={16} /> ตรวจสอบและเติมเงิน</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TopUpTrueWallet;
