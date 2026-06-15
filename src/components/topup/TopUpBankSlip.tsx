import React, { useRef } from "react";
import { Camera, Upload, X, CheckCircle, Loader2, QrCode } from "lucide-react";

interface Props {
  slipImage: string | null;
  verifying: boolean;
  verifyResult: any;
  verifyError: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVerify: () => void;
  onReset: () => void;
  // Slip2Go QR payload mode
  payloadMode?: boolean;
  payload?: string;
  onPayloadChange?: (v: string) => void;
}

const TopUpBankSlip = ({ slipImage, verifying, verifyResult, verifyError, onFileSelect, onVerify, onReset, payloadMode, payload, onPayloadChange }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (payloadMode) {
    return (
      <>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <QrCode size={16} className="text-primary" /> วาง QR Payload จากสลิป (Slip2Go)
        </h3>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Slip2Go ตรวจสอบจากข้อความ QR Code ของสลิป (เริ่มต้นด้วย <code className="text-primary">00020101...</code>) ไม่ใช่รูปภาพ
        </p>
        <textarea
          value={payload || ''}
          onChange={(e) => onPayloadChange?.(e.target.value)}
          placeholder="วาง QR payload ที่นี่ เช่น 00020101021229370016A0000006770101110113006681234567..."
          className="input-glass w-full px-3 py-3 text-xs font-mono min-h-[120px] resize-y"
        />
        {!verifyResult && !verifyError && (
          <button
            onClick={onVerify}
            disabled={verifying || !payload?.trim()}
            className="w-full btn-glass !bg-primary/10 hover:!bg-primary/20 !border-primary/20 !text-primary py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifying ? (<><Loader2 size={16} className="animate-spin" /> กำลังตรวจสอบ...</>) : (<><CheckCircle size={16} /> ตรวจสอบและเติมเงิน</>)}
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Upload size={16} className="text-primary" /> อัปโหลดสลิปโอนเงิน
      </h3>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileSelect} className="hidden" />

      {!slipImage ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border/40 hover:border-primary/30 rounded-2xl p-8 flex flex-col items-center gap-3 transition-all duration-300 hover:bg-primary/[0.02] group"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Camera size={28} className="text-primary/60" />
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-foreground">คลิกเพื่ออัปโหลดรูปสลิป</p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">หรือวางรูป (Ctrl+V) ได้เลย</p>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">รองรับ JPG, PNG, WEBP สูงสุด 10MB</p>
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          <div className="relative group">
            <img src={slipImage} alt="Slip preview" className="w-full max-h-80 object-contain rounded-xl border border-border/20" />
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
              className="w-full btn-glass !bg-primary/10 hover:!bg-primary/20 !border-primary/20 !text-primary py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
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
    </>
  );
};

export default TopUpBankSlip;
