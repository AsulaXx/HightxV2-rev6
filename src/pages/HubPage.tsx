import RedirectToLogin from "@/components/RedirectToLogin";
import { Link } from "react-router-dom";
import PermIcon from "@/components/PermIcon";
import { motion } from "framer-motion";
import { useAuth, ROLE_LABELS } from "@/contexts/AuthContext";
import { useSiteSettings, DEFAULT_PERMISSIONS_LIST, DEFAULT_ROLE_PERMISSIONS_MAP } from "@/contexts/SiteSettingsContext";
import { useLayoutConfig } from "@/hooks/useLayoutConfig";
import {
  BarChart3, Package, LayoutDashboard, Settings, KeyRound,
  History, Users, Shield, CheckCircle, XCircle, ScrollText, Megaphone,
  User, Share2, ChevronRight, TrendingUp, Sparkles,
  Wallet, Archive, Trophy, ShieldBan, Search, Activity, UserCog, ClipboardList,
} from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

type Item = { icon: any; title: string; desc: string; path: string };
type Section = { title: string; subtitle: string; icon: any; items: Item[] };

const HubPage = () => {
  const { settings } = useSiteSettings();
  const { user, profile, hasPermission } = useAuth();
  const { layout, colsToStyle, gapClass, maxWidthClass } = useLayoutConfig();
  const [personalStats, setPersonalStats] = useState({ claimed: 0 });

  const isHightXCrew = user && hasPermission("hightxcrew");
  const isMod = user && hasPermission("moderator");
  const isAdmin = user && hasPermission("admin");
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const q = query(collection(db, "keys"), where("claimed", "==", true), where("claimedBy", "==", user.uid));
        const snap = await getDocs(q);
        setPersonalStats({ claimed: snap.size });
      } catch (err) { const { logError } = await import("@/lib/errorLogger"); logError("HubPage.loadStats", err, "warn"); }
    };
    load();
  }, [user]);

  if (!user) return <RedirectToLogin />;

  const fade = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };
  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  // ─── Section: บัญชีของฉัน ───
  const account: Item[] = [
    { icon: User, title: "โปรไฟล์", desc: "จัดการข้อมูลส่วนตัวและบัญชี", path: "/profile" },
    { icon: Wallet, title: "Wallet", desc: "ยอดเครดิตและรายการเติม/ใช้จ่าย", path: "/wallet" },
    { icon: Shield, title: "สิทธิ์ของฉัน", desc: "ดูสิทธิ์ที่ยศของคุณใช้ได้", path: "/permissions" },
  ];

  // ─── Section: ประวัติ ───
  const histories: Item[] = [
    { icon: History, title: "ประวัติการกดคีย์", desc: "คีย์ที่คุณเคลมไปทั้งหมด", path: "/history/claims" },
    { icon: Wallet, title: "ประวัติ Wallet", desc: "ทุกรายการเติม/ใช้จ่ายของคุณ", path: "/wallet" },
  ];

  // ─── Section: กิจกรรม & ข้อมูล ───
  const activity: Item[] = [
    { icon: Megaphone, title: "ประกาศ", desc: "ข่าวสารและอัปเดตล่าสุด", path: "/announcements" },
    { icon: Activity, title: "สถานะสินค้า", desc: "สถานะการใช้งานปัจจุบันของสินค้า", path: "/product-status" },
    { icon: Trophy, title: "Leaderboard", desc: "อันดับลูกค้าซื้อสินค้ามากที่สุด", path: "/leaderboard" },
  ];

  // ─── Section: ผู้ดูแลระบบ (Mod+): ทางลัดเดียวไปหน้าตั้งค่าแอดมิน ───
  // เมนู "เครื่องมือทีมงาน" และ "จัดการระบบ" ทั้งหมดถูกย้ายไปไว้ในหน้า /admin แล้ว
  const staffShortcut: Item[] = [];
  if (isMod || isHightXCrew) {
    staffShortcut.push({
      icon: Settings,
      title: "ตั้งค่าแอดมิน",
      desc: "เครื่องมือทีมงานและการจัดการระบบทั้งหมดอยู่ที่นี่",
      path: "/admin",
    });
  }

  const sections: Section[] = [
    { items: account, title: "บัญชีของฉัน", subtitle: "ข้อมูลและการตั้งค่าส่วนตัว", icon: User },
    { items: histories, title: "ประวัติ", subtitle: "ดูย้อนหลังกิจกรรมของคุณ", icon: History },
    { items: activity, title: "กิจกรรม & ข้อมูล", subtitle: "ประกาศและสถิติของระบบ", icon: Sparkles },
    ...(staffShortcut.length > 0 ? [{ items: staffShortcut, title: "สำหรับทีมงาน", subtitle: "ทางลัดไปหน้าตั้งค่าแอดมิน", icon: Settings } as Section] : []),
  ];

  const renderServiceCard = (svc: Item) => (
    <Link to={svc.path} className="group glass-card-hover flex items-center gap-3 sm:gap-3.5 !p-3 sm:!p-4 !rounded-xl">
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:border-primary/25 transition-all duration-300">
        <svc.icon size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-300">{svc.title}</h3>
        <p className="text-[10px] sm:text-[11px] text-muted-foreground/60 truncate mt-0.5">{svc.desc}</p>
      </div>
      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-all duration-300">
        <ChevronRight size={12} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 sm:w-[14px] sm:h-[14px]" />
      </div>
    </Link>
  );

  return (
    <div className={`relative z-10 ${maxWidthClass()} mx-auto px-4 sm:px-6 py-6 sm:py-8`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2.5 sm:gap-3 mb-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">เมนูทั้งหมด</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground/60">เลือกหัวข้อที่ต้องการจัดการ</p>
          </div>
        </div>
      </motion.div>

      {/* User Stats Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6 sm:mb-8">
        <div className="glass-card !p-0 overflow-hidden !rounded-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border/20">
            {[
              { label: "ยศ", value: ROLE_LABELS[profile.role], icon: Shield, gradient: "from-primary/15 to-accent/10" },
              { label: "คีย์ที่เคลม", value: personalStats.claimed.toString(), icon: TrendingUp, gradient: "from-accent/15 to-primary/10" },
              { label: "อีเมล", value: profile.email, icon: User, small: true, gradient: "from-primary/10 to-accent/5" },
              { label: "ชื่อ", value: profile.displayName || "-", icon: User, small: true, gradient: "from-accent/10 to-primary/5" },
            ].map((stat, i) => (
              <div key={i} className="relative p-3 sm:p-4 lg:p-5 group hover:bg-primary/[0.02] transition-colors duration-500">
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className="relative flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <stat.icon size={14} className="text-primary sm:w-4 sm:h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">{stat.label}</p>
                    <p className={`font-bold text-foreground truncate ${stat.small ? 'text-[10px] sm:text-[11px]' : 'text-xs sm:text-sm'}`}>
                      {stat.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Service Sections */}
      {sections.map((section) => (
        <motion.section key={section.title} variants={stagger} initial="hidden" animate="show" className="mb-6 sm:mb-8">
          <motion.div variants={fade} className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
              <section.icon size={14} className="text-primary sm:w-4 sm:h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">{section.title}</h2>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">{section.subtitle}</p>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3" />
          </motion.div>
          <div className={`dynamic-grid ${gapClass()}`} style={colsToStyle(layout.hubCols)}>
            {section.items.map((svc) => (
              <motion.div key={svc.path + svc.title} variants={fade}>
                {renderServiceCard(svc)}
              </motion.div>
            ))}
          </div>
        </motion.section>
      ))}

      {/* Permissions */}
      <motion.section variants={stagger} initial="hidden" animate="show" className="mb-6 sm:mb-8">
        <motion.div variants={fade} className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center">
            <Shield size={14} className="text-primary sm:w-4 sm:h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground leading-tight">สิทธิ์ของคุณ</h2>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60">ยศ: {ROLE_LABELS[profile.role]}</p>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent ml-3" />
          <Link to="/permissions" className="text-[10px] sm:text-[11px] text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1 shrink-0">
            ดูทั้งหมด <ChevronRight size={12} />
          </Link>
        </motion.div>
        <motion.div variants={fade} className="glass-card !p-3 sm:!p-4 !rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
            {(settings.permissions?.length ? settings.permissions : DEFAULT_PERMISSIONS_LIST).map((perm) => {
              const rp = settings.rolePermissions && Object.keys(settings.rolePermissions).length ? settings.rolePermissions : DEFAULT_ROLE_PERMISSIONS_MAP;
              const has = rp[profile.role]?.includes(perm.id);
              return (
                <div key={perm.id} className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] transition-all duration-300 ${has ? "bg-gradient-to-br from-primary/8 to-accent/5 border border-primary/12 text-foreground" : "bg-muted/10 border border-border/10 text-muted-foreground/25 line-through"}`}>
                  {has ? (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
                      <CheckCircle size={10} className="text-primary sm:w-[11px] sm:h-[11px]" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-muted/20 flex items-center justify-center shrink-0">
                      <XCircle size={10} className="sm:w-[11px] sm:h-[11px]" />
                    </div>
                  )}
                  <PermIcon name={perm.icon || perm.id} size={11} className="shrink-0" />
                  <span className="truncate">{perm.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.section>
    </div>
  );
};

export default HubPage;
