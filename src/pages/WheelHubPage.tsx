import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CircleDot, Sparkles, Coins, Gift, ArrowRight, Trophy, ArrowLeft, Lock } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const WheelHubPage = () => {
  const { settings } = useSiteSettings();

  const wheels = useMemo(
    () => (settings.wheels || [])
      .filter(w => w.enabled)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [settings.wheels]
  );

  return (
    <div className="min-h-screen px-4 py-8 sm:py-12 relative z-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/hub" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={12} /> กลับไปหน้าบริการ
        </Link>

        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-5xl font-extrabold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent inline-flex items-center gap-3"
          >
            <Sparkles className="text-primary" size={32} /> วงล้อสุ่มรางวัล
          </motion.h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl mx-auto">
            เลือกวงล้อที่คุณสนใจ ลุ้นรับเครดิต สินค้า หรือของรางวัลพิเศษมากมาย
          </p>
          <Link to="/wheel-history" className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Trophy size={12} /> ประวัติการหมุนของฉัน
          </Link>
        </div>

        {wheels.length === 0 ? (
          <div className="glass-card text-center py-16">
            <CircleDot size={48} className="text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground">ยังไม่มีวงล้อให้หมุนในตอนนี้</h3>
            <p className="text-sm text-muted-foreground mt-1">โปรดติดตามอีกครั้งเร็ว ๆ นี้</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {wheels.map((w, idx) => {
              const totalWeight = w.prizes.reduce((s, p) => s + (Number(p.weight) || 0), 0);
              const topPrizes = [...w.prizes]
                .filter(p => p.rewardType !== "none")
                .sort((a, b) => (b.creditAmount || 0) - (a.creditAmount || 0))
                .slice(0, 3);
              return (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <Link
                    to={`/wheel/${w.slug}`}
                    className="group glass-card !p-0 overflow-hidden block hover:border-primary/60 transition-all hover:-translate-y-1"
                  >
                    <div
                      className="relative h-36 overflow-hidden"
                      style={{
                        background: w.bannerUrl
                          ? `url(${w.bannerUrl}) center/cover`
                          : "linear-gradient(135deg, hsl(var(--primary) / 0.4), hsl(var(--accent) / 0.4))",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        {w.cost > 0 ? (
                          <span className="px-2 py-1 rounded-full bg-background/80 backdrop-blur text-[10px] font-bold text-primary inline-flex items-center gap-1">
                            <Coins size={10} /> {w.cost}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-emerald-500/90 text-[10px] font-bold text-white inline-flex items-center gap-1">
                            <Gift size={10} /> ฟรี
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-lg font-extrabold text-foreground line-clamp-1">{w.name}</h3>
                      </div>
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-8 -right-8 opacity-30 group-hover:opacity-60 transition-opacity"
                      >
                        <CircleDot size={120} className="text-primary" />
                      </motion.div>
                    </div>

                    <div className="p-4 space-y-3">
                      {w.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{w.description}</p>
                      )}

                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          รางวัลเด่น ({w.prizes.length} รางวัล)
                        </div>
                        {topPrizes.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {topPrizes.map(p => {
                              const pct = totalWeight > 0 ? ((Number(p.weight) || 0) / totalWeight) * 100 : 0;
                              return (
                                <span
                                  key={p.id}
                                  className="text-[10px] px-2 py-0.5 rounded-md font-medium border"
                                  style={{
                                    borderColor: (p.color || "hsl(var(--primary))") + "60",
                                    background: (p.color || "hsl(var(--primary))") + "20",
                                    color: "hsl(var(--foreground))",
                                  }}
                                  title={`โอกาส ${pct.toFixed(1)}%`}
                                >
                                  {p.label}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Lock size={10} /> ยังไม่มีรางวัล
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          {w.cooldownSeconds > 0 && <span>คูลดาวน์ {w.cooldownSeconds}s</span>}
                          {w.maxSpinsPerUser > 0 && <span>สูงสุด {w.maxSpinsPerUser} ครั้ง</span>}
                        </div>
                        <span className="text-xs font-bold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                          เริ่มหมุน <ArrowRight size={12} />
                        </span>
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

export default WheelHubPage;
