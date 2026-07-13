import { useState, useEffect } from "react";
import { ExternalLink, RotateCcw, Trash2, Eye, EyeOff, Globe, MousePointerClick } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminTabProps } from "../shared/AdminTabProps";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { toast } from "sonner";

const AdminLinkPagesTab = ({ form }: AdminTabProps) => {
  const [allLinkPages, setAllLinkPages] = useState<any[]>([]);
  const [linkPagesLoading, setLinkPagesLoading] = useState(false);
  const [linkClickCount, setLinkClickCount] = useState<number | null>(null);
  const [cleaningLinks, setCleaningLinks] = useState(false);

  const loadLinkPages = async () => {
    setLinkPagesLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "linkPages"), orderBy("createdAt", "desc")));
      setAllLinkPages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const clickSnap = await getDocs(collection(db, "linkClicks"));
      setLinkClickCount(clickSnap.size);
    } catch (err) { console.error(err); }
    setLinkPagesLoading(false);
  };

  useEffect(() => { loadLinkPages(); }, []);

  const deleteLinkPage = async (pageId: string) => {
    if (!confirm("ลบลิ้งค์รวมนี้?")) return;
    try {
      await deleteDoc(doc(db, "linkPages", pageId));
      setAllLinkPages(prev => prev.filter(p => p.id !== pageId));
      toast.success("ลบลิ้งค์รวมแล้ว");
    } catch { toast.error("ลบไม่สำเร็จ"); }
  };

  const togglePublish = async (page: any) => {
    try {
      await updateDoc(doc(db, "linkPages", page.id), { published: !page.published });
      setAllLinkPages(prev => prev.map(p => p.id === page.id ? { ...p, published: !p.published } : p));
      toast.success(page.published ? "ซ่อนลิ้งค์แล้ว" : "เผยแพร่ลิ้งค์แล้ว");
    } catch { toast.error("อัพเดทไม่สำเร็จ"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">จัดการลิ้งค์รวม</h1>
          <p className="text-sm text-muted-foreground mt-1">ดูและจัดการหน้าลิ้งค์รวมทั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <Link to="/links" className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
            <ExternalLink size={14} /> ไปหน้าลิ้งค์รวม
          </Link>
          <button onClick={loadLinkPages} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5">
            <RotateCcw size={14} /> รีเฟรช
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">ลิ้งค์รวม</p>
          <p className="text-base sm:text-lg font-bold text-primary">{allLinkPages.length}</p>
        </div>
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">เผยแพร่</p>
          <p className="text-base sm:text-lg font-bold text-green-500">{allLinkPages.filter((p: any) => p.published).length}</p>
        </div>
        <div className="glass-card !p-3 sm:p-4 text-center">
          <p className="text-[10px] sm:text-xs text-muted-foreground">คลิกรวม</p>
          <p className="text-base sm:text-lg font-bold text-foreground">{allLinkPages.reduce((s: number, p: any) => s + (p.totalClicks || 0), 0).toLocaleString()}</p>
        </div>
      </div>

      {linkPagesLoading ? (
        <div className="glass-card p-8 text-center text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <div className="glass-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-foreground">รายการลิ้งค์รวม ({allLinkPages.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allLinkPages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีลิ้งค์รวม</p>
            ) : (
              allLinkPages.map((page: any) => (
                <div key={page.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/10">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${page.published ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{page.title || "ไม่มีชื่อ"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      /{page.slug} · โดย {page.ownerName} · {page.links?.length || 0} ลิงก์ · {(page.totalClicks || 0).toLocaleString()} คลิก
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link to={`/l/${page.slug}`} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="ดู">
                      <Globe size={14} className="text-muted-foreground" />
                    </Link>
                    <button onClick={() => togglePublish(page)} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title={page.published ? "ซ่อน" : "เผยแพร่"}>
                      {page.published ? <Eye size={14} className="text-green-500" /> : <EyeOff size={14} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => deleteLinkPage(page.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="ลบ">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <MousePointerClick size={16} /> จัดการข้อมูลคลิก
        </h3>
        <p className="text-xs text-muted-foreground">
          linkClicks collection: <span className="font-bold text-foreground">{linkClickCount !== null ? `${linkClickCount.toLocaleString()} รายการ` : "กำลังนับ..."}</span>
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          ระบบใช้ counter แทนแล้ว สามารถลบ linkClicks เก่าเพื่อเคลียร์พื้นที่ Firebase ได้อย่างปลอดภัย
        </p>
        <button
          onClick={async () => {
            if (!confirm("ลบประวัติคลิกลิงก์ (linkClicks) ทั้งหมดเพื่อเคลียร์พื้นที่?")) return;
            setCleaningLinks(true);
            try {
              const snap = await getDocs(collection(db, "linkClicks"));
              let count = 0;
              const chunks = [];
              for (let i = 0; i < snap.docs.length; i += 50) {
                chunks.push(snap.docs.slice(i, i + 50));
              }
              for (const chunk of chunks) {
                await Promise.all(chunk.map(d => deleteDoc(doc(db, "linkClicks", d.id))));
                count += chunk.length;
              }
              setLinkClickCount(0);
              toast.success(`ลบ linkClicks ${count} รายการเรียบร้อย`);
            } catch { toast.error("ลบ linkClicks ไม่สำเร็จ"); }
            setCleaningLinks(false);
          }}
          disabled={cleaningLinks || linkClickCount === 0}
          className="btn-glass w-full py-2.5 text-xs flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          {cleaningLinks ? <RotateCcw size={14} className="animate-spin" /> : <Trash2 size={14} />} ลบ linkClicks ทั้งหมด
        </button>
      </div>
    </div>
  );
};

export default AdminLinkPagesTab;
