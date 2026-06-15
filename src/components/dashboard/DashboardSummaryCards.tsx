import { motion } from "framer-motion";
import { Users, Key, Package, Shield, CalendarDays, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Props {
  totalUsers: number;
  totalClaimedKeys: number;
  totalAvailableKeys: number;
  roleBreakdown: Record<string, number>;
  todayRevenue: number;
  todayClaims: number;
  totalRevenue: number;
  revenueTrend: number;
}

const DashboardSummaryCards = ({
  totalUsers, totalClaimedKeys, totalAvailableKeys, roleBreakdown,
  todayRevenue, todayClaims, totalRevenue, revenueTrend,
}: Props) => (
  <>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { label: "ผู้ใช้ทั้งหมด", value: totalUsers.toLocaleString(), suffix: "คน", icon: Users, color: "from-blue-500 to-cyan-400" },
        { label: "คีย์ที่ถูกกด", value: totalClaimedKeys.toLocaleString(), icon: Key, color: "from-purple-500 to-pink-400" },
        { label: "คีย์คงเหลือ", value: totalAvailableKeys.toLocaleString(), icon: Package, color: "from-emerald-500 to-teal-400" },
        { label: "ยศทั้งหมด", value: Object.keys(roleBreakdown).length.toString(), icon: Shield, color: "from-orange-500 to-amber-400" },
      ].map((card, i) => (
        <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
              <card.icon size={18} className="text-white" />
            </div>
          </div>
          <p className="text-xl font-bold text-foreground">{card.value} {card.suffix && <span className="text-sm font-normal text-muted-foreground">{card.suffix}</span>}</p>
        </motion.div>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">รายได้วันนี้</span>
          <CalendarDays size={16} className="text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground">฿{todayRevenue.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{todayClaims} รายการ</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">รายได้รวมทั้งหมด</span>
          <DollarSign size={16} className="text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold text-foreground">฿{totalRevenue.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{totalClaimedKeys} คีย์ทั้งหมด</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">แนวโน้ม 7 วัน</span>
          {revenueTrend >= 0 ? <ArrowUpRight size={16} className="text-emerald-400" /> : <ArrowDownRight size={16} className="text-destructive" />}
        </div>
        <p className={`text-2xl font-bold ${revenueTrend >= 0 ? "text-emerald-400" : "text-destructive"}`}>
          {revenueTrend >= 0 ? "+" : ""}{revenueTrend}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">เทียบกับ 7 วันก่อนหน้า</p>
      </motion.div>
    </div>
  </>
);

export default DashboardSummaryCards;
