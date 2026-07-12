import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { Navigate, Link } from "react-router-dom";
import RedirectToLogin from "@/components/RedirectToLogin";
import {
  Link2, Plus, Trash2, Copy, ExternalLink, GripVertical,
  Eye, EyeOff, Pencil, Globe, Share2, Check, Search, User, Palette, Image, BarChart3, MousePointerClick, Music, Upload, Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from "firebase/firestore";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

interface LinkItem {
  title: string;
  url: string;
  icon?: string;
  iconUrl?: string;
  enabled: boolean;
}

interface LinkPage {
  id: string;
  slug: string;
  title: string;
  description: string;
  links: LinkItem[];
  ownerId: string;
  ownerName: string;
  published: boolean;
  avatarUrl?: string;
  avatarBorderColor?: string;
  avatarBorderWidth?: number;
  avatarBorderStyle?: string;
  avatarGlow?: boolean;
  avatarGlowColor?: string;
  avatarShape?: string;
  typingEffect?: boolean;
  typingLoop?: boolean;
  particleMode?: string;
  titleGradientFrom?: string;
  titleGradientTo?: string;
  themeColor?: string;
  themeBg?: string;
  themeBgImage?: string;
  bgMusicUrl?: string;
  bgMusicCoverUrl?: string;
  bgMusicTitle?: string;
  bgMusicArtist?: string;
  bgMusicStartTime?: number;
  bgMusicAutoPlay?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  clickCounts?: Record<string, number>;
  totalClicks?: number;
  createdAt: any;
  updatedAt: any;
}

// Theme presets for link pages
const LINK_THEME_PRESETS = [
  { name: "Default", color: "", bg: "" },
  { name: "Ocean", color: "#3b82f6", bg: "#0f172a" },
  { name: "Sunset", color: "#f97316", bg: "#1c1917" },
  { name: "Forest", color: "#22c55e", bg: "#052e16" },
  { name: "Purple", color: "#a855f7", bg: "#1e1b4b" },
  { name: "Rose", color: "#f43f5e", bg: "#1a0a0e" },
  { name: "Gold", color: "#eab308", bg: "#1a1a0a" },
  { name: "Cyan", color: "#06b6d4", bg: "#042f2e" },
  { name: "White", color: "#1f2937", bg: "#ffffff" },
];

// Preset icons grouped by category
const ICON_PRESETS: { category: string; icons: { emoji: string; label: string }[] }[] = [
  {
    category: "โซเชียลมีเดีย",
    icons: [
      { emoji: "💬", label: "Discord" },
      { emoji: "🐦", label: "Twitter/X" },
      { emoji: "📘", label: "Facebook" },
      { emoji: "📸", label: "Instagram" },
      { emoji: "🎵", label: "TikTok" },
      { emoji: "▶️", label: "YouTube" },
      { emoji: "👾", label: "Twitch" },
      { emoji: "💼", label: "LinkedIn" },
      { emoji: "📌", label: "Pinterest" },
      { emoji: "👻", label: "Snapchat" },
      { emoji: "📡", label: "Telegram" },
      { emoji: "💚", label: "LINE" },
    ],
  },
  {
    category: "เว็บไซต์ & ลิงก์",
    icons: [
      { emoji: "🔗", label: "ลิงก์" },
      { emoji: "🌐", label: "เว็บไซต์" },
      { emoji: "🏠", label: "หน้าหลัก" },
      { emoji: "📝", label: "บล็อก" },
      { emoji: "📰", label: "ข่าว" },
      { emoji: "📄", label: "เอกสาร" },
      { emoji: "🗂️", label: "พอร์ตฟอลิโอ" },
    ],
  },
  {
    category: "เกม & ความบันเทิง",
    icons: [
      { emoji: "🎮", label: "เกม" },
      { emoji: "🕹️", label: "อาร์เคด" },
      { emoji: "🎲", label: "บอร์ดเกม" },
      { emoji: "🏆", label: "อันดับ" },
      { emoji: "⚔️", label: "RPG" },
      { emoji: "🎯", label: "เป้าหมาย" },
    ],
  },
  {
    category: "ธุรกิจ & การเงิน",
    icons: [
      { emoji: "🛒", label: "ร้านค้า" },
      { emoji: "💰", label: "การเงิน" },
      { emoji: "💳", label: "ชำระเงิน" },
      { emoji: "📧", label: "อีเมล" },
      { emoji: "📞", label: "โทรศัพท์" },
      { emoji: "🏢", label: "องค์กร" },
    ],
  },
  {
    category: "อื่นๆ",
    icons: [
      { emoji: "💎", label: "พรีเมียม" },
      { emoji: "🔥", label: "ฮอต" },
      { emoji: "⭐", label: "ดาว" },
      { emoji: "❤️", label: "หัวใจ" },
      { emoji: "🎁", label: "ของขวัญ" },
      { emoji: "📺", label: "ทีวี" },
      { emoji: "🎶", label: "เพลง" },
      { emoji: "📱", label: "แอป" },
      { emoji: "🖥️", label: "คอมพิวเตอร์" },
      { emoji: "🤖", label: "บอท" },
      { emoji: "🛡️", label: "ความปลอดภัย" },
      { emoji: "🚀", label: "เริ่มต้น" },
    ],
  },
];

const ALL_PRESET_EMOJIS = ICON_PRESETS.flatMap((g) => g.icons.map((i) => i.emoji));

const LinkTreePage = () => {
  const { user, profile, hasPermission } = useAuth();
  const { settings } = useSiteSettings();
  const [pages, setPages] = useState<LinkPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<LinkPage | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [iconPickerIdx, setIconPickerIdx] = useState<number | null>(null);
  const [customIconInput, setCustomIconInput] = useState("");
  const [iconUrlInput, setIconUrlInput] = useState("");

  // Owner: view all users' pages
  const isOwner = profile?.role === "owner";
  const [viewAll, setViewAll] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formLinks, setFormLinks] = useState<LinkItem[]>([]);
  const [formPublished, setFormPublished] = useState(true);
  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formAvatarBorderColor, setFormAvatarBorderColor] = useState("");
  const [formAvatarBorderWidth, setFormAvatarBorderWidth] = useState(3);
  const [formAvatarBorderStyle, setFormAvatarBorderStyle] = useState("solid");
  const [formAvatarGlow, setFormAvatarGlow] = useState(false);
  const [formAvatarGlowColor, setFormAvatarGlowColor] = useState("");
  const [formAvatarShape, setFormAvatarShape] = useState("circle");
  const [formTypingEffect, setFormTypingEffect] = useState(false);
  const [formTypingLoop, setFormTypingLoop] = useState(false);
  const [formParticleMode, setFormParticleMode] = useState("");
  const [formTitleGradientFrom, setFormTitleGradientFrom] = useState("");
  const [formTitleGradientTo, setFormTitleGradientTo] = useState("");
  const [formThemeColor, setFormThemeColor] = useState("");
  const [formThemeBg, setFormThemeBg] = useState("");
  const [formThemeBgImage, setFormThemeBgImage] = useState("");
  const [formOgTitle, setFormOgTitle] = useState("");
  const [formOgDescription, setFormOgDescription] = useState("");
  const [formOgImage, setFormOgImage] = useState("");
  const [formBgMusicUrl, setFormBgMusicUrl] = useState("");
  const [formBgMusicCoverUrl, setFormBgMusicCoverUrl] = useState("");
  const [formBgMusicTitle, setFormBgMusicTitle] = useState("");
  const [formBgMusicArtist, setFormBgMusicArtist] = useState("");
  const [formBgMusicStartTime, setFormBgMusicStartTime] = useState(0);
  const [formBgMusicAutoPlay, setFormBgMusicAutoPlay] = useState(true);
  const [showThemePanel, setShowThemePanel] = useState(false);

  const isHightXCrew = hasPermission("hightxcrew");

  // Helper: delete old music file from storage if it's a supabase URL
  const deleteOldMusicFile = async (url: string) => {
    if (!url) return;
    try {
      const bucketSegment = "/storage/v1/object/public/music/";
      const idx = url.indexOf(bucketSegment);
      if (idx === -1) return; // not a storage URL
      const filePath = decodeURIComponent(url.substring(idx + bucketSegment.length));
      await supabase.storage.from("music").remove([filePath]);
    } catch (err) {
      console.error("Failed to delete old music file:", err);
    }
  };

  const loadPages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q;
      if (isOwner && viewAll) {
        q = query(collection(db, "linkPages"), orderBy("createdAt", "desc"));
      } else {
        q = query(
          collection(db, "linkPages"),
          where("ownerId", "==", user.uid)
        );
      }
      const snap = await getDocs(q);
      const results: LinkPage[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as Omit<LinkPage, "id">;
        results.push({ ...data, id: d.id });
      });
      results.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return tb - ta;
      });
      setPages(results);
    } catch (err) {
      console.error("Failed to load link pages:", err);
    } finally {
      setLoading(false);
    }
  }, [user, isOwner, viewAll]);

  useEffect(() => {
    if (user && isHightXCrew) loadPages();
  }, [user, isHightXCrew, loadPages]);

  if (!user || !profile) return <RedirectToLogin />;
  if (!isHightXCrew) return <Navigate to="/" replace />;

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-") ||
    Math.random().toString(36).substring(2, 8);

  const startCreate = () => {
    setCreating(true);
    setEditingPage(null);
    setFormTitle("");
    setFormDesc("");
    setFormSlug("");
    setFormLinks([{ title: "", url: "", icon: "🔗", enabled: true }]);
    setFormPublished(true);
    setFormAvatarUrl("");
    setFormAvatarBorderColor("");
    setFormAvatarBorderWidth(3);
    setFormAvatarBorderStyle("solid");
    setFormAvatarGlow(false);
    setFormAvatarGlowColor("");
    setFormAvatarShape("circle");
    setFormTypingEffect(false);
    setFormTypingLoop(false);
    setFormParticleMode("");
    setFormTitleGradientFrom("");
    setFormTitleGradientTo("");
    setFormThemeColor("");
    setFormThemeBg("");
    setFormThemeBgImage("");
    setFormOgTitle("");
    setFormOgDescription("");
    setFormOgImage("");
    setFormBgMusicUrl("");
    setFormBgMusicCoverUrl("");
    setFormBgMusicTitle("");
    setFormBgMusicArtist("");
    setFormBgMusicStartTime(0);
    setFormBgMusicAutoPlay(true);
    setIconPickerIdx(null);
    setShowThemePanel(false);
  };

  const startEdit = (page: LinkPage) => {
    setCreating(false);
    setEditingPage(page);
    setFormTitle(page.title);
    setFormDesc(page.description);
    setFormSlug(page.slug);
    setFormLinks([...page.links]);
    setFormPublished(page.published);
    setFormAvatarUrl(page.avatarUrl || "");
    setFormAvatarBorderColor(page.avatarBorderColor || "");
    setFormAvatarBorderWidth(page.avatarBorderWidth || 3);
    setFormAvatarBorderStyle(page.avatarBorderStyle || "solid");
    setFormAvatarGlow(page.avatarGlow || false);
    setFormAvatarGlowColor(page.avatarGlowColor || "");
    setFormAvatarShape(page.avatarShape || "circle");
    setFormTypingEffect(page.typingEffect || false);
    setFormTypingLoop(page.typingLoop || false);
    setFormParticleMode(page.particleMode || "");
    setFormTitleGradientFrom(page.titleGradientFrom || "");
    setFormTitleGradientTo(page.titleGradientTo || "");
    setFormThemeColor(page.themeColor || "");
    setFormThemeBg(page.themeBg || "");
    setFormThemeBgImage(page.themeBgImage || "");
    setFormOgTitle(page.ogTitle || "");
    setFormOgDescription(page.ogDescription || "");
    setFormOgImage(page.ogImage || "");
    setFormBgMusicUrl(page.bgMusicUrl || "");
    setFormBgMusicCoverUrl(page.bgMusicCoverUrl || "");
    setFormBgMusicTitle(page.bgMusicTitle || "");
    setFormBgMusicArtist(page.bgMusicArtist || "");
    setFormBgMusicStartTime(page.bgMusicStartTime || 0);
    setFormBgMusicAutoPlay(page.bgMusicAutoPlay !== false);
    setIconPickerIdx(null);
    setShowThemePanel(false);
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditingPage(null);
    setIconPickerIdx(null);
    setShowThemePanel(false);
  };

  const addLink = () => {
    setFormLinks([...formLinks, { title: "", url: "", icon: "🔗", enabled: true }]);
  };

  const removeLink = (idx: number) => {
    setFormLinks(formLinks.filter((_, i) => i !== idx));
    if (iconPickerIdx === idx) setIconPickerIdx(null);
  };

  const updateLink = (idx: number, field: keyof LinkItem, value: any) => {
    const updated = [...formLinks];
    (updated[idx] as any)[field] = value;
    setFormLinks(updated);
  };

  const moveLink = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= formLinks.length) return;
    const updated = [...formLinks];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setFormLinks(updated);
    if (iconPickerIdx === idx) setIconPickerIdx(newIdx);
    else if (iconPickerIdx === newIdx) setIconPickerIdx(idx);
  };

  const selectIcon = (idx: number, emoji: string) => {
    updateLink(idx, "icon", emoji);
    updateLink(idx, "iconUrl", "");
    setIconPickerIdx(null);
    setCustomIconInput("");
    setIconUrlInput("");
  };

  const selectIconUrl = (idx: number, url: string) => {
    updateLink(idx, "iconUrl", url);
    updateLink(idx, "icon", "");
    setIconPickerIdx(null);
    setIconUrlInput("");
    setCustomIconInput("");
  };

  const sendLinkWebhook = async (action: string, title: string, slug: string, linkCount: number) => {
    try {
      const color = action === "สร้าง" ? 0x00cc66 : 0x3b82f6;
      const { sendWebhook } = await import("@/lib/webhookSender");
      await sendWebhook(settings, "linkPage", [{
        title: `🔗 ${action}หน้าลิงก์`,
        color,
        fields: [
          { name: "📄 ชื่อหน้า", value: title, inline: true },
          { name: "👤 โดย", value: profile?.displayName || profile?.email || "Unknown", inline: true },
          { name: "🔗 ลิงก์", value: `${window.location.origin}/l/${slug}`, inline: false },
          { name: "📊 จำนวนลิงก์", value: `${linkCount} รายการ`, inline: true },
        ],
        footer: { text: settings.brandName || "HightX" },
        timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      console.error("Link webhook failed:", err);
    }
  };

  const savePage = async () => {
    if (!formTitle.trim()) { toast.error("กรุณากรอกชื่อหน้า"); return; }
    const validLinks = formLinks.filter((l) => l.title.trim() && l.url.trim());
    if (validLinks.length === 0) { toast.error("กรุณาเพิ่มลิงก์อย่างน้อย 1 รายการ"); return; }

    const slug = formSlug.trim() || generateSlug(formTitle);

    // Check slug uniqueness
    if (creating || (editingPage && editingPage.slug !== slug)) {
      const slugQ = query(collection(db, "linkPages"), where("slug", "==", slug));
      const slugSnap = await getDocs(slugQ);
      if (!slugSnap.empty) {
        toast.error("Slug นี้ถูกใช้แล้ว กรุณาเปลี่ยน");
        return;
      }
    }

    setSaving(true);
    try {
      const pageData = {
        title: formTitle.trim(),
        description: formDesc.trim(),
        slug,
        links: validLinks,
        published: formPublished,
        avatarUrl: formAvatarUrl.trim(),
        avatarBorderColor: formAvatarBorderColor,
        avatarBorderWidth: formAvatarBorderWidth,
        avatarBorderStyle: formAvatarBorderStyle,
        avatarGlow: formAvatarGlow,
        avatarGlowColor: formAvatarGlowColor,
        avatarShape: formAvatarShape,
        typingEffect: formTypingEffect,
        typingLoop: formTypingLoop,
        particleMode: formParticleMode,
        titleGradientFrom: formTitleGradientFrom,
        titleGradientTo: formTitleGradientTo,
        themeColor: formThemeColor,
        themeBg: formThemeBg,
        themeBgImage: formThemeBgImage.trim(),
        bgMusicUrl: formBgMusicUrl.trim(),
        bgMusicCoverUrl: formBgMusicCoverUrl.trim(),
        bgMusicTitle: formBgMusicTitle.trim(),
        bgMusicArtist: formBgMusicArtist.trim(),
        bgMusicStartTime: formBgMusicStartTime || 0,
        bgMusicAutoPlay: formBgMusicAutoPlay,
        ogTitle: formOgTitle.trim(),
        ogDescription: formOgDescription.trim(),
        ogImage: formOgImage.trim(),
        updatedAt: serverTimestamp(),
      };

      if (creating) {
        await addDoc(collection(db, "linkPages"), {
          ...pageData,
          ownerId: user.uid,
          ownerName: profile?.displayName || profile?.email || "",
          createdAt: serverTimestamp(),
        });
        toast.success("สร้างหน้าลิงก์สำเร็จ!");
        await logActivity(user, profile, "link_create", `สร้างหน้าลิงก์: ${formTitle.trim()}`);
        sendLinkWebhook("สร้าง", formTitle.trim(), slug, validLinks.length);
      } else if (editingPage) {
        await updateDoc(doc(db, "linkPages", editingPage.id), pageData);
        toast.success("บันทึกสำเร็จ!");
        sendLinkWebhook("แก้ไข", formTitle.trim(), slug, validLinks.length);
      }
      cancelEdit();
      loadPages();
    } catch (err) {
      console.error("Save failed:", err);
      toast.error("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const deletePage = async (page: LinkPage) => {
    if (!confirm(`ลบหน้า "${page.title}" ?`)) return;
    try {
      await deleteDoc(doc(db, "linkPages", page.id));
      toast.success("ลบสำเร็จ!");
      await logActivity(user, profile, "link_delete", `ลบหน้าลิงก์: ${page.title}`);
      loadPages();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("เกิดข้อผิดพลาด");
    }
  };

  const copyLink = (slug: string, pageId: string) => {
    const url = `${window.location.origin}/l/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(pageId);
    toast.success("คัดลอกลิงก์แล้ว!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isEditing = creating || editingPage !== null;

  return (
    <div className="relative z-10 max-w-[900px] mx-auto px-4 md:px-8 py-8">
      <PageBreadcrumb
        items={[{ label: "เมนู", path: "/hub" }, { label: "Tools", path: "/hub" }, { label: "Link รวม" }]}
        title="Link รวม"
        subtitle="สร้างหน้ารวมลิงก์แบบ Linktree"
        icon={Share2}
      />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2">
            {!isEditing && (
              <Link to="/links/analytics" className="btn-glass px-3 py-2 text-sm flex items-center gap-2">
                <BarChart3 size={14} /> สถิติ
              </Link>
            )}
            {isOwner && !isEditing && (
              <button
                onClick={() => setViewAll(!viewAll)}
                className={`btn-glass px-3 py-2 text-sm flex items-center gap-2 ${viewAll ? "!border-primary/50 text-primary" : ""}`}
              >
                <User size={14} />
                {viewAll ? "ดูทั้งหมด" : "ของฉัน"}
              </button>
            )}
            {!isEditing && (
              <button onClick={startCreate} className="btn-gradient px-4 py-2.5 text-sm flex items-center gap-2">
                <Plus size={16} /> สร้างหน้าใหม่
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-card space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {creating ? "✨ สร้างหน้าลิงก์ใหม่" : "✏️ แก้ไขหน้าลิงก์"}
                </h2>
                <button onClick={cancelEdit} className="btn-glass px-3 py-1.5 text-sm">ยกเลิก</button>
              </div>

              {/* Page Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">ชื่อหน้า</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (creating && !formSlug) setFormSlug(generateSlug(e.target.value));
                    }}
                    placeholder="เช่น ลิงก์ช่องทางติดต่อ"
                    className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1">Slug (URL)</label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">/l/</span>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value.replace(/[^a-z0-9-]/g, "").toLowerCase())}
                      placeholder="my-links"
                      className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1">คำอธิบาย (ไม่บังคับ)</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="คำอธิบายสั้นๆ"
                  className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Publish toggle + Theme toggle */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setFormPublished(!formPublished)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all ${
                    formPublished ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/50 text-muted-foreground border border-border"
                  }`}
                >
                  {formPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  {formPublished ? "เผยแพร่" : "ซ่อน"}
                </button>
                <button
                  onClick={() => setShowThemePanel(!showThemePanel)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all ${
                    showThemePanel ? "bg-accent/20 text-accent-foreground border border-accent/30" : "bg-muted/50 text-muted-foreground border border-border"
                  }`}
                >
                  <Palette size={14} />
                  ตั้งค่ารูปโปรไฟล์ & ธีมสี
                </button>
              </div>

              {/* Avatar & Theme Panel */}
              <AnimatePresence>
                {showThemePanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Image size={14} /> รูปโปรไฟล์ & ธีมสี
                      </h3>

                      {/* Avatar URL */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">🖼️ รูปโปรไฟล์ (URL)</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="url"
                            value={formAvatarUrl}
                            onChange={(e) => setFormAvatarUrl(e.target.value)}
                            placeholder="https://example.com/avatar.png"
                            className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          {formAvatarUrl && (
                            <img
                              src={formAvatarUrl}
                              alt="avatar preview"
                              className="w-12 h-12 rounded-full object-cover border-2 border-border shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                        </div>
                      </div>

                      {/* Avatar Border Settings */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">🖌️ กรอบรูปโปรไฟล์</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">สีกรอบ</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={formAvatarBorderColor || formThemeColor || "#3b82f6"}
                                onInput={(e) => setFormAvatarBorderColor((e.target as HTMLInputElement).value)}
                                className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={formAvatarBorderColor}
                                onChange={(e) => setFormAvatarBorderColor(e.target.value)}
                                placeholder="ใช้สีหลัก"
                                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">ความหนา ({formAvatarBorderWidth}px)</label>
                            <input
                              type="range"
                              min={0}
                              max={8}
                              value={formAvatarBorderWidth}
                              onChange={(e) => setFormAvatarBorderWidth(Number(e.target.value))}
                              className="w-full accent-primary"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">สไตล์กรอบ</label>
                            <select
                              value={formAvatarBorderStyle}
                              onChange={(e) => setFormAvatarBorderStyle(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              <option value="solid">เส้นตรง (Solid)</option>
                              <option value="dashed">เส้นประ (Dashed)</option>
                              <option value="dotted">จุด (Dotted)</option>
                              <option value="double">เส้นคู่ (Double)</option>
                              <option value="none">ไม่มีกรอบ</option>
                            </select>
                          </div>
                        </div>

                        {/* Avatar Shape */}
                        <div className="mt-3">
                          <label className="text-[10px] text-muted-foreground mb-2 block">รูปร่างกรอบ</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "circle", label: "⭕ วงกลม" },
                              { value: "rounded", label: "▢ สี่เหลี่ยมมน" },
                              { value: "hexagon", label: "⬡ หกเหลี่ยม" },
                              { value: "square", label: "◻️ สี่เหลี่ยม" },
                            ].map((shape) => (
                              <button
                                key={shape.value}
                                onClick={() => setFormAvatarShape(shape.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                  formAvatarShape === shape.value
                                    ? "bg-primary/20 text-primary border border-primary/30 ring-2 ring-primary/20"
                                    : "bg-muted/50 text-muted-foreground border border-border hover:border-primary/30"
                                }`}
                              >
                                {shape.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Glow Effect Toggle */}
                        <div className="mt-3 space-y-2">
                          <button
                            onClick={() => setFormAvatarGlow(!formAvatarGlow)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                              formAvatarGlow
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-muted/50 text-muted-foreground border border-border"
                            }`}
                          >
                            <span className={`w-8 h-4 rounded-full relative transition-colors ${formAvatarGlow ? "bg-primary" : "bg-muted"}`}>
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formAvatarGlow ? "left-4" : "left-0.5"}`} />
                            </span>
                            💫 เอฟเฟกต์เรืองแสง (Glow) รอบกรอบรูป
                          </button>
                          {formAvatarGlow && (
                            <div className="flex items-center gap-2 ml-1">
                              <label className="text-[10px] text-muted-foreground shrink-0">สี Glow</label>
                              <input
                                type="color"
                                value={formAvatarGlowColor || formAvatarBorderColor || formThemeColor || "#3b82f6"}
                                onInput={(e) => setFormAvatarGlowColor((e.target as HTMLInputElement).value)}
                                className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={formAvatarGlowColor}
                                onChange={(e) => setFormAvatarGlowColor(e.target.value)}
                                placeholder="ใช้สีกรอบ"
                                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              {formAvatarGlowColor && (
                                <button onClick={() => setFormAvatarGlowColor("")} className="text-[10px] text-muted-foreground hover:text-foreground">รีเซ็ต</button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Border Preview */}
                        {formAvatarUrl && (
                          <div className="mt-3 flex items-center gap-3">
                            {formAvatarShape === "hexagon" ? (
                              <div
                                className="relative shrink-0"
                                style={{
                                  width: 68,
                                  height: 68,
                                  ...(formAvatarGlow ? {
                                    animation: "avatarGlow 2s ease-in-out infinite alternate",
                                    filter: `drop-shadow(0 0 8px ${formAvatarGlowColor || formAvatarBorderColor || formThemeColor || "hsl(var(--primary))"}80)`,
                                  } : {}),
                                }}
                              >
                                <div
                                  className="absolute inset-0"
                                  style={{
                                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                                    backgroundColor: formAvatarBorderColor || formThemeColor || "hsl(var(--primary))",
                                  }}
                                />
                                <div
                                  className="absolute overflow-hidden"
                                  style={{
                                    clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                                    top: `${formAvatarBorderWidth}px`,
                                    left: `${formAvatarBorderWidth}px`,
                                    right: `${formAvatarBorderWidth}px`,
                                    bottom: `${formAvatarBorderWidth}px`,
                                  }}
                                >
                                  <img
                                    src={formAvatarUrl}
                                    alt="border preview"
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => (e.currentTarget.style.display = "none")}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`w-16 h-16 shrink-0 overflow-hidden ${
                                  formAvatarShape === "circle" ? "rounded-full" :
                                  formAvatarShape === "rounded" ? "rounded-2xl" :
                                  "rounded-none"
                                }`}
                                style={{
                                  borderWidth: `${formAvatarBorderWidth}px`,
                                  borderStyle: formAvatarBorderStyle,
                                  borderColor: formAvatarBorderColor || formThemeColor || "hsl(var(--primary))",
                                  ...(formAvatarGlow ? {
                                    animation: "avatarGlow 2s ease-in-out infinite alternate",
                                    boxShadow: `0 0 12px ${formAvatarGlowColor || formAvatarBorderColor || formThemeColor || "hsl(var(--primary))"}60`,
                                  } : {}),
                                }}
                              >
                                <img
                                  src={formAvatarUrl}
                                  alt="border preview"
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground">ตัวอย่างกรอบรูป</span>
                          </div>
                        )}
                      </div>

                      {/* Typing Effect Toggle */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">✨ เอฟเฟกต์ชื่อหน้า</label>
                        <button
                          onClick={() => setFormTypingEffect(!formTypingEffect)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ${
                            formTypingEffect
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-muted/50 text-muted-foreground border border-border"
                          }`}
                        >
                          <span className={`w-8 h-4 rounded-full relative transition-colors ${formTypingEffect ? "bg-primary" : "bg-muted"}`}>
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formTypingEffect ? "left-4" : "left-0.5"}`} />
                          </span>
                          เอฟเฟกต์ค่อยๆพิมพ์ชื่อ (Typewriter)
                        </button>
                        {formTypingEffect && (
                          <button
                            onClick={() => setFormTypingLoop(!formTypingLoop)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all ml-2 ${
                              formTypingLoop
                                ? "bg-primary/20 text-primary border border-primary/30"
                                : "bg-muted/50 text-muted-foreground border border-border"
                            }`}
                          >
                            <span className={`w-8 h-4 rounded-full relative transition-colors ${formTypingLoop ? "bg-primary" : "bg-muted"}`}>
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${formTypingLoop ? "left-4" : "left-0.5"}`} />
                            </span>
                            🔄 วนซ้ำ (Loop)
                          </button>
                        )}
                      </div>

                      {/* Title Gradient */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">🌈 ไล่เฉดสีชื่อหน้า (Gradient)</label>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">สีเริ่มต้น</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={formTitleGradientFrom || formThemeColor || "#3b82f6"}
                                onInput={(e) => setFormTitleGradientFrom((e.target as HTMLInputElement).value)}
                                className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={formTitleGradientFrom}
                                onChange={(e) => setFormTitleGradientFrom(e.target.value)}
                                placeholder="ไม่ใช้"
                                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">สีปลายทาง</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={formTitleGradientTo || "#a855f7"}
                                onInput={(e) => setFormTitleGradientTo((e.target as HTMLInputElement).value)}
                                className="w-8 h-8 rounded-lg border border-border cursor-pointer bg-transparent"
                              />
                              <input
                                type="text"
                                value={formTitleGradientTo}
                                onChange={(e) => setFormTitleGradientTo(e.target.value)}
                                placeholder="ไม่ใช้"
                                className="flex-1 px-2 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </div>
                          </div>
                        </div>
                        {formTitleGradientFrom && formTitleGradientTo && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="h-6 flex-1 rounded-lg" style={{ background: `linear-gradient(to right, ${formTitleGradientFrom}, ${formTitleGradientTo})` }} />
                            <button onClick={() => { setFormTitleGradientFrom(""); setFormTitleGradientTo(""); }} className="text-[10px] text-muted-foreground hover:text-foreground">รีเซ็ต</button>
                          </div>
                        )}
                      </div>

                      {/* Particle Effect for Link Page */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">✨ อนุภาคพื้นหลัง (Particles)</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "", label: "❌ ปิด" },
                            { value: "default", label: "🔵 ลอยอิสระ" },
                            { value: "snow", label: "❄️ หิมะ" },
                            { value: "stars", label: "⭐ ดาว" },
                            { value: "bubbles", label: "🫧 ฟองสบู่" },
                          ].map((p) => (
                            <button
                              key={p.value}
                              onClick={() => setFormParticleMode(p.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                formParticleMode === p.value
                                  ? "bg-primary/20 text-primary border border-primary/30 ring-2 ring-primary/20"
                                  : "bg-muted/50 text-muted-foreground border border-border hover:border-primary/30"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Background Image URL */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">🏞️ รูปพื้นหลัง (URL, ไม่บังคับ)</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="url"
                            value={formThemeBgImage}
                            onChange={(e) => setFormThemeBgImage(e.target.value)}
                            placeholder="https://example.com/bg.jpg"
                            className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          {formThemeBgImage && (
                            <img
                              src={formThemeBgImage}
                              alt="bg preview"
                              className="w-16 h-10 rounded-lg object-cover border border-border shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                      </div>

                      {/* Background Music */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Music size={12} /> เพลงพื้นหลัง
                        </label>

                        {formBgMusicUrl ? (
                          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <Music size={18} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {formBgMusicUrl.split('/').pop()?.split('?')[0] || "เพลงพื้นหลัง"}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">{formBgMusicUrl}</p>
                              </div>
                              <button
                                onClick={async () => {
                                  await deleteOldMusicFile(formBgMusicUrl);
                                  setFormBgMusicUrl("");
                                }}
                                title="ลบเพลง"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <audio src={formBgMusicUrl} controls className="w-full h-8 rounded-lg" />
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-dashed border-border hover:border-primary/40 transition-all space-y-3">
                            <label className="cursor-pointer block">
                              <input
                                type="file"
                                accept="audio/mpeg,audio/ogg,audio/wav,audio/mp3,.mp3,.ogg,.wav"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 10 * 1024 * 1024) {
                                    toast.error("ไฟล์ใหญ่เกิน 10MB");
                                    return;
                                  }
                                  const ext = file.name.split('.').pop() || 'mp3';
                                  // Delete old file if replacing
                                  if (formBgMusicUrl) await deleteOldMusicFile(formBgMusicUrl);
                                  toast.loading("กำลังอัพโหลดเพลง...", { id: "music-upload" });
                                  let path: string;
                                  try {
                                    const { getSupabaseUploadPrefix } = await import("@/lib/supabaseSync");
                                    const prefix = await getSupabaseUploadPrefix();
                                    path = `${prefix}/${Date.now()}.${ext}`;
                                  } catch (err: any) {
                                    toast.error("เซสชันหมดอายุ กรุณา login ใหม่", { id: "music-upload" });
                                    return;
                                  }
                                  const { error } = await supabase.storage.from("music").upload(path, file, {
                                    cacheControl: "3600",
                                    upsert: false,
                                  });

                                  if (error) {
                                    toast.error("อัพโหลดไม่สำเร็จ: " + error.message, { id: "music-upload" });
                                    return;
                                  }
                                  const { data: urlData } = supabase.storage.from("music").getPublicUrl(path);
                                  setFormBgMusicUrl(urlData.publicUrl);
                                  toast.success("อัพโหลดเพลงสำเร็จ!", { id: "music-upload" });
                                  e.target.value = "";
                                }}
                              />
                              <div className="flex flex-col items-center gap-2 py-2 text-center">
                                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                                  <Upload size={18} className="text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-foreground">อัพโหลดไฟล์เพลง</p>
                                  <p className="text-[10px] text-muted-foreground">.mp3, .ogg, .wav · ไม่เกิน 10MB</p>
                                </div>
                              </div>
                            </label>

                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[10px] text-muted-foreground">หรือ</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>

                            <input
                              type="url"
                              value={formBgMusicUrl}
                              onChange={(e) => setFormBgMusicUrl(e.target.value)}
                              placeholder="วาง URL ไฟล์เพลง..."
                              className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        )}
                      </div>

                      {/* Music Details */}
                      {formBgMusicUrl && (
                        <div className="space-y-3 p-3 rounded-xl bg-muted/10 border border-border">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">รายละเอียดเพลง</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">ชื่อเพลง</label>
                              <input type="text" value={formBgMusicTitle} onChange={(e) => setFormBgMusicTitle(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="ชื่อเพลง..." />
                            </div>
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">ศิลปิน</label>
                              <input type="text" value={formBgMusicArtist} onChange={(e) => setFormBgMusicArtist(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="ชื่อศิลปิน..." />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-1">รูปหน้าปก (URL)</label>
                            <div className="flex gap-2 items-center">
                              <input type="url" value={formBgMusicCoverUrl} onChange={(e) => setFormBgMusicCoverUrl(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="https://..." />
                              {formBgMusicCoverUrl && <img src={formBgMusicCoverUrl} alt="cover" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">เวลาเริ่มต้น (วินาที)</label>
                              <input type="number" min={0} step={1} value={formBgMusicStartTime} onChange={(e) => setFormBgMusicStartTime(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="0" />
                            </div>
                            <div className="flex items-end pb-1">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formBgMusicAutoPlay} onChange={(e) => setFormBgMusicAutoPlay(e.target.checked)} className="accent-primary w-4 h-4 rounded" />
                                <span className="text-xs text-foreground">เล่นอัตโนมัติ</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>

                      {/* Color pickers */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1 block">🎨 สีหลัก (ปุ่ม, ข้อความเน้น)</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formThemeColor || "#3b82f6"}
                              onInput={(e) => setFormThemeColor((e.target as HTMLInputElement).value)}
                              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={formThemeColor}
                              onChange={(e) => setFormThemeColor(e.target.value)}
                              placeholder="#3b82f6"
                              className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            {formThemeColor && (
                              <button onClick={() => setFormThemeColor("")} className="text-xs text-muted-foreground hover:text-foreground">รีเซ็ต</button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-1 block">🖤 สีพื้นหลัง</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={formThemeBg || "#0a0a0a"}
                              onInput={(e) => setFormThemeBg((e.target as HTMLInputElement).value)}
                              className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={formThemeBg}
                              onChange={(e) => setFormThemeBg(e.target.value)}
                              placeholder="#0a0a0a"
                              className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            {formThemeBg && (
                              <button onClick={() => setFormThemeBg("")} className="text-xs text-muted-foreground hover:text-foreground">รีเซ็ต</button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Theme presets */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-2 block">🎭 ธีมสำเร็จรูป</label>
                        <div className="flex flex-wrap gap-2">
                          {LINK_THEME_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => {
                                setFormThemeColor(preset.color);
                                setFormThemeBg(preset.bg);
                              }}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs border transition-all hover:scale-105 ${
                                formThemeColor === preset.color && formThemeBg === preset.bg
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-border"
                              }`}
                              style={{
                                backgroundColor: preset.bg || undefined,
                                color: preset.color || undefined,
                              }}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-white/30"
                                style={{ backgroundColor: preset.color || "#888" }}
                              />
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Preview */}
                      {(formAvatarUrl || formThemeColor || formThemeBg) && (
                        <div
                          className="p-4 rounded-xl border border-border text-center space-y-2 relative overflow-hidden"
                          style={{
                            backgroundColor: formThemeBg || undefined,
                            backgroundImage: formThemeBgImage ? `url(${formThemeBgImage})` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          {formThemeBgImage && formThemeBg && (
                            <div className="absolute inset-0" style={{ backgroundColor: formThemeBg, opacity: 0.7 }} />
                          )}
                          <div className="relative z-10">
                            <p className="text-[10px] text-muted-foreground mb-2">ตัวอย่าง</p>
                            {formAvatarUrl && (
                              <img
                                src={formAvatarUrl}
                                alt="preview"
                                className="w-16 h-16 rounded-full mx-auto border-2 object-cover mb-2"
                                style={{ borderColor: formThemeColor || "#888" }}
                                referrerPolicy="no-referrer"
                                onError={(e) => (e.currentTarget.style.display = "none")}
                              />
                            )}
                            <p className="font-bold text-sm" style={{ color: formThemeColor || undefined }}>
                              {formTitle || "ชื่อหน้า"}
                            </p>
                            <div
                              className="mx-auto mt-2 px-4 py-2 rounded-xl text-xs font-semibold max-w-[200px]"
                              style={{
                                backgroundColor: formThemeColor ? `${formThemeColor}20` : undefined,
                                color: formThemeColor || undefined,
                                border: `1px solid ${formThemeColor || "#888"}40`,
                              }}
                            >
                              ตัวอย่างลิงก์
                            </div>
                          </div>
                        </div>
                      )}

                      {/* OG Meta Settings */}
                      <div className="border-t border-border pt-4 mt-4">
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3">
                          🔗 Open Graph (OG) / แชร์ลิงก์
                        </h4>
                        <p className="text-[10px] text-muted-foreground mb-3">ตั้งค่าข้อมูลที่แสดงเมื่อแชร์ลิงก์หน้านี้ไปยัง Discord, LINE, Facebook</p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">OG Title</label>
                            <input
                              type="text"
                              value={formOgTitle}
                              onChange={(e) => setFormOgTitle(e.target.value)}
                              placeholder={formTitle || "ชื่อหน้า"}
                              className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">OG Description</label>
                            <textarea
                              value={formOgDescription}
                              onChange={(e) => setFormOgDescription(e.target.value)}
                              placeholder={formDesc || "คำอธิบาย"}
                              className="w-full px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px] resize-y"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">OG Image (URL)</label>
                            <div className="flex items-center gap-3">
                              <input
                                type="url"
                                value={formOgImage}
                                onChange={(e) => setFormOgImage(e.target.value)}
                                placeholder="https://example.com/og-image.png"
                                className="flex-1 px-3 py-2 rounded-xl bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                              {formOgImage && (
                                <img
                                  src={formOgImage}
                                  alt="OG preview"
                                  className="w-16 h-10 rounded-lg object-cover border border-border shrink-0"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">แนะนำ 1200x630 px • หากไม่กรอกจะใช้รูปโปรไฟล์แทน</p>
                          </div>
                          {/* OG Preview */}
                          {(formOgTitle || formOgDescription || formOgImage) && (
                            <div className="rounded-lg border border-border overflow-hidden bg-background max-w-xs">
                              {(formOgImage || formAvatarUrl) && (
                                <img src={formOgImage || formAvatarUrl} alt="OG" className="w-full h-24 object-cover" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />
                              )}
                              <div className="p-2">
                                <p className="font-bold text-xs text-foreground truncate">{formOgTitle || formTitle || "ชื่อหน้า"}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{formOgDescription || formDesc || "คำอธิบาย"}</p>
                                <p className="text-[9px] text-muted-foreground/50 mt-0.5">{window.location.origin}/l/{formSlug || "slug"}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Links Editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold text-foreground">🔗 ลิงก์ ({formLinks.length})</label>
                    {editingPage && (editingPage.totalClicks || 0) > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
                        <BarChart3 size={12} className="text-primary" /> รวม {editingPage.totalClicks} คลิก
                      </span>
                    )}
                  </div>
                  <button onClick={addLink} className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1">
                    <Plus size={12} /> เพิ่มลิงก์
                  </button>
                </div>
                <div className="space-y-3">
                  {formLinks.map((link, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      className="p-3 rounded-xl bg-muted/30 border border-border space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveLink(idx, -1)}
                            disabled={idx === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                          >▲</button>
                          <button
                            onClick={() => moveLink(idx, 1)}
                            disabled={idx === formLinks.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 text-xs"
                          >▼</button>
                        </div>

                        {/* Icon button - opens picker */}
                        <button
                          onClick={() => setIconPickerIdx(iconPickerIdx === idx ? null : idx)}
                          className={`w-12 h-10 flex items-center justify-center bg-muted/50 border rounded-lg text-lg cursor-pointer hover:border-primary/50 transition-all ${
                            iconPickerIdx === idx ? "border-primary ring-2 ring-primary/30" : "border-border"
                          }`}
                          title="เลือกไอคอน"
                        >
                          {link.iconUrl ? (
                            <img src={link.iconUrl} alt="" className="w-6 h-6 rounded object-cover" />
                          ) : (
                            link.icon || "🔗"
                          )}
                        </button>

                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={link.title}
                            onChange={(e) => updateLink(idx, "title", e.target.value)}
                            placeholder="ชื่อลิงก์"
                            className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateLink(idx, "url", e.target.value)}
                            placeholder="https://..."
                            className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                        </div>

                        {/* Click count badge */}
                        {editingPage?.clickCounts && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 px-2 py-1 rounded-lg bg-muted/30" title="จำนวนคลิก">
                            <MousePointerClick size={10} /> {editingPage.clickCounts[String(idx)] || 0}
                          </span>
                        )}

                        <button
                          onClick={() => updateLink(idx, "enabled", !link.enabled)}
                          className={`p-2 rounded-lg transition-all ${link.enabled ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {link.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>

                        <button
                          onClick={() => removeLink(idx)}
                          className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Icon Picker Panel */}
                      <AnimatePresence>
                        {iconPickerIdx === idx && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 border-t border-border/50 space-y-3">
                              {/* Custom icon URL input */}
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">🖼️ ไอคอนจาก URL (รูปภาพ)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="url"
                                    value={iconUrlInput}
                                    onChange={(e) => setIconUrlInput(e.target.value)}
                                    placeholder="https://example.com/icon.png"
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  />
                                  {iconUrlInput && (
                                    <img src={iconUrlInput} alt="preview" className="w-8 h-8 rounded object-cover border border-border" onError={(e) => (e.currentTarget.style.display = "none")} />
                                  )}
                                  <button
                                    onClick={() => {
                                      if (iconUrlInput.trim()) {
                                        selectIconUrl(idx, iconUrlInput.trim());
                                      }
                                    }}
                                    disabled={!iconUrlInput.trim()}
                                    className="btn-gradient px-3 py-1.5 text-xs disabled:opacity-40"
                                  >
                                    ใช้
                                  </button>
                                </div>
                              </div>

                              {/* Custom emoji input */}
                              <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">กำหนดเอง (Emoji / ตัวอักษร)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={customIconInput}
                                    onChange={(e) => setCustomIconInput(e.target.value)}
                                    placeholder="วาง emoji หรือพิมพ์ตัวอักษร..."
                                    maxLength={4}
                                    className="flex-1 px-3 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                  />
                                  <button
                                    onClick={() => {
                                      if (customIconInput.trim()) {
                                        selectIcon(idx, customIconInput.trim());
                                      }
                                    }}
                                    disabled={!customIconInput.trim()}
                                    className="btn-gradient px-3 py-1.5 text-xs disabled:opacity-40"
                                  >
                                    ใช้
                                  </button>
                                </div>
                              </div>

                              {/* Preset icons by category */}
                              {ICON_PRESETS.map((group) => (
                                <div key={group.category}>
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                                    {group.category}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {group.icons.map((ic) => (
                                      <button
                                        key={ic.emoji + ic.label}
                                        onClick={() => selectIcon(idx, ic.emoji)}
                                        title={ic.label}
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg hover:bg-primary/20 transition-all ${
                                          link.icon === ic.emoji ? "bg-primary/30 ring-2 ring-primary/50" : "bg-muted/30"
                                        }`}
                                      >
                                        {ic.emoji}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={cancelEdit} className="btn-glass px-5 py-2.5 text-sm">ยกเลิก</button>
                <button
                  onClick={savePage}
                  disabled={saving}
                  className="btn-gradient px-6 py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : creating ? "สร้าง" : "บันทึก"}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {loading ? (
                <div className="glass-card text-center py-16">
                  <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">กำลังโหลด...</p>
                </div>
              ) : pages.length === 0 ? (
                <div className="glass-card text-center py-16">
                  <Share2 size={48} className="mx-auto mb-4 opacity-40 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    {viewAll ? "ยังไม่มีหน้าลิงก์ในระบบ" : "ยังไม่มีหน้าลิงก์ เริ่มสร้างเลย!"}
                  </p>
                  {!viewAll && (
                    <button onClick={startCreate} className="btn-gradient px-5 py-2.5 text-sm">
                      <Plus size={16} className="inline mr-1" /> สร้างหน้าแรก
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page) => (
                    <motion.div
                      key={page.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card !p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Avatar thumbnail in list */}
                        {page.avatarUrl && (
                          <img
                            src={page.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border-2 shrink-0"
                            style={{ borderColor: page.themeColor || "hsl(var(--border))" }}
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading font-bold text-foreground truncate">{page.title}</h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              page.published ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {page.published ? "เผยแพร่" : "ซ่อน"}
                            </span>
                            {page.themeColor && (
                              <span
                                className="w-3 h-3 rounded-full border border-border shrink-0"
                                style={{ backgroundColor: page.themeColor }}
                                title="ธีมสี"
                              />
                            )}
                          </div>
                          {page.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{page.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Globe size={10} /> /l/{page.slug}
                            <span className="mx-1">•</span>
                            {page.links.length} ลิงก์
                            <span className="mx-1">•</span>
                            <MousePointerClick size={10} /> {page.totalClicks || 0} คลิก
                            {viewAll && page.ownerId !== user.uid && (
                              <>
                                <span className="mx-1">•</span>
                                <User size={10} /> {page.ownerName}
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copyLink(page.slug, page.id)}
                          className="btn-glass p-2 text-sm"
                          title="คัดลอกลิงก์"
                        >
                          {copiedId === page.id ? <Check size={16} className="text-primary" /> : <Copy size={16} />}
                        </button>
                        <a
                          href={`/l/${page.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-glass p-2 text-sm"
                          title="เปิดหน้า"
                        >
                          <ExternalLink size={16} />
                        </a>
                        {(isOwner || page.ownerId === user.uid) && (
                          <button onClick={() => startEdit(page)} className="btn-glass p-2 text-sm" title="แก้ไข">
                            <Pencil size={16} />
                          </button>
                        )}
                        {(isOwner || page.ownerId === user.uid) && (
                          <button
                            onClick={() => deletePage(page)}
                            className="btn-glass p-2 text-sm text-destructive hover:bg-destructive/10"
                            title="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LinkTreePage;
