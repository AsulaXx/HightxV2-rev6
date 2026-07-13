import { useState } from "react";
import { Trophy, Plus, Trash2, GripVertical } from "lucide-react";
import AdminSection from "../shared/AdminSection";
import type { LeaderboardSettings, LeaderboardReward } from "@/contexts/SiteSettingsContext";

interface Props {
  leaderboard: LeaderboardSettings;
  onUpdate: (lb: LeaderboardSettings) => void;
  onSave: () => void;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

const COLOR_PRESETS = [
  { label: "ทอง", value: "from-yellow-400 to-amber-500" },
  { label: "เงิน", value: "from-gray-300 to-gray-400" },
  { label: "ทองแดง", value: "from-orange-400 to-amber-600" },
  { label: "น้ำเงิน", value: "from-blue-400 to-indigo-500" },
  { label: "เขียว", value: "from-emerald-400 to-teal-500" },
  { label: "ม่วง", value: "from-purple-400 to-violet-500" },
  { label: "แดง", value: "from-red-400 to-rose-500" },
  { label: "ชมพู", value: "from-pink-400 to-rose-500" },
];

const AdminLeaderboard = ({ leaderboard, onUpdate, onSave }: Props) => {
  const rewards = leaderboard.rewards || [];

  const updateReward = (id: string, patch: Partial<LeaderboardReward>) => {
    onUpdate({
      ...leaderboard,
      rewards: rewards.map(r => r.id === id ? { ...r, ...patch } : r),
    });
  };

  const addReward = () => {
    const nextRank = rewards.length > 0 ? Math.max(...rewards.map(r => r.rankTo)) + 1 : 1;
    onUpdate({
      ...leaderboard,
      rewards: [...rewards, {
        id: generateId(),
        rankFrom: nextRank,
        rankTo: nextRank,
        label: `อันดับ ${nextRank}`,
        reward: "รางวัล...",
        color: "from-blue-400 to-indigo-500",
      }],
    });
  };

  const removeReward = (id: string) => {
    onUpdate({ ...leaderboard, rewards: rewards.filter(r => r.id !== id) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Trophy size={24} className="text-yellow-400" /> ตั้งค่า Leaderboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">กำหนดรางวัลประจำเดือนสำหรับผู้ซื้อสินค้ามากที่สุด</p>
      </div>

      <AdminSection title="เปิด/ปิด Leaderboard" icon={<Trophy size={18} />}
        headerRight={
          <div
            onClick={() => onUpdate({ ...leaderboard, enabled: !leaderboard.enabled })}
            className={`toggle-slider ${leaderboard.enabled ? "toggle-active" : ""}`}
          />
        }
      >
        <p className="text-xs text-muted-foreground">
          {leaderboard.enabled ? "Leaderboard เปิดอยู่ — ผู้ใช้สามารถดูอันดับได้" : "Leaderboard ปิดอยู่ — หน้า Leaderboard จะไม่แสดง"}
        </p>
      </AdminSection>

      <AdminSection title="รางวัลประจำเดือน" icon={<Trophy size={18} />} description="กำหนดรางวัลสำหรับแต่ละอันดับ">
        <div className="space-y-3">
          {rewards.map((r, idx) => (
            <div key={r.id} className="glass-panel rounded-xl p-4 space-y-3 border border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">รางวัลที่ {idx + 1}</span>
                <button onClick={() => removeReward(r.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">อันดับเริ่ม</label>
                  <input
                    type="number"
                    min={1}
                    value={r.rankFrom}
                    onChange={e => updateReward(r.id, { rankFrom: parseInt(e.target.value) || 1 })}
                    className="w-full p-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">อันดับสิ้นสุด</label>
                  <input
                    type="number"
                    min={r.rankFrom}
                    value={r.rankTo}
                    onChange={e => updateReward(r.id, { rankTo: parseInt(e.target.value) || r.rankFrom })}
                    className="w-full p-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">ป้ายชื่อ (Label)</label>
                <input
                  type="text"
                  value={r.label}
                  onChange={e => updateReward(r.id, { label: e.target.value })}
                  className="w-full p-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  placeholder="🥇 อันดับ 1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">รางวัล</label>
                <input
                  type="text"
                  value={r.reward}
                  onChange={e => updateReward(r.id, { reward: e.target.value })}
                  className="w-full p-2 rounded-lg bg-background border border-border text-sm text-foreground"
                  placeholder="ส่วนลด 20% ทั้งร้าน"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">สี Gradient</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(cp => (
                    <button
                      key={cp.value}
                      onClick={() => updateReward(r.id, { color: cp.value })}
                      className={`h-7 px-3 rounded-full bg-gradient-to-r ${cp.value} text-[10px] font-bold text-white transition-all ${
                        r.color === cp.value ? "ring-2 ring-primary scale-105" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {cp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-lg bg-muted/30 p-2.5 text-center space-y-1">
                <div className={`text-xs font-bold bg-gradient-to-r ${r.color} bg-clip-text text-transparent`}>{r.label}</div>
                <div className="text-[11px] text-muted-foreground leading-tight">{r.reward}</div>
                <div className="text-[10px] text-muted-foreground">อันดับ {r.rankFrom === r.rankTo ? r.rankFrom : `${r.rankFrom}-${r.rankTo}`}</div>
              </div>
            </div>
          ))}

          <button
            onClick={addReward}
            className="w-full py-3 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 text-sm text-muted-foreground hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> เพิ่มรางวัล
          </button>
        </div>
      </AdminSection>

      <button
        onClick={onSave}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
      >
        💾 บันทึกการตั้งค่า
      </button>
    </div>
  );
};

export default AdminLeaderboard;
