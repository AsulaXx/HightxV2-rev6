import { Settings, Image, ExternalLink, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Save } from "lucide-react";
import AdminSection from "./AdminSection";
import { AdminTabProps, generateId } from "./AdminTabProps";
import { type SocialLink } from "@/contexts/SiteSettingsContext";

const AdminGeneralTab = ({ form, setForm, handleSave }: AdminTabProps) => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground">ตั้งค่าทั่วไป</h1>
      <p className="text-sm text-muted-foreground mt-1">จัดการข้อมูลเว็บไซต์และ OG Meta Tags</p>
    </div>
    <AdminSection title="ข้อมูลทั่วไป" icon={<Settings size={18} />} description="ชื่อแบรนด์ หัวข้อ คำบรรยาย">
      {[
        { label: "ชื่อแบรนด์", key: "brandName", type: "text" },
        { label: "หัวข้อหลัก (Hero Title)", key: "heroTitle", type: "text" },
      ].map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-semibold text-foreground mb-2">{f.label}</label>
          <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" />
        </div>
      ))}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">คำบรรยาย (Subtitle)</label>
        <textarea value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className="input-glass w-full px-4 py-3 text-sm min-h-[80px] resize-y" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">ข้อความ Footer</label>
        <input type="text" value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" />
      </div>
    </AdminSection>

    <AdminSection title="Open Graph / แชร์ลิงก์" icon={<Image size={18} />} description="ข้อมูลที่แสดงเมื่อแชร์ลิงก์ไปยัง Discord, LINE, Facebook">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">โดเมนเว็บไซต์ (Site URL)</label>
          <input
            type="url"
            value={form.ogSiteUrl || ""}
            onChange={(e) => setForm({ ...form, ogSiteUrl: e.target.value })}
            className="input-glass w-full px-4 py-3 text-sm"
            placeholder="https://hightxclient.com"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">ใช้เป็น og:url, canonical และโดเมนที่โชว์ตอนแชร์ลิงก์ (ต้องขึ้นต้นด้วย https://)</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">OG Title</label>
          <input type="text" value={form.ogTitle || ""} onChange={(e) => setForm({ ...form, ogTitle: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder={form.brandName} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">OG Description</label>
          <textarea value={form.ogDescription || ""} onChange={(e) => setForm({ ...form, ogDescription: e.target.value })} className="input-glass w-full px-4 py-3 text-sm min-h-[60px] resize-y" placeholder="คำอธิบายสั้นๆ" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">OG Image URL</label>
          <div className="flex items-center gap-3">
            <input type="url" value={form.ogImage || ""} onChange={(e) => setForm({ ...form, ogImage: e.target.value })} className="input-glass flex-1 px-4 py-3 text-sm" placeholder="https://example.com/og-image.png" />
            {form.ogImage && <img src={form.ogImage} alt="OG" className="w-16 h-10 rounded-lg object-cover border border-border shrink-0" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">OG Type</label>
          <select value={form.ogType || "website"} onChange={(e) => setForm({ ...form, ogType: e.target.value })} className="input-glass w-full px-4 py-3 text-sm">
            <option value="website">website</option>
            <option value="article">article</option>
            <option value="profile">profile</option>
          </select>
        </div>
        {(form.ogTitle || form.ogDescription || form.ogImage) && (
          <div className="p-4 rounded-xl bg-muted/20 border border-border">
            <p className="text-xs text-muted-foreground mb-2">ตัวอย่างเมื่อแชร์ลิงก์:</p>
            <div className="rounded-lg border border-border overflow-hidden bg-background max-w-sm">
              {form.ogImage && <img src={form.ogImage} alt="OG" className="w-full h-28 object-cover" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />}
              <div className="p-3">
                <p className="font-bold text-sm text-foreground truncate">{form.ogTitle || form.brandName}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{form.ogDescription || "คำอธิบาย..."}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminSection>

    {/* Social Links */}
    <div className="glass-card space-y-5">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => setForm({ ...form, _socialCollapsed: !(form as any)._socialCollapsed } as any)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><ExternalLink size={18} /> ช่องทางติดต่อ</h3>
          <span className="text-xs text-muted-foreground">({(form.socialLinks || []).length})</span>
          {(form as any)._socialCollapsed ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronUp size={16} className="text-muted-foreground" />}
        </button>
        <button onClick={() => { const links = [...(form.socialLinks || []), { id: generateId(), label: "", url: "", iconUrl: "", showOnHome: true, showOnNavbar: true }]; setForm({ ...form, socialLinks: links }); }} className="btn-glass px-3 py-2 text-xs flex items-center gap-1"><Plus size={14} /> เพิ่มลิงก์</button>
      </div>
      {!(form as any)._socialCollapsed && (
        <>
          {(form.socialLinks || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีลิงก์ กดปุ่ม "เพิ่มลิงก์"</p>}
          <div className="space-y-3">
            {(form.socialLinks || []).map((link: SocialLink, idx: number) => {
              const linkKey = `_sl_${link.id}`;
              const linkCollapsed = (form as any)[linkKey];
              return (
                <div key={link.id} className="p-4 rounded-xl bg-muted/20 border border-border space-y-3"
                  draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(idx)); e.currentTarget.classList.add("opacity-50"); }}
                  onDragEnd={(e) => e.currentTarget.classList.remove("opacity-50")}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/50"); }}
                  onDragLeave={(e) => e.currentTarget.classList.remove("ring-2", "ring-primary/50")}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("ring-2", "ring-primary/50"); const fromIdx = parseInt(e.dataTransfer.getData("text/plain")); if (fromIdx === idx) return; const links = [...(form.socialLinks || [])]; const [moved] = links.splice(fromIdx, 1); links.splice(idx, 0, moved); setForm({ ...form, socialLinks: links }); }}
                >
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setForm({ ...form, [linkKey]: !linkCollapsed } as any)}>
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                      {link.iconUrl && <img src={link.iconUrl} alt="" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                      <span className="text-sm font-semibold text-foreground">{link.label || `ลิงก์ #${idx + 1}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={link.showOnHome ?? true} onChange={(e) => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], showOnHome: e.target.checked }; setForm({ ...form, socialLinks: links }); }} className="w-3 h-3 rounded accent-primary" /> หน้าหลัก
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={link.showOnNavbar ?? true} onChange={(e) => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], showOnNavbar: e.target.checked }; setForm({ ...form, socialLinks: links }); }} className="w-3 h-3 rounded accent-primary" /> แถบบน
                      </label>
                      <button onClick={(e) => { e.stopPropagation(); setForm({ ...form, socialLinks: (form.socialLinks || []).filter((_: SocialLink, i: number) => i !== idx) }); }} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={13} /></button>
                      {linkCollapsed ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronUp size={14} className="text-muted-foreground" />}
                    </div>
                  </div>
                  {!linkCollapsed && (
                    <div className="space-y-3 pt-3 border-t border-border/20">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">ไอคอนสำเร็จรูป</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { name: "Discord", icon: "https://cdn.simpleicons.org/discord/5865F2" },
                            { name: "Facebook", icon: "https://cdn.simpleicons.org/facebook/1877F2" },
                            { name: "Line", icon: "https://cdn.simpleicons.org/line/00C300" },
                            { name: "YouTube", icon: "https://cdn.simpleicons.org/youtube/FF0000" },
                            { name: "X", icon: "https://cdn.simpleicons.org/x/ffffff" },
                            { name: "Instagram", icon: "https://cdn.simpleicons.org/instagram/E4405F" },
                            { name: "TikTok", icon: "https://cdn.simpleicons.org/tiktok/ffffff" },
                            { name: "GitHub", icon: "https://cdn.simpleicons.org/github/ffffff" },
                          ].map((preset) => (
                            <button key={preset.name} type="button" onClick={() => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], iconUrl: preset.icon, label: links[idx].label || preset.name }; setForm({ ...form, socialLinks: links }); }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${link.iconUrl === preset.icon ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:border-primary/30"}`}>
                              <img src={preset.icon} alt={preset.name} className="w-3.5 h-3.5 object-contain" /> {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">ชื่อ</label>
                          <input type="text" value={link.label} onChange={(e) => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], label: e.target.value }; setForm({ ...form, socialLinks: links }); }} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="Discord" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">URL</label>
                          <input type="url" value={link.url} onChange={(e) => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], url: e.target.value }; setForm({ ...form, socialLinks: links }); }} className="input-glass w-full px-3 py-2.5 text-sm" placeholder="https://..." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">URL ไอคอน (กำหนดเอง)</label>
                        <div className="flex items-center gap-2">
                          <input type="url" value={link.iconUrl} onChange={(e) => { const links = [...(form.socialLinks || [])]; links[idx] = { ...links[idx], iconUrl: e.target.value }; setForm({ ...form, socialLinks: links }); }} className="input-glass flex-1 px-3 py-2.5 text-sm" placeholder="https://..." />
                          {link.iconUrl && <img src={link.iconUrl} alt="" className="w-8 h-8 object-contain rounded-lg border border-border" onError={(e) => (e.currentTarget.style.display = 'none')} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>

    <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2">
      <Save size={16} /> บันทึกการตั้งค่า
    </button>
  </div>
);

export default AdminGeneralTab;
