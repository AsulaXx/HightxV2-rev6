import { Save, Rocket, Power, Key, Settings, Package, Wallet, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import { ROLE_LABELS, type UserRole } from "@/contexts/AuthContext";
import type { BoosterSettings } from "@/contexts/SiteSettingsContext";

const AdminBoosterTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const booster = form.booster || {
    enabled: true, brandName: "HightX Follower Booster", description: "",
    notice: "", autoRefundOnFail: true, minOrderQty: 100, maxOrderQty: 1000000,
    lowBalanceThreshold: 500, lowBalanceWebhookEnabled: true,
    allowedRoles: ["user","vip","reseller","hightxcrew","moderator","admin","owner"],
    maintenanceMode: false, maintenanceMessage: "ระบบ Booster อยู่ระหว่างปรับปรุง กรุณารอสักครู่",
    apiKey: "",
  };
  const updateBooster = (patch: Partial<BoosterSettings>) => setForm({ ...form, booster: { ...booster, ...patch } });
  const allRoles: UserRole[] = ["user","vip","reseller","hightxcrew","moderator","admin","owner"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Rocket size={24} /> ตั้งค่า Booster</h1>
          <p className="text-sm text-muted-foreground mt-1">จัดการบริการปั๊มโซเชียลมีเดียอย่างละเอียด</p>
        </div>
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Power size={16} /> สถานะระบบ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-muted/20 border border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`toggle-slider ${booster.enabled ? "toggle-active" : ""}`} onClick={() => updateBooster({ enabled: !booster.enabled })} />
              <div>
                <span className="text-sm font-semibold text-foreground">เปิดใช้งานบริการ Booster</span>
                <p className="text-[11px] text-muted-foreground">เมื่อปิด จะซ่อนหน้า Booster จากผู้ใช้ทั้งหมด</p>
              </div>
            </label>
          </div>
          <div className="p-3 rounded-xl bg-muted/20 border border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`toggle-slider ${booster.maintenanceMode ? "toggle-active" : ""}`} onClick={() => updateBooster({ maintenanceMode: !booster.maintenanceMode })} />
              <div>
                <span className="text-sm font-semibold text-foreground">โหมดปิดปรับปรุง</span>
                <p className="text-[11px] text-muted-foreground">แสดงข้อความปิดปรับปรุงแทนหน้าร้าน</p>
              </div>
            </label>
          </div>
        </div>
        {booster.maintenanceMode && (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">ข้อความปิดปรับปรุง</label>
            <input type="text" value={booster.maintenanceMessage} onChange={(e) => updateBooster({ maintenanceMessage: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="ระบบ Booster อยู่ระหว่างปรับปรุง..." />
          </div>
        )}
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Key size={16} /> API Key (Provider)</h3>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Booster API Key</label>
          <input type="password" value={booster.apiKey || ""} onChange={(e) => updateBooster({ apiKey: e.target.value })} className="input-glass w-full px-4 py-3 text-sm font-mono" placeholder="ใส่ API Key จาก Provider (เช่น MeeLike)" />
          <p className="text-xs text-muted-foreground mt-1">API Key นี้จะถูกส่งไปยัง Edge Function เมื่อสั่งซื้อ — ถ้าตั้งค่าที่นี่จะ override ค่า Secret ใน Supabase</p>
        </div>
        {!booster.apiKey && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">ยังไม่ได้ตั้งค่า API Key — บริการ Booster จะใช้งานไม่ได้ ถ้าไม่ได้ตั้ง Secret MEELIKE_API_KEY ไว้ใน Supabase</p>
          </div>
        )}
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Settings size={16} /> ข้อมูลทั่วไป</h3>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">ชื่อบริการ</label>
          <input type="text" value={booster.brandName} onChange={(e) => updateBooster({ brandName: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="HightX Follower Booster" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">คำอธิบายบริการ</label>
          <textarea value={booster.description} onChange={(e) => updateBooster({ description: e.target.value })} className="input-glass w-full px-4 py-3 text-sm min-h-[60px] resize-y" placeholder="บริการปั๊มผู้ติดตามและยอดไลค์..." />
        </div>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">📢 ข้อความแจ้งเตือนลูกค้า</label>
          <textarea value={booster.notice} onChange={(e) => updateBooster({ notice: e.target.value })} className="input-glass w-full px-4 py-3 text-sm min-h-[60px] resize-y" placeholder="แสดงข้อความเตือน/ประกาศที่หน้า Booster (เว้นว่างเพื่อซ่อน)" />
        </div>
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Package size={16} /> ตั้งค่าการสั่งซื้อ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">จำนวนสั่งซื้อขั้นต่ำ</label>
            <input type="number" min={1} value={booster.minOrderQty} onChange={(e) => updateBooster({ minOrderQty: Math.max(1, parseInt(e.target.value) || 1) })} className="input-glass w-full px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">จำนวนสั่งซื้อสูงสุด</label>
            <input type="number" min={1} value={booster.maxOrderQty} onChange={(e) => updateBooster({ maxOrderQty: Math.max(1, parseInt(e.target.value) || 1000000) })} className="input-glass w-full px-4 py-3 text-sm" />
          </div>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`toggle-slider ${booster.autoRefundOnFail ? "toggle-active" : ""}`} onClick={() => updateBooster({ autoRefundOnFail: !booster.autoRefundOnFail })} />
            <div>
              <span className="text-sm font-semibold text-foreground">คืนเครดิตอัตโนมัติเมื่อ API ล้มเหลว</span>
              <p className="text-[11px] text-muted-foreground">หาก API ต้นทางส่งคืน error ระบบจะคืนเครดิตให้ลูกค้าทันที</p>
            </div>
          </label>
        </div>
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Wallet size={16} /> ยอดเงินต้นทาง (Provider)</h3>
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">เตือนเมื่อยอดเงินต้นทางเหลือต่ำกว่า (฿)</label>
          <input type="number" min={0} value={booster.lowBalanceThreshold} onChange={(e) => updateBooster({ lowBalanceThreshold: Math.max(0, parseInt(e.target.value) || 0) })} className="input-glass w-full px-4 py-3 text-sm" />
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`toggle-slider ${booster.lowBalanceWebhookEnabled ? "toggle-active" : ""}`} onClick={() => updateBooster({ lowBalanceWebhookEnabled: !booster.lowBalanceWebhookEnabled })} />
            <div>
              <span className="text-sm font-semibold text-foreground">เปิดแจ้งเตือน Webhook เมื่อยอดเงินต่ำ</span>
              <p className="text-[11px] text-muted-foreground">ส่งผ่าน Webhook Booster หรือ Webhook หลัก</p>
            </div>
          </label>
        </div>
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Shield size={16} /> สิทธิ์การเข้าถึง</h3>
        <p className="text-xs text-muted-foreground">กำหนดว่ายศไหนสามารถใช้บริการ Booster ได้</p>
        <div className="flex flex-wrap gap-2">
          {allRoles.map((role) => {
            const has = booster.allowedRoles?.includes(role);
            return (
              <button
                key={role}
                onClick={() => {
                  const updated = has
                    ? booster.allowedRoles.filter((r: string) => r !== role)
                    : [...(booster.allowedRoles || []), role];
                  updateBooster({ allowedRoles: updated });
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                  has
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/30 text-muted-foreground/50 border border-border"
                }`}
              >
                {has ? <CheckCircle size={10} className="inline mr-1" /> : <XCircle size={10} className="inline mr-1" />}
                {ROLE_LABELS[role as UserRole]?.replace(/[^\w\s\u0E00-\u0E7F]/g, '').trim()}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกตั้งค่า Booster</button>
    </div>
  );
};

export default AdminBoosterTab;
