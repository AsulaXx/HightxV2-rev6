import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import {
  BarChart3, MousePointerClick, Globe, Filter
} from "lucide-react";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs
} from "firebase/firestore";
import {
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

interface LinkPage {
  id: string;
  slug: string;
  title: string;
  links: { title: string; url: string; icon?: string; iconUrl?: string; enabled: boolean }[];
  ownerId: string;
  ownerName: string;
  clickCounts?: Record<string, number>;
  totalClicks?: number;
  themeColor?: string;
}

// Click data is now derived from clickCounts on linkPages (counter-based, no separate collection)

const COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444", "#a855f7", "#f43f5e", "#14b8a6"];

const LinkClickAnalyticsPage = () => {
  const { user, profile, hasPermission } = useAuth();
  const isOwner = profile?.role === "owner";
  const isHightXCrew = hasPermission("hightxcrew");

  const [pages, setPages] = useState<LinkPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        // Load pages (avoid composite index by sorting client-side)
        let pagesQuery;
        if (isOwner) {
          pagesQuery = query(collection(db, "linkPages"));
        } else {
          pagesQuery = query(collection(db, "linkPages"), where("ownerId", "==", user.uid));
        }
        const pagesSnap = await getDocs(pagesQuery);
        const pagesData: LinkPage[] = pagesSnap.docs.map(d => {
          const data = d.data() as Omit<LinkPage, "id">;
          return { ...data, id: d.id };
        });
        // Sort client-side
        pagesData.sort((a, b) => {
          const ta = (a as any).createdAt?.toMillis?.() || (a as any).createdAt?.seconds * 1000 || 0;
          const tb = (b as any).createdAt?.toMillis?.() || (b as any).createdAt?.seconds * 1000 || 0;
          return tb - ta;
        });
        setPages(pagesData);
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, isOwner]);

  // Per-link breakdown from clickCounts on linkPages
  const linkBreakdown = useMemo(() => {
    const result: { title: string; url: string; clicks: number }[] = [];
    const filteredPages = pages.filter(p => selectedPageId === "all" || p.id === selectedPageId);
    filteredPages.forEach(page => {
      if (page.clickCounts) {
        Object.entries(page.clickCounts).forEach(([idx, count]) => {
          const linkIdx = parseInt(idx);
          const link = page.links?.[linkIdx];
          if (link && count > 0) {
            result.push({
              title: link.title || `ลิงก์ ${linkIdx + 1}`,
              url: link.url,
              clicks: count,
            });
          }
        });
      }
    });
    return result.sort((a, b) => b.clicks - a.clicks);
  }, [pages, selectedPageId]);

  // Per-page breakdown from totalClicks
  const pageBreakdown = useMemo(() => {
    const filteredPages = pages.filter(p => selectedPageId === "all" || p.id === selectedPageId);
    return filteredPages
      .filter(p => (p.totalClicks || 0) > 0)
      .map(p => ({ title: p.title, slug: p.slug, clicks: p.totalClicks || 0 }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [pages, selectedPageId]);

  // Total clicks from counters
  const totalClicks = pages
    .filter(p => selectedPageId === "all" || p.id === selectedPageId)
    .reduce((sum, p) => sum + (p.totalClicks || 0), 0);

  if (!user || !profile) return <RedirectToLogin />;
  if (!isHightXCrew) return <Navigate to="/" replace />;

  return (
    <div className="relative z-10 max-w-[1100px] mx-auto px-4 md:px-8 py-8">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Link รวม", path: "/links" }, { label: "สถิติคลิก" }]}
        title="สถิติคลิก Link รวม"
        subtitle="ดูสถิติการคลิกลิงก์ทั้งหมด"
        icon={BarChart3}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* Filters */}
        <div className="glass-card !p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" />
            <select
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">ทุกหน้า</option>
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.title} (/l/{p.slug})</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1"><BarChart3 size={10} /> ข้อมูลจาก counter (ประหยัด Firebase quota)</p>
        </div>

        {loading ? (
          <div className="glass-card text-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="glass-card !p-4 text-center">
                <MousePointerClick size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-2xl font-extrabold text-foreground">{totalClicks}</p>
                <p className="text-xs text-muted-foreground">คลิกทั้งหมด</p>
              </div>
              <div className="glass-card !p-4 text-center">
                <Globe size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-2xl font-extrabold text-foreground">{pages.length}</p>
                <p className="text-xs text-muted-foreground">หน้าทั้งหมด</p>
              </div>
              <div className="glass-card !p-4 text-center">
                <BarChart3 size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-2xl font-extrabold text-foreground">{linkBreakdown.length}</p>
                <p className="text-xs text-muted-foreground">ลิงก์ที่ถูกคลิก</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Top Links */}
              <div className="glass-card !p-6">
                <h2 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  🔗 ลิงก์ยอดนิยม
                </h2>
                {linkBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">ยังไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-3">
                    {linkBreakdown.slice(0, 10).map((item, idx) => {
                      const maxClicks = linkBreakdown[0]?.clicks || 1;
                      const percent = Math.round((item.clicks / maxClicks) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground truncate flex-1 mr-2">{item.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                              <MousePointerClick size={10} /> {item.clicks}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Per-Page Breakdown */}
              <div className="glass-card !p-6">
                <h2 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  📄 คลิกตามหน้า
                </h2>
                {pageBreakdown.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">ยังไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-3">
                    {pageBreakdown.map((item, idx) => {
                      const maxClicks = pageBreakdown[0]?.clicks || 1;
                      const percent = Math.round((item.clicks / maxClicks) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Globe size={12} className="text-muted-foreground shrink-0" />
                              <span className="font-semibold text-foreground truncate">{item.title}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">/l/{item.slug}</span>
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1 ml-2">
                              <MousePointerClick size={10} /> {item.clicks}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="glass-card !p-4 text-center">
              <p className="text-xs text-muted-foreground">💡 ข้อมูลคลิกเก็บแบบ counter บน linkPages เพื่อประหยัด Firebase quota (ไม่เก็บรายละเอียดแต่ละคลิก)</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default LinkClickAnalyticsPage;
