import { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSupabaseUploadPrefix } from "@/lib/supabaseSync";

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  /** Sub-folder inside the user's storage prefix, e.g. "logo", "category", "banner" */
  folder?: string;
  /** Max file size in MB (default 5) */
  maxSizeMB?: number;
  placeholder?: string;
  previewClassName?: string;
  /** Bucket to upload to. Defaults to "product-images" (already public + RLS). */
  bucket?: string;
  /** Optional preview image height for banner-style previews */
  compact?: boolean;
}

/**
 * Reusable image upload field with URL fallback.
 * - Paste a URL directly, OR
 * - Click Upload to pick a file → uploads to Supabase Storage → returns public URL.
 * RLS requires the path's first folder to equal the authenticated Supabase user id,
 * which is bridged from Firebase via `getSupabaseUploadPrefix()`.
 */
export default function ImageUploadField({
  value,
  onChange,
  folder = "misc",
  maxSizeMB = 5,
  placeholder = "https://... หรือกดอัปโหลด",
  previewClassName = "w-12 h-12 rounded-xl object-cover border border-border shrink-0",
  bucket = "product-images",
  compact = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("ไฟล์ต้องเป็นรูปภาพ");
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`ไฟล์ใหญ่เกิน ${maxSizeMB}MB`);
      return;
    }
    setBusy(true);
    const tid = `up-${folder}-${Date.now()}`;
    toast.loading("กำลังอัปโหลด...", { id: tid });
    try {
      const prefix = await getSupabaseUploadPrefix();
      const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${prefix}/site/${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("อัปโหลดสำเร็จ!", { id: tid });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      toast.error("อัปโหลดล้มเหลว: " + msg, { id: tid });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="url"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="input-glass flex-1 px-3 py-2.5 text-sm min-w-0"
        placeholder={placeholder}
      />
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-glass px-3 py-2.5 text-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        title="อัปโหลดรูป"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        <span className="hidden sm:inline">อัปโหลด</span>
      </button>
      {value && (
        <>
          <img
            src={value}
            alt="preview"
            className={compact ? "w-24 h-10 rounded-lg object-cover border border-border shrink-0" : previewClassName}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="btn-glass px-2 py-2 text-xs shrink-0"
            title="ล้าง"
          >
            <X size={12} />
          </button>
        </>
      )}
    </div>
  );
}
