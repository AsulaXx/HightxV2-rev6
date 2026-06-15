import { Save, Plus, Trash2, Wrench, MoveUp, MoveDown } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import type { ServiceItem } from "@/contexts/SiteSettingsContext";

const AdminServicesTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const filteredServices = (form.serviceItems || [])
    .sort((a: ServiceItem, b: ServiceItem) => (a.order ?? 0) - (b.order ?? 0));

  const addService = () => {
    const maxOrder = Math.max(0, ...(form.serviceItems || []).map((s: ServiceItem) => s.order ?? 0));
    setForm({ ...form, serviceItems: [...(form.serviceItems || []), { id: generateId(), name: "", description: "", icon: "🔧", imageUrl: "", bannerUrl: "", gradient: "from-primary/20 to-accent/20", url: "", enabled: true, order: maxOrder + 1 }] });
  };
  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    setForm({ ...form, serviceItems: (form.serviceItems || []).map((s: ServiceItem) => s.id === id ? { ...s, ...updates } : s) });
  };
  const removeService = (id: string) => {
    setForm({ ...form, serviceItems: (form.serviceItems || []).filter((s: ServiceItem) => s.id !== id) });
  };
  const moveService = (idx: number, dir: number) => {
    const items = [...(form.serviceItems || [])].sort((a: ServiceItem, b: ServiceItem) => (a.order ?? 0) - (b.order ?? 0));
    if (idx + dir < 0 || idx + dir >= items.length) return;
    [items[idx], items[idx + dir]] = [items[idx + dir], items[idx]];
    items.forEach((s: ServiceItem, i: number) => s.order = i);
    setForm({ ...form, serviceItems: items });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">บริการอื่นๆ</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการรายการบริการบนหน้าแรก {(form.serviceItems || []).length} รายการ</p>
        </div>
        <button onClick={addService} className="btn-gradient px-4 py-2 text-sm flex items-center gap-2"><Plus size={14} /> เพิ่มบริการ</button>
      </div>

      {filteredServices.length === 0 ? (
        <div className="glass-card text-center py-12">
          <Wrench size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">ยังไม่มีบริการ</p>
          <button onClick={addService} className="btn-gradient px-4 py-2 text-sm mt-4"><Plus size={14} className="inline mr-1" />เพิ่มบริการแรก</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service: ServiceItem, idx: number) => (
            <div key={service.id} className="glass-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{service.icon || "🔧"}</span>
                  <h3 className="text-sm font-bold text-foreground">{service.name || "บริการใหม่"}</h3>
                  {!service.enabled && <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">ซ่อน</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveService(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30"><MoveUp size={14} /></button>
                  <button onClick={() => moveService(idx, 1)} disabled={idx === filteredServices.length - 1} className="p-1.5 rounded-lg hover:bg-muted/50 disabled:opacity-30"><MoveDown size={14} /></button>
                  <button onClick={() => removeService(service.id)} className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">ชื่อบริการ</label>
                  <input type="text" value={service.name} onChange={(e) => updateService(service.id, { name: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="ชื่อบริการ" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Icon (Emoji)</label>
                  <input type="text" value={service.icon} onChange={(e) => updateService(service.id, { icon: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="🔧" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">คำอธิบาย</label>
                  <input type="text" value={service.description} onChange={(e) => updateService(service.id, { description: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="คำอธิบายสั้นๆ" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">URL ลิงก์</label>
                  <input type="text" value={service.url} onChange={(e) => updateService(service.id, { url: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="/path หรือ https://..." />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">รูปภาพ Icon URL</label>
                  <input type="text" value={service.imageUrl} onChange={(e) => updateService(service.id, { imageUrl: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="URL รูปภาพ" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">Banner URL</label>
                  <input type="text" value={service.bannerUrl} onChange={(e) => updateService(service.id, { bannerUrl: e.target.value })} className="input-glass w-full px-3 py-2 text-sm" placeholder="URL แบนเนอร์" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={service.enabled} onChange={(e) => updateService(service.id, { enabled: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 rounded-full bg-muted peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
                <span className="text-xs font-medium text-foreground">แสดงบนหน้าแรก</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกบริการ</button>
    </div>
  );
};

export default AdminServicesTab;
