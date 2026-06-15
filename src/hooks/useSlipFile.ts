import { useState, useRef } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const useSlipFile = () => {
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("ไฟล์ใหญ่เกินไป (สูงสุด 10MB)");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setSlipImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setSlipImage(reader.result as string);
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  const reset = () => {
    setSlipImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return { slipImage, setSlipImage, fileInputRef, handleFileSelect, handlePaste, reset };
};
