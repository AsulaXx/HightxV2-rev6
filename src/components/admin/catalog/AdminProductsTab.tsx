import { useState, useRef, useCallback, useEffect } from "react";
import { Save, Plus, Trash2, Search, ChevronDown, ChevronUp, Package, Clock, ArrowUp, ArrowDown, GripVertical, Edit3, X, ExternalLink, Upload, Maximize2, Minimize2 } from "lucide-react";
import { AdminTabProps, generateId } from "../shared/AdminTabProps";
import { type Product, type ProductDuration } from "@/contexts/SiteSettingsContext";
import { TENANT_URLS } from "@/lib/tenantConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminProductsTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [productSearch, setProductSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  // Dynamic tile size: 120 – 320 px (min width per card). Persisted.
  const [tileSize, setTileSize] = useState<number>(() => {
    try { return Math.max(120, Math.min(320, parseInt(localStorage.getItem("admin_products_tile") || "170"))); }
    catch { return 170; }
  });
  useEffect(() => { try { localStorage.setItem("admin_products_tile", String(tileSize)); } catch {} }, [tileSize]);
  const touchStartY = useRef<number>(0);
  const touchDragIdx = useRef<number | null>(null);

  const products = form.products || [];

  const addProduct = () => {
    const newId = generateId();
    setForm({ ...form, products: [...products, { id: newId, name: "", description: "", imageUrl: "", durations: [], enabled: true }] });
    setExpandedProduct(newId);
  };
  const updateProduct = (id: string, updates: Partial<Product>) => { setForm({ ...form, products: products.map((p: Product) => (p.id === id ? { ...p, ...updates } : p)) }); };
  const removeProduct = (id: string) => { setForm({ ...form, products: products.filter((p: Product) => p.id !== id) }); if (expandedProduct === id) setExpandedProduct(null); setDeleteTargetId(null); };
  const addDuration = (productId: string) => { const prods = products.map((p: Product) => p.id === productId ? { ...p, durations: [...p.durations, { id: generateId(), label: "", days: 1, price: 0 }] } : p); setForm({ ...form, products: prods }); };
  const updateDuration = (productId: string, durationId: string, updates: Partial<ProductDuration>) => { const prods = products.map((p: Product) => p.id === productId ? { ...p, durations: p.durations.map((d: ProductDuration) => (d.id === durationId ? { ...d, ...updates } : d)) } : p); setForm({ ...form, products: prods }); };
  const removeDuration = (productId: string, durationId: string) => { const prods = products.map((p: Product) => p.id === productId ? { ...p, durations: p.durations.filter((d: ProductDuration) => d.id !== durationId) } : p); setForm({ ...form, products: prods }); };

  const reorderProducts = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const prods = [...products];
    const [moved] = prods.splice(fromIdx, 1);
    prods.splice(toIdx, 0, moved);
    setForm({ ...form, products: prods });
  }, [products, form, setForm]);

  const moveDuration = (productId: string, fromIdx: number, direction: "up" | "down") => {
    const prods = products.map((p: Product) => {
      if (p.id !== productId) return p;
      const durs = [...p.durations];
      const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0 || toIdx >= durs.length) return p;
      [durs[fromIdx], durs[toIdx]] = [durs[toIdx], durs[fromIdx]];
      return { ...p, durations: durs };
    });
    setForm({ ...form, products: prods });
  };

  const filteredProducts = products.filter((p: Product) =>
    !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.description?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return null;
    return (form.categories || []).find((c: any) => c.id === categoryId)?.name || null;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการสินค้า</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} สินค้า</p>
        </div>
        <button onClick={addProduct} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> เพิ่มสินค้า</button>
      </div>

      {/* Search + tile-size slider */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="input-glass w-full pl-9 pr-4 py-2.5 text-sm" placeholder="ค้นหาสินค้า..." />
        </div>
        <div className="flex items-center gap-2 px-3 h-[42px] rounded-xl border border-border/40 bg-muted/20">
          <Minimize2 size={12} className="text-muted-foreground shrink-0" />
          <input
            type="range" min={120} max={320} step={10}
            value={tileSize}
            onChange={(e) => setTileSize(parseInt(e.target.value))}
            className="w-24 sm:w-32 accent-primary cursor-pointer"
            title={`ขนาดรูป: ${tileSize}px`}
          />
          <Maximize2 size={12} className="text-muted-foreground shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground w-9 text-right">{tileSize}px</span>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Package size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{productSearch ? "ไม่พบสินค้า" : "ยังไม่มีสินค้า"}</p>
        </div>
      ) : (
        <>
          {/* Image-tile grid — auto-fill by dynamic tile size */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
          >
            {filteredProducts.map((product: Product, idx: number) => {
              const globalIdx = products.findIndex((p: Product) => p.id === product.id);
              const isDragging = dragIdx === globalIdx;
              const isDragOver = dragOverIdx === globalIdx;
              const catName = getCategoryName(product.categoryId);
              const minP = product.durations.length ? Math.min(...product.durations.map(d => d.price || 0)) : null;
              const maxP = product.durations.length ? Math.max(...product.durations.map(d => d.price || 0)) : null;
              const stockCount = product.durations.length;
              const av = product.availability || "available";
              return (
                <div
                  key={product.id}
                  draggable
                  onDragStart={(e) => { setDragIdx(globalIdx); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(globalIdx)); }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(globalIdx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => { e.preventDefault(); setDragOverIdx(null); const from = parseInt(e.dataTransfer.getData("text/plain")); if (!isNaN(from)) reorderProducts(from, globalIdx); setDragIdx(null); }}
                  className={`group relative rounded-xl overflow-hidden border bg-card cursor-grab active:cursor-grabbing transition-all ${
                    isDragging ? "opacity-40 scale-95" : ""
                  } ${isDragOver ? "ring-2 ring-primary/60 border-primary/50" : "border-border hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"}`}
                >
                  {/* Image / placeholder */}
                  <div className="relative aspect-[4/5] bg-muted/30 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.thumbnailUrl || product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-fill transition-transform group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={32} className="text-muted-foreground/20" /></div>
                    )}
                    {/* gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                    {/* top badges */}
                    <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-1">
                      <div className="flex flex-col gap-1">
                        {product.durations.some(d => d.linkMode) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-sky-500/90 text-white font-bold flex items-center gap-0.5 backdrop-blur-sm">
                            <ExternalLink size={9} /> LINK
                          </span>
                        )}
                        {av !== "available" && av !== "hidden" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/90 text-white font-bold backdrop-blur-sm">
                            {av === "updating" ? "🔧" : "⛔"}
                          </span>
                        )}
                        {av === "hidden" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-500/90 text-white font-bold backdrop-blur-sm">
                            👁️‍🗨️ ซ่อนสถานะ
                          </span>
                        )}
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/50 ${product.enabled ? "bg-emerald-400" : "bg-muted-foreground/50"}`} title={product.enabled ? "เปิดขาย" : "ปิดอยู่"} />
                    </div>

                    {/* bottom info */}
                    <div className="absolute inset-x-0 bottom-0 p-2 text-white">
                      <h3 className="text-xs font-bold truncate drop-shadow">{product.name || `สินค้า #${idx + 1}`}</h3>
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        {minP !== null ? (
                          <span className="text-[10px] font-bold text-primary-foreground bg-primary/90 px-1.5 py-0.5 rounded backdrop-blur-sm">
                            ฿{minP}{maxP !== minP && `-${maxP}`}
                          </span>
                        ) : <span className="text-[9px] text-white/70">ยังไม่ตั้งราคา</span>}
                        <span className="text-[9px] text-white/70">{stockCount} ตัวเลือก</span>
                      </div>
                      {catName && <p className="text-[9px] text-white/60 truncate mt-0.5">📂 {catName}</p>}
                    </div>
                  </div>

                  {/* Actions bar — ตั้งค่าสินค้า + ลบ */}
                  <div className="p-2 flex items-center gap-1.5 bg-card border-t border-border">
                    <button
                      onClick={() => setExpandedProduct(product.id)}
                      className="flex-1 px-2 py-2 rounded-lg text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit3 size={12} /> ตั้งค่าสินค้า
                    </button>
                    <button
                      onClick={() => setDeleteTargetId(product.id)}
                      className="p-2 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors"
                      title="ลบสินค้า"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ───── Edit Dialog (rendered once, controlled by expandedProduct) ───── */}
          {(() => {
            const product = products.find((p: Product) => p.id === expandedProduct);
            if (!product) return null;
            const idx = products.findIndex((p: Product) => p.id === product.id);
            return (
              <Dialog open={!!expandedProduct} onOpenChange={(o) => !o && setExpandedProduct(null)}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <Edit3 size={16} className="text-primary" />
                      แก้ไขสินค้า: {product.name || `สินค้า #${idx + 1}`}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">



                  <div className="px-1 pb-4 space-y-4">
                      {/* Toggle & Delete bar */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <div className={`toggle-slider ${product.enabled ? "toggle-active" : ""}`} onClick={() => updateProduct(product.id, { enabled: !product.enabled })} />
                          <span className="text-xs font-medium text-foreground">{product.enabled ? "เปิดขาย" : "ปิดอยู่"}</span>
                        </label>
                        <button onClick={() => setDeleteTargetId(product.id)} className="px-3 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 border border-destructive/20 flex items-center gap-1 transition-colors">
                          <Trash2 size={11} /> ลบสินค้า
                        </button>
                      </div>

                      {/* Availability status */}
                      {(() => {
                        const av = product.availability || "available";
                        const isHidden = av === "hidden";
                        const isAv = av !== "available" && !isHidden;
                        return (
                          <div className={`rounded-lg border p-2.5 space-y-2 ${isHidden ? 'border-slate-500/30 bg-slate-500/5' : isAv ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/40 bg-muted/5'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                🟡 สถานะความพร้อมขาย
                              </label>
                              <select
                                value={av}
                                onChange={(e) => updateProduct(product.id, { availability: e.target.value as Product["availability"] })}
                                className="input-glass px-2 py-1.5 text-xs"
                              >
                                <option value="available">✅ เปิดขายปกติ</option>
                                <option value="unavailable">⛔ ปิดการขาย (ยังแสดงสินค้า)</option>
                                <option value="updating">🔧 ปิดการขาย - กำลังอัปเดท (รูป+ป้ายเหลือง)</option>
                                <option value="hidden">👁️‍🗨️ ไม่แสดงสถานะใดๆ (ซ่อนทุกป้ายแม้คีย์หมด)</option>
                              </select>
                            </div>
                            {isHidden && (
                              <p className="text-[10px] text-slate-400">
                                สินค้าจะแสดงในร้านแบบไม่มีป้ายสถานะใดๆ (ไม่มี "คีย์หมด" / "ปิดการขาย" / "กำลังอัปเดท") — ลูกค้ายังกดซื้อได้ตามปกติถ้ามีคีย์
                              </p>
                            )}
                            {isAv && (
                              <>
                                <input
                                  type="text"
                                  value={product.availabilityMessage || ""}
                                  onChange={(e) => updateProduct(product.id, { availabilityMessage: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder={av === "updating" ? "เช่น กำลังอัปเดทเวอร์ชันใหม่ กรุณารอสักครู่" : "เช่น ปิดการขายชั่วคราว"}
                                />
                                <p className="text-[10px] text-amber-500/80">
                                  {av === "updating"
                                    ? "สินค้าจะยังแสดงในร้าน + รูปจะมีไอคอนประแจหมุน + ริบบิ้นสีเหลืองว่ากำลังอัปเดท ลูกค้าซื้อไม่ได้"
                                    : "สินค้ายังแสดงในร้าน แต่ลูกค้าจะกดซื้อไม่ได้ (ขึ้นป้ายปิดการขาย)"}
                                </p>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Public status (shown on /product-status page for customers) */}
                      {(() => {
                        const ps = product.publicStatus || "safe";
                        const meta: Record<string, { label: string; ring: string; bg: string }> = {
                          safe:     { label: "🟢 ปลอดภัย / Safe",            ring: "border-emerald-500/30", bg: "bg-emerald-500/5" },
                          risky:    { label: "🟠 เล่นด้วยความเสี่ยง / Risky", ring: "border-orange-500/30",  bg: "bg-orange-500/5" },
                          updating: { label: "🟡 กำลังอัปเดท / Updating",     ring: "border-yellow-500/30",  bg: "bg-yellow-500/5" },
                          closed:   { label: "🔴 ปิดการขาย / Closed",         ring: "border-red-500/30",     bg: "bg-red-500/5" },
                        };
                        const m = meta[ps];
                        return (
                          <div className={`rounded-lg border p-2.5 space-y-2 ${m.ring} ${m.bg}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <label className="text-[11px] font-semibold text-foreground">
                                สถานะสาธารณะ (หน้า Product Status) — {m.label}
                              </label>
                              <select
                                value={ps}
                                onChange={(e) => updateProduct(product.id, { publicStatus: e.target.value as Product["publicStatus"] })}
                                className="input-glass px-2 py-1.5 text-xs"
                              >
                                <option value="safe">🟢 ปลอดภัย / Safe</option>
                                <option value="risky">🟠 เล่นด้วยความเสี่ยง / Risky</option>
                                <option value="updating">🟡 กำลังอัปเดท / Updating</option>
                                <option value="closed">🔴 ปิดการขาย / Closed</option>
                              </select>
                            </div>
                            <input
                              type="text"
                              value={product.publicStatusNote || ""}
                              onChange={(e) => updateProduct(product.id, { publicStatusNote: e.target.value })}
                              className="input-glass w-full px-2.5 py-1.5 text-xs"
                              placeholder="หมายเหตุ (TH/EN) - เช่น 'รออัปเดตวันพรุ่งนี้ / Update tomorrow'"
                            />
                            <label className="flex items-center gap-2 text-[11px] text-foreground cursor-pointer select-none pt-1">
                              <input
                                type="checkbox"
                                checked={product.showOnStatusPage !== false}
                                onChange={(e) => updateProduct(product.id, { showOnStatusPage: e.target.checked })}
                                className="w-3.5 h-3.5 accent-primary"
                              />
                              แสดงสินค้านี้ในหน้า /product-status
                            </label>
                            <p className="text-[10px] text-muted-foreground">
                              ปิดเช็คเพื่อซ่อนสินค้านี้จากหน้าสถานะสินค้าสาธารณะ
                            </p>
                          </div>
                        );
                      })()}


                      {/* Basic Info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">ชื่อสินค้า</label>
                          <input type="text" value={product.name} onChange={(e) => updateProduct(product.id, { name: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="VIP Key" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">หมวดหมู่</label>
                          <select value={product.categoryId || ""} onChange={(e) => updateProduct(product.id, { categoryId: e.target.value || undefined })} className="input-glass w-full px-3 py-2 text-sm">
                            <option value="">-- ไม่ระบุ --</option>
                            {(form.categories || []).filter((c: any) => c.enabled).map((c: any) => (
                              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        <div className="lg:col-span-2 space-y-3">
                          <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">คำอธิบาย</label>
                            <textarea value={product.description} onChange={(e) => updateProduct(product.id, { description: e.target.value })} className="input-glass w-full px-3 py-2 text-sm min-h-[60px] resize-y" placeholder="รายละเอียดสินค้า..." />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-muted-foreground mb-1">📝 หมายเหตุ <span className="text-[9px] text-muted-foreground/60">(แสดงในประวัติหลังซื้อ)</span></label>
                            <textarea value={product.remark || ""} onChange={(e) => updateProduct(product.id, { remark: e.target.value })} className="input-glass w-full px-3 py-2 text-sm min-h-[40px] resize-y" placeholder="วิธีใช้งาน, ลิงก์ดาวน์โหลด..." />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">รูปสินค้า</label>
                          <div className="flex gap-2">
                            <input type="url" value={product.imageUrl} onChange={(e) => updateProduct(product.id, { imageUrl: e.target.value })} className="input-glass flex-1 px-3 py-2 text-sm" placeholder="URL รูปภาพ หรืออัพโหลด" />
                            <label className="btn-glass px-3 py-2 text-xs flex items-center gap-1 cursor-pointer shrink-0" title="อัพโหลดรูป">
                              <Upload size={13} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (!file.type.startsWith("image/")) { toast.error("ไฟล์ต้องเป็นรูปภาพ"); return; }
                                  if (file.size > 5 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 5MB"); return; }
                                  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
                                  const stamp = Date.now();
                                  toast.loading("กำลังอัพโหลดรูป...", { id: `pimg-${product.id}` });
                                  let origPath: string;
                                  let thumbPath: string;
                                  try {
                                    const { getSupabaseUploadPrefix } = await import("@/lib/supabaseSync");
                                    const prefix = await getSupabaseUploadPrefix();
                                    origPath = `${prefix}/${product.id}/${stamp}.${ext}`;
                                    thumbPath = `${prefix}/${product.id}/${stamp}-thumb.webp`;
                                  } catch (err: any) {
                                    toast.error("เซสชันหมดอายุ กรุณา login ใหม่", { id: `pimg-${product.id}` });
                                    return;
                                  }

                                  try {
                                    // Generate thumbnail (max 400px wide, webp ~0.82)
                                    const dataUrl = await new Promise<string>((resolve, reject) => {
                                      const fr = new FileReader();
                                      fr.onload = () => resolve(fr.result as string);
                                      fr.onerror = () => reject(new Error("read fail"));
                                      fr.readAsDataURL(file);
                                    });
                                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                                      const im = new Image();
                                      im.onload = () => resolve(im);
                                      im.onerror = () => reject(new Error("img fail"));
                                      im.src = dataUrl;
                                    });
                                    const MAX = 400;
                                    const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
                                    const w = Math.round(img.width * ratio);
                                    const h = Math.round(img.height * ratio);
                                    const canvas = document.createElement("canvas");
                                    canvas.width = w; canvas.height = h;
                                    const ctx = canvas.getContext("2d");
                                    if (!ctx) throw new Error("no ctx");
                                    ctx.drawImage(img, 0, 0, w, h);
                                    const thumbBlob: Blob = await new Promise((resolve, reject) => {
                                      canvas.toBlob((b) => b ? resolve(b) : reject(new Error("blob fail")), "image/webp", 0.82);
                                    });

                                    // Upload both in parallel
                                    const [origRes, thumbRes] = await Promise.all([
                                      supabase.storage.from("product-images").upload(origPath, file, { cacheControl: "3600", upsert: false }),
                                      supabase.storage.from("product-images").upload(thumbPath, thumbBlob, { cacheControl: "3600", upsert: false, contentType: "image/webp" }),
                                    ]);
                                    if (origRes.error) throw origRes.error;
                                    if (thumbRes.error) throw thumbRes.error;
                                    const origUrl = supabase.storage.from("product-images").getPublicUrl(origPath).data.publicUrl;
                                    const thumbUrl = supabase.storage.from("product-images").getPublicUrl(thumbPath).data.publicUrl;
                                    updateProduct(product.id, { imageUrl: origUrl, thumbnailUrl: thumbUrl });
                                    toast.success("อัพโหลดสำเร็จ!", { id: `pimg-${product.id}` });
                                  } catch (err: any) {
                                    toast.error("อัพโหลดล้มเหลว: " + (err?.message || "unknown"), { id: `pimg-${product.id}` });
                                  }
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                          {product.imageUrl ? (
                            <div className="relative group">
                              <img src={product.thumbnailUrl || product.imageUrl} alt={product.name} className="w-full h-32 rounded-xl object-cover border border-border" />
                              <button onClick={() => updateProduct(product.id, { imageUrl: "", thumbnailUrl: "" })} className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                              {product.thumbnailUrl && <span className="absolute bottom-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/80 text-white font-bold">THUMB</span>}
                            </div>
                          ) : (
                            <div className="w-full h-32 rounded-xl border-2 border-dashed border-border/30 flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground/40">ไม่มีรูป</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OG / Share preview */}
                      {(() => {
                        const useProductImg = product.ogUseProductImage !== false;
                        const previewImg = useProductImg
                          ? (product.imageUrl || product.ogImage || "")
                          : (product.ogImage || product.imageUrl || "");
                        return (
                          <div className="rounded-xl border border-border/40 bg-muted/5 p-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                🔗 Open Graph (พรีวิวเวลาแชร์ลิงก์)
                              </label>
                              <span className="text-[9px] text-muted-foreground/60">ปล่อยว่างเพื่อใช้ค่าจากชื่อ/คำอธิบายสินค้า</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1">OG Title</label>
                                <input
                                  type="text"
                                  value={product.ogTitle || ""}
                                  onChange={(e) => updateProduct(product.id, { ogTitle: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder={`${product.name || "ชื่อสินค้า"} — แบรนด์`}
                                  maxLength={120}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1">OG Description</label>
                                <input
                                  type="text"
                                  value={product.ogDescription || ""}
                                  onChange={(e) => updateProduct(product.id, { ogDescription: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder="คำอธิบายสั้นๆ ที่จะโชว์ตอนแชร์"
                                  maxLength={200}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <div
                                className={`toggle-slider shrink-0 ${useProductImg ? "toggle-active" : ""}`}
                                onClick={() => updateProduct(product.id, { ogUseProductImage: !useProductImg })}
                                title="ใช้รูปสินค้าเป็น OG image อัตโนมัติ"
                                style={{ transform: "scale(0.8)" }}
                              />
                              <span className="text-[11px] text-foreground">ใช้รูปสินค้าเป็น OG image อัตโนมัติ</span>
                            </div>
                            {!useProductImg && (
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1">OG Image URL (กำหนดเอง)</label>
                                <input
                                  type="url"
                                  value={product.ogImage || ""}
                                  onChange={(e) => updateProduct(product.id, { ogImage: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder="https://... (แนะนำ 1200x630)"
                                />
                              </div>
                            )}
                            {(() => {
                              const brand = form.brandName || "HightXClient";
                              const previewTitle = (product.ogTitle || "").trim() || `${product.name || "ชื่อสินค้า"} — ${brand}`;
                              const previewDesc = (product.ogDescription || "").trim() || product.description || `สินค้า ${product.name || ""} จาก ${brand}`;
                              const rawOrigin = (form.ogSiteUrl || TENANT_URLS.siteUrl || "https://hightxclient.com").replace(/\/$/, "");
                              let host = "hightxclient.com";
                              try { host = new URL(rawOrigin).host.replace(/^www\./, ""); } catch { host = rawOrigin.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]; }
                              return (
                                <div className="pt-2 space-y-1.5">
                                  <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                    👁 พรีวิวเวลาแชร์ลิงก์ (Facebook / Discord / LINE)
                                  </p>
                                  <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/20 max-w-md">
                                    {previewImg ? (
                                      <div className="aspect-[1.91/1] bg-muted/30 overflow-hidden">
                                        <img src={previewImg} alt="OG preview" className="w-full h-full object-cover" />
                                      </div>
                                    ) : (
                                      <div className="aspect-[1.91/1] bg-muted/30 flex items-center justify-center">
                                        <span className="text-[10px] text-amber-500/80">⚠ ยังไม่มีรูปสำหรับ OG</span>
                                      </div>
                                    )}
                                    <div className="px-3 py-2 bg-background/40 space-y-0.5">
                                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 truncate">{host}</p>
                                      <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{previewTitle}</p>
                                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">{previewDesc}</p>
                                    </div>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/60">
                                    * พรีวิวจะอัปเดตเมื่อ publish/build ครั้งถัดไป (OG ถูก prerender ตอน build)
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}

                      {/* Video & Post-purchase buttons */}
                      {(() => {
                        const buttons = product.postPurchaseButtons || [];
                        const setButtons = (next: { label: string; url: string }[]) => updateProduct(product.id, { postPurchaseButtons: next });
                        const addButton = () => { if (buttons.length >= 4) return; setButtons([...buttons, { label: "", url: "" }]); };
                        const updateButton = (i: number, patch: Partial<{ label: string; url: string }>) => setButtons(buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b));
                        const removeButton = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));
                        return (
                          <div className="rounded-xl border border-border/40 bg-muted/5 p-3 space-y-3">
                            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              🎬 คลิปตัวอย่าง / คลิปสอน
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              <div className="md:col-span-2">
                                <label className="block text-[10px] text-muted-foreground mb-1">ลิงก์วิดีโอ (YouTube / Drive / อื่นๆ)</label>
                                <input
                                  type="url"
                                  value={product.videoUrl || ""}
                                  onChange={(e) => updateProduct(product.id, { videoUrl: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder="https://youtu.be/..."
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-muted-foreground mb-1">ป้ายปุ่ม</label>
                                <input
                                  type="text"
                                  value={product.videoLabel || ""}
                                  onChange={(e) => updateProduct(product.id, { videoLabel: e.target.value })}
                                  className="input-glass w-full px-2.5 py-1.5 text-xs"
                                  placeholder="ดูคลิปตัวอย่าง"
                                  maxLength={40}
                                />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70">ปุ่มจะแสดงใต้รูปสินค้าในหน้า /product</p>

                            <div className="border-t border-border/30 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  🔗 ปุ่มหลังกดซื้อ ({buttons.length}/4)
                                </label>
                                <button
                                  onClick={addButton}
                                  disabled={buttons.length >= 4}
                                  className="btn-glass px-2.5 py-1 text-[10px] flex items-center gap-1 disabled:opacity-30"
                                >
                                  <Plus size={10} /> เพิ่มปุ่ม
                                </button>
                              </div>
                              {buttons.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground/60 text-center py-3 rounded-lg border-2 border-dashed border-border/20">
                                  ยังไม่มีปุ่ม (เช่น "ดาวน์โหลด", "คลิปสอนติดตั้ง")
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  {buttons.map((b, i) => (
                                    <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2 items-center">
                                      <input
                                        type="text"
                                        value={b.label}
                                        onChange={(e) => updateButton(i, { label: e.target.value })}
                                        className="input-glass px-2.5 py-1.5 text-xs"
                                        placeholder="ชื่อปุ่ม เช่น ดาวน์โหลด"
                                        maxLength={40}
                                      />
                                      <input
                                        type="url"
                                        value={b.url}
                                        onChange={(e) => updateButton(i, { url: e.target.value })}
                                        className="input-glass px-2.5 py-1.5 text-xs"
                                        placeholder="https://..."
                                      />
                                      <button
                                        onClick={() => removeButton(i)}
                                        className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-[10px] text-muted-foreground/70 mt-2">ปุ่มเหล่านี้จะแสดงในหน้าประวัติการกดคีย์หลังลูกค้าซื้อสินค้านี้</p>
                            </div>
                          </div>
                        );
                      })()}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Clock size={12} /> ตัวเลือกราคา ({product.durations.length})
                          </label>
                          <button onClick={() => addDuration(product.id)} className="btn-glass px-2.5 py-1 text-[10px] flex items-center gap-1"><Plus size={10} /> เพิ่ม</button>
                        </div>
                        {product.durations.length === 0 ? (
                          <div className="text-center py-6 rounded-xl border-2 border-dashed border-border/20">
                            <Clock size={20} className="mx-auto text-muted-foreground/20 mb-1" />
                            <p className="text-xs text-muted-foreground/50">ยังไม่มีตัวเลือก</p>
                            <button onClick={() => addDuration(product.id)} className="text-[10px] text-primary hover:underline mt-1">+ เพิ่มตัวเลือกแรก</button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {product.durations.map((dur: ProductDuration, durIdx: number) => (
                              <div key={dur.id} className={`rounded-lg border ${dur.enabled === false ? 'border-destructive/20 bg-destructive/5' : 'border-border/50 bg-muted/5'} p-2.5`}>
                                <div className="flex items-center gap-2 mb-2">
                                  {/* Duration reorder */}
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button onClick={() => moveDuration(product.id, durIdx, "up")} disabled={durIdx === 0} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowUp size={11} /></button>
                                    <button onClick={() => moveDuration(product.id, durIdx, "down")} disabled={durIdx === product.durations.length - 1} className="p-0.5 text-muted-foreground hover:text-primary disabled:opacity-20 transition-colors"><ArrowDown size={11} /></button>
                                  </div>
                                  {/* Enable/Disable toggle */}
                                  <div
                                    className={`toggle-slider shrink-0 ${dur.enabled !== false ? "toggle-active" : ""}`}
                                    onClick={() => updateDuration(product.id, dur.id, { enabled: dur.enabled === false ? true : false })}
                                    title={dur.enabled !== false ? "เปิดขายอยู่" : "ปิดการขาย (คีย์ยังอยู่ในระบบ)"}
                                    style={{ transform: "scale(0.8)" }}
                                  />
                                  <input type="text" value={dur.label} onChange={(e) => updateDuration(product.id, dur.id, { label: e.target.value })} className="input-glass px-2 py-1.5 text-xs flex-1" placeholder="ชื่อตัวเลือก เช่น 1 วัน" />
                                  <button onClick={() => removeDuration(product.id, dur.id)} className="p-1 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"><Trash2 size={11} /></button>
                                </div>
                                {dur.enabled === false && (
                                  <p className="text-[9px] text-destructive/70 mb-2">⛔ ปิดการขาย — คีย์ยังอยู่ในระบบแต่ลูกค้าไม่สามารถซื้อได้</p>
                                )}

                                {/* กลุ่ม: ราคา */}
                                <div className="rounded-md bg-muted/10 border border-border/30 p-2 mb-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">💰 ราคา & ระยะเวลา</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5">จำนวนวัน</label>
                                      <input type="number" min="1" value={dur.days} onChange={(e) => updateDuration(product.id, dur.id, { days: parseInt(e.target.value) || 1 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5">ราคา ฿</label>
                                      <input type="number" min="0" step="0.01" value={dur.price || 0} onChange={(e) => updateDuration(product.id, dur.id, { price: parseFloat(e.target.value) || 0 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5">ราคาตัวแทน</label>
                                      <input type="number" min="0" step="0.01" value={dur.resellerPrice ?? ""} onChange={(e) => updateDuration(product.id, dur.id, { resellerPrice: e.target.value === "" ? undefined : parseFloat(e.target.value) || 0 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" placeholder="-" />
                                    </div>
                                  </div>
                                </div>

                                {/* กลุ่ม: ขีดจำกัด */}
                                <div className="rounded-md bg-primary/5 border border-primary/20 p-2">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">🛡️ ขีดจำกัด & Cooldown</p>
                                    <span className="text-[9px] text-primary/80 font-medium">0 = ใช้ค่ากลาง (ไม่จำกัด)</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5" title="คีย์สูงสุดที่ผู้ใช้ 1 คนกดได้สำหรับตัวเลือกนี้">🔒 สูงสุด/คน</label>
                                      <input type="number" min="0" max="999" value={dur.maxPerUser || 0} onChange={(e) => updateDuration(product.id, dur.id, { maxPerUser: parseInt(e.target.value) || 0 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" placeholder="0 = ไม่จำกัด" />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5" title="จำนวนคีย์สูงสุดต่อการกด 1 ครั้ง">🛒 สูงสุด/ครั้ง</label>
                                      <input type="number" min="0" max="999" value={dur.maxPerClaim || 0} onChange={(e) => updateDuration(product.id, dur.id, { maxPerClaim: parseInt(e.target.value) || 0 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" placeholder="0 = ไม่จำกัด" />
                                    </div>
                                    <div>
                                      <label className="block text-[9px] text-muted-foreground mb-0.5" title="ต้องรอกี่ชั่วโมงก่อนกดตัวเลือกนี้ได้อีก">⏳ Cooldown (ชม.)</label>
                                      <input type="number" min="0" max="720" value={dur.cooldownHours || 0} onChange={(e) => updateDuration(product.id, dur.id, { cooldownHours: parseInt(e.target.value) || 0 })} className="input-glass px-2 py-1.5 text-xs text-center w-full" placeholder="0 = ไม่มี CD" />
                                    </div>
                                  </div>
                                </div>

                                {/* กลุ่ม: โหมดลิงก์ (Toggle) */}
                                <div className={`rounded-md border p-2 mt-2 transition-colors ${dur.linkMode ? "bg-blue-500/10 border-blue-500/50" : "bg-muted/10 border-border/30"}`}>
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <p className="text-[10px] font-semibold flex items-center gap-1 text-foreground">
                                      <ExternalLink size={10} className={dur.linkMode ? "text-blue-400" : "text-muted-foreground"} />
                                      โหมดลิงก์ (แทนปุ่มซื้อ)
                                    </p>
                                    <div
                                      className={`toggle-slider shrink-0 ${dur.linkMode ? "toggle-active" : ""}`}
                                      onClick={() => updateDuration(product.id, dur.id, { linkMode: !dur.linkMode })}
                                      title={dur.linkMode ? "ปิดโหมดลิงก์ (กลับเป็นโหมดซื้อปกติ)" : "เปิดโหมดลิงก์"}
                                      style={{ transform: "scale(0.75)" }}
                                    />
                                  </div>
                                  {dur.linkMode ? (
                                    <>
                                      <p className="text-[9px] text-blue-400/80 mb-1.5">⚠️ โหมดนี้: ปุ่มจะกลายเป็นลิงก์ — ไม่หักเครดิต ไม่บันทึกประวัติ <b>ไม่สามารถเพิ่มสต๊อกได้</b></p>
                                      <input type="url" value={dur.redirectUrl || ""} onChange={(e) => updateDuration(product.id, dur.id, { redirectUrl: e.target.value })} className="input-glass px-2 py-1.5 text-xs w-full mb-1.5" placeholder="https://example.com/..." />
                                      <div className="grid grid-cols-2 gap-2">
                                        <input type="text" value={dur.redirectLabel || ""} onChange={(e) => updateDuration(product.id, dur.id, { redirectLabel: e.target.value })} className="input-glass px-2 py-1.5 text-xs w-full" placeholder="ป้ายปุ่ม (default: ไปที่ลิงก์)" />
                                        <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                                          <input type="checkbox" checked={dur.redirectOpenInNewTab !== false} onChange={(e) => updateDuration(product.id, dur.id, { redirectOpenInNewTab: e.target.checked })} />
                                          เปิดในแท็บใหม่
                                        </label>
                                      </div>
                                    </>
                                  ) : (
                                    <p className="text-[9px] text-muted-foreground/70">ปิดอยู่ — ใช้โหมดซื้อปกติ (ตัดเครดิต + ใช้สต๊อกคีย์)</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}
        </>
      )}
      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกสินค้า</button>

      {/* ── Confirm delete dialog ── */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={18} className="text-destructive" /> ยืนยันการลบสินค้า
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = products.find((p: Product) => p.id === deleteTargetId);
                return (
                  <>
                    คุณต้องการลบสินค้า <b className="text-foreground">"{t?.name || "ไม่มีชื่อ"}"</b> ใช่หรือไม่?
                    <br />
                    <span className="text-destructive/80 text-xs">⚠️ การลบจะรวมตัวเลือกทั้งหมด ({t?.durations.length || 0} ตัวเลือก) และไม่สามารถย้อนกลับได้</span>
                  </>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && removeProduct(deleteTargetId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 size={14} className="mr-1.5" /> ลบสินค้า
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminProductsTab;
