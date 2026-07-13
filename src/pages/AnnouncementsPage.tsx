import { useState, useEffect } from "react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings, roleHasPermission } from "@/contexts/SiteSettingsContext";
import { Megaphone, Plus, Trash2, Save, Pin } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import ImageUploadField from "@/components/admin/shared/ImageUploadField";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface Announcement {
  id: string; title: string; content: string; imageUrl?: string; pinned: boolean;
  createdBy: string; createdByName: string; createdAt: any;
}

const AnnouncementsPage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const canManage = hasPermission("admin") || (profile ? roleHasPermission(settings, profile.role, "announcement_manage") : false);

  useEffect(() => { loadAnnouncements(); }, []);

  const loadAnnouncements = async () => {
    try {
      const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setAnnouncements(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    } catch (err) { console.error("Failed to load announcements:", err); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) { toast.error("กรุณากรอกหัวข้อและเนื้อหา"); return; }
    if (!user || !profile) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "announcements"), { title: title.trim(), content: content.trim(), imageUrl: imageUrl.trim() || null, pinned, createdBy: user.uid, createdByName: profile.displayName || profile.email || "", createdAt: serverTimestamp() });
      toast.success("สร้างประกาศสำเร็จ!");
      setTitle(""); setContent(""); setImageUrl(""); setPinned(false); setShowForm(false);
      loadAnnouncements();
      try { await logActivity(user, profile, "announcement_create", `สร้างประกาศ: ${title.trim()}`); } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("Announcements.logActivity", err, "warn"); }
    } catch (err: any) {
      if (err?.code === "permission-denied") toast.error("คุณไม่มีสิทธิ์สร้างประกาศ");
      else toast.error("ไม่สามารถสร้างประกาศได้");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ต้องการลบประกาศนี้?")) return;
    try { await deleteDoc(doc(db, "announcements", id)); setAnnouncements((p) => p.filter((a) => a.id !== id)); toast.success("ลบสำเร็จ"); } catch { toast.error("ไม่สามารถลบได้"); }
  };

  const formatDate = (ts: any) => { if (!ts) return ""; const d = ts.toDate?.() || new Date(ts); return d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }); };
  const sorted = [...announcements].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "ประกาศ" }]}
        title="ประกาศ"
        subtitle="ข่าวสารและอัปเดตล่าสุด"
        icon={Megaphone}
      />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-end mb-6">
          
          {canManage && (
            <button onClick={() => setShowForm(!showForm)} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1.5"><Plus size={14} /> สร้าง</button>
          )}
        </div>

        {showForm && canManage && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="glass-card mb-4 space-y-3 !rounded-2xl">
            <h2 className="text-sm font-bold text-foreground">📝 สร้างประกาศใหม่</h2>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">หัวข้อ</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-glass w-full px-4 py-3 text-xs" placeholder="หัวข้อประกาศ" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">เนื้อหา</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input-glass w-full px-4 py-3 text-xs min-h-[100px] resize-y" placeholder="เนื้อหา..." />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">รูปภาพ</label>
              <ImageUploadField value={imageUrl} onChange={setImageUrl} folder="announcement" compact />
            </div>
            <div className="flex items-center cursor-pointer select-none gap-2" onClick={() => setPinned(!pinned)}>
              <div className={`toggle-slider ${pinned ? "toggle-active" : ""}`} />
              <span className="text-xs font-semibold text-foreground flex items-center gap-1"><Pin size={12} /> ปักหมุด</span>
            </div>
            <button onClick={handleCreate} disabled={saving} className="btn-gradient w-full py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={14} /> {saving ? "กำลังสร้าง..." : "เผยแพร่ประกาศ"}
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="glass-card text-center py-14 !rounded-2xl"><p className="text-sm text-muted-foreground">กำลังโหลด...</p></div>
        ) : sorted.length === 0 ? (
          <div className="glass-card text-center py-14 !rounded-2xl">
            <Megaphone size={36} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">ยังไม่มีประกาศ</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map((ann, i) => (
              <motion.div key={ann.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass-card !p-4 !rounded-xl ${ann.pinned ? "!border-primary/15" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {ann.pinned && <Pin size={11} className="text-primary shrink-0" />}
                      <h3 className="text-sm font-bold text-foreground">{ann.title}</h3>
                    </div>
                    {ann.imageUrl && <img src={ann.imageUrl} alt={ann.title} className="w-full max-h-48 object-cover rounded-lg mb-2 border border-border/20" />}
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{ann.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/50">
                      <span>{ann.createdByName}</span>
                      <span>{formatDate(ann.createdAt)}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button onClick={() => handleDelete(ann.id)} className="btn-glass p-1.5 text-destructive shrink-0"><Trash2 size={12} /></button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AnnouncementsPage;
