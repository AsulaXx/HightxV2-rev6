import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Wallet, ShoppingBag, Users, Sparkles, ArrowLeft, ArrowRight, History as HistoryIcon, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const categories = [
  {
    title: "ประวัติเติมเงิน",
    desc: "ดูรายการเติมเครดิตทั้งหมด พร้อมสถานะการตรวจสอบ",
    icon: Wallet,
    path: "/wallet",
    gradient: "from-emerald-500/30 to-teal-500/20",
    accent: "text-emerald-400",
  },
  {
    title: "ประวัติซื้อสินค้า",
    desc: "คีย์/บัญชีที่กดไปแล้ว พร้อมข้อมูลและสถานะการรับ",
    icon: ShoppingBag,
    path: "/history/claims",
    gradient: "from-primary/30 to-accent/20",
    accent: "text-primary",
  },
  {
    title: "ประวัติสุ่มวงล้อ",
    desc: "ผลการหมุนวงล้อทั้งหมด พร้อมตัวกรองตามรางวัล",
    icon: Sparkles,
    path: "/wheel-history",
    gradient: "from-amber-500/30 to-orange-500/20",
    accent: "text-amber-400",
  },
  {
    title: "ตรวจสอบสถานะคำสั่ง",
    desc: "ใส่ attemptId / transRef เพื่อตรวจสอบว่าออเดอร์ถูกประมวลผลและเข้าระบบแล้วหรือยัง",
    icon: Search,
    path: "/attempt-status",
    gradient: "from-sky-500/30 to-indigo-500/20",
    accent: "text-sky-400",
  },
];

const HistoryHubPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12 relative z-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={12} /> กลับสู่หน้าแรก
        </Link>

        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent inline-flex items-center gap-2"
          >
            <HistoryIcon className="text-primary" size={28} /> ประวัติทั้งหมด
          </motion.h1>
          <p className="text-sm text-muted-foreground mt-2">เลือกหมวดหมู่ประวัติที่คุณต้องการดู</p>
        </div>

        {!user ? (
          <div className="glass-card text-center py-12">
            <h3 className="text-lg font-bold text-foreground">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-sm text-muted-foreground mt-1">เพื่อดูประวัติการใช้งานของคุณ</p>
            <Link to="/login" className="btn-gradient inline-flex items-center gap-2 px-5 py-2.5 text-sm mt-4">เข้าสู่ระบบ</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {categories.map((c, idx) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Link
                    to={c.path}
                    className={`group glass-card !p-5 block hover:border-primary/60 transition-all hover:-translate-y-1`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shrink-0 border border-border/40`}>
                        <Icon className={c.accent} size={26} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-extrabold text-foreground">{c.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{c.desc}</p>
                        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                          เปิดดูประวัติ <ArrowRight size={12} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryHubPage;
