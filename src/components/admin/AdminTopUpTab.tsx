import { Save, Plus, Trash2, Wallet, CreditCard, Gift, Tag, Percent, DollarSign, XCircle, Eye, CheckCircle, AlertTriangle, Copy, Building2, Smartphone, QrCode, Info, CircleCheck, Megaphone, Bell, ShieldAlert } from "lucide-react";
import { AdminTabProps, generateId } from "./AdminTabProps";
import { type TopUpSettings, type GiftCode } from "@/contexts/SiteSettingsContext";
import { toast } from "sonner";
import AdminTopUpProviders from "./AdminTopUpProviders";

interface BankAccountEntry {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  type: "bank" | "promptpay" | "truewallet";
  enabled: boolean;
  customColor?: string;
}

const BANK_PRESETS: { value: string; label: string; color: string }[] = [
  { value: "SCB", label: "ไทยพาณิชย์ (SCB)", color: "#4E2A84" },
  { value: "KBANK", label: "กสิกรไทย (KBank)", color: "#138F2D" },
  { value: "KTB", label: "กรุงไทย (KTB)", color: "#1BA5E0" },
  { value: "BBL", label: "กรุงเทพ (BBL)", color: "#1E3A8A" },
  { value: "BAY", label: "กรุงศรี (BAY)", color: "#FFC107" },
  { value: "TMBThanachart", label: "ทีทีบี (TTB)", color: "#0066FF" },
  { value: "GSB", label: "ออมสิน (GSB)", color: "#E91E8C" },
  { value: "PromptPay", label: "PromptPay", color: "#003B71" },
  { value: "TrueWallet", label: "TrueWallet", color: "#22C55E" },
  { value: "other", label: "อื่นๆ", color: "#6B7280" },
];

const bankTypeIcon = (type: string) => {
  if (type === "promptpay") return <QrCode size={16} className="text-blue-500" />;
  if (type === "truewallet") return <Smartphone size={16} className="text-green-500" />;
  return <Building2 size={16} className="text-primary" />;
};

const AdminTopUpTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const topUp: TopUpSettings = form.topUp || { enabled: true, bankSlipEnabled: true, truewalletEnabled: true, voucherEnabled: true, giftCodeEnabled: false, truewalletFeeEnabled: false, truewalletFeePercent: 2.9, minTopUp: 0, maxTopUp: 0, qrEnabled: false, qrProvider: 'plernpay', qrPromptPayTarget: '', qrExpireMinutes: 15 };
  const updateTopUp = (updates: Partial<TopUpSettings>) => setForm({ ...form, topUp: { ...topUp, ...updates } });
  const giftCodes: GiftCode[] = form.giftCodes || [];
  const addGiftCode = () => setForm({ ...form, giftCodes: [...giftCodes, { id: generateId(), code: Math.random().toString(36).substring(2, 10).toUpperCase(), amount: 100, maxUses: 1, usedCount: 0, enabled: true }] });
  const updateGiftCode = (id: string, updates: Partial<GiftCode>) => setForm({ ...form, giftCodes: giftCodes.map((g: GiftCode) => g.id === id ? { ...g, ...updates } : g) });
  const removeGiftCode = (id: string) => setForm({ ...form, giftCodes: giftCodes.filter((g: GiftCode) => g.id !== id) });

  const bankAccounts: BankAccountEntry[] = form.bankAccounts || [];
  const addBankAccount = () => {
    setForm({ ...form, bankAccounts: [...bankAccounts, { id: generateId(), bankName: "SCB", accountName: "", accountNumber: "", type: "bank", enabled: true }] });
  };
  const updateBankAccount = (id: string, updates: Partial<BankAccountEntry>) => {
    setForm({ ...form, bankAccounts: bankAccounts.map(a => a.id === id ? { ...a, ...updates } : a) });
  };
  const removeBankAccount = (id: string) => {
    setForm({ ...form, bankAccounts: bankAccounts.filter(a => a.id !== id) });
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">ตั้งค่าเติมเงิน</h1>
        <p className="text-sm text-muted-foreground mt-1">จัดการช่องทางเติมเงิน ค่าธรรมเนียม และ Gift Code</p>
      </div>

      {/* Master Toggle */}
      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Wallet size={16} /> ระบบเติมเงิน</h3>
        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${topUp.enabled ? "toggle-active" : ""}`} onClick={() => updateTopUp({ enabled: !topUp.enabled })} />
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบเติมเงิน</span>
          </label>
        </div>
        {!topUp.enabled && (
          <p className="text-xs text-yellow-500 flex items-center gap-1.5"><XCircle size={12} /> ระบบเติมเงินถูกปิด ผู้ใช้จะไม่สามารถเติมเงินได้</p>
        )}
      </div>

      {/* Bank Accounts - Card Grid */}
      <div className="glass-card space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><CreditCard size={16} /> บัญชีสำหรับรับโอนเงิน</h3>
            <p className="text-xs text-muted-foreground mt-1">เพิ่มบัญชีธนาคาร PromptPay หรือ TrueWallet ที่ลูกค้าจะเห็นในหน้าเติมเงิน</p>
          </div>
          <button onClick={addBankAccount} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5 font-medium"><Plus size={14} /> เพิ่มบัญชี</button>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border/30 rounded-2xl">
            <Building2 size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">ยังไม่มีบัญชี</p>
            <p className="text-xs text-muted-foreground/60 mt-1">กดปุ่ม "เพิ่มบัญชี" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bankAccounts.map((acc) => {
              const preset = BANK_PRESETS.find(b => b.value === acc.bankName);
              const displayLabel = preset?.label || acc.bankName;
              const accentColor = preset?.color || "#6B7280";
              return (
                <div key={acc.id} className={`relative rounded-2xl border transition-all duration-200 overflow-hidden ${acc.enabled ? "border-border/40 bg-card/80" : "border-border/20 bg-muted/30 opacity-60"}`}>
                  {/* Color accent bar */}
                  <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />
                  <div className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {bankTypeIcon(acc.type)}
                        <span className="text-sm font-bold text-foreground">{displayLabel}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`toggle-slider scale-75 ${acc.enabled ? "toggle-active" : ""}`} onClick={() => updateBankAccount(acc.id, { enabled: !acc.enabled })} />
                        <button onClick={() => removeBankAccount(acc.id)} className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </div>

                    {/* Bank Select */}
                    <select
                      value={acc.bankName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const t = val === "PromptPay" ? "promptpay" : val === "TrueWallet" ? "truewallet" : "bank";
                        updateBankAccount(acc.id, { bankName: val, type: t });
                      }}
                      className="input-glass w-full px-3 py-2 text-xs"
                    >
                      {BANK_PRESETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>

                    {/* Account Name */}
                    <input
                      type="text"
                      value={acc.accountName}
                      onChange={(e) => updateBankAccount(acc.id, { accountName: e.target.value })}
                      className="input-glass w-full px-3 py-2 text-xs"
                      placeholder="ชื่อบัญชี / ชื่อเจ้าของ"
                    />

                    {/* Account Number */}
                    <input
                      type="text"
                      value={acc.accountNumber}
                      onChange={(e) => updateBankAccount(acc.id, { accountNumber: e.target.value })}
                      className="input-glass w-full px-3 py-2 text-xs font-mono"
                      placeholder={acc.type === "promptpay" ? "เบอร์โทร / เลขบัตร ปชช." : "เลขบัญชี"}
                    />

                    {/* Custom Color */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground shrink-0">สีธนาคาร:</label>
                      <input
                        type="color"
                        value={acc.customColor || accentColor}
                        onChange={(e) => updateBankAccount(acc.id, { customColor: e.target.value })}
                        className="w-7 h-7 rounded-lg border border-border/30 cursor-pointer p-0.5"
                      />
                      {acc.customColor && (
                        <button onClick={() => updateBankAccount(acc.id, { customColor: undefined })} className="text-[10px] text-muted-foreground hover:text-destructive">รีเซ็ต</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> บันทึกบัญชี</button>
      </div>

      {topUp.enabled && (
        <>
          {/* NEW: API Providers credentials & test */}
          <AdminTopUpProviders />

          {/* Provider selection moved into AdminTopUpProviders (single-API exclusive toggle) */}

          {/* Channel Toggles */}
          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><CreditCard size={16} /> ช่องทางเติมเงิน</h3>
            {([
              { key: "bankSlipEnabled" as const, label: "สลิปธนาคาร (อัปโหลดรูป)", Icon: CreditCard },
              { key: "qrEnabled" as const, label: "สร้าง QR Code ให้สแกน (PromptPay)", Icon: QrCode },
              { key: "truewalletEnabled" as const, label: "TrueWallet (สลิป)", Icon: Wallet },
              { key: "voucherEnabled" as const, label: "ซองอั่งเปา TrueWallet", Icon: Gift },
              { key: "giftCodeEnabled" as const, label: "Gift Code", Icon: Tag },
            ]).map(ch => (
              <div key={ch.key} className="p-3 rounded-xl bg-muted/20 border border-border">
                <label className="flex items-center cursor-pointer">
                  <div className={`toggle-slider ${topUp[ch.key] ? "toggle-active" : ""}`} onClick={() => updateTopUp({ [ch.key]: !topUp[ch.key] } as any)} />
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5"><ch.Icon size={14} /> {ch.label}</span>
                </label>
              </div>
            ))}
          </div>

          {/* QR Topup Config */}
          {topUp.qrEnabled && (
            <div className="glass-card space-y-4 border-2 border-blue-500/20">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2"><QrCode size={16} className="text-blue-500" /> ตั้งค่า QR Code (สแกนจ่าย)</h3>
                <p className="text-xs text-muted-foreground mt-1">ผู้ใช้ระบุจำนวนเงิน → ระบบสร้าง QR PromptPay ให้สแกน → ตรวจชำระอัตโนมัติ (webhook + polling)</p>
              </div>

              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 flex items-start gap-2">
                <QrCode size={14} className="text-violet-500 mt-0.5 shrink-0" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  ระบบใช้ <strong className="text-violet-500">PlernPay</strong> สำหรับสร้าง QR Code ตามจำนวนเงิน (auto-confirm ผ่าน webhook)
                  <br />กรอก Client ID/Secret ของ PlernPay และเปิดการ์ด PlernPay ที่ "API Providers" ด้านบน
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">QR หมดอายุใน (นาที)</label>
                <input
                  type="number" min="1" max="60"
                  value={topUp.qrExpireMinutes ?? 15}
                  onChange={(e) => updateTopUp({ qrExpireMinutes: parseInt(e.target.value) || 15 })}
                  className="input-glass w-full px-3 py-2.5 text-sm"
                />
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/20 border border-border/40 rounded-lg p-3 space-y-1">
                <p className="flex items-center gap-1.5"><Info size={12} /> <strong>Webhook URL (ตั้งใน Provider):</strong></p>
                <code className="block text-[10px] font-mono bg-background/60 border border-border/30 rounded p-2 break-all select-all">
                  {`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'YOUR_PROJECT'}.functions.supabase.co/topup-qr?action=webhook`}
                </code>
                <p className="text-[10px]">Provider ส่ง POST พร้อม body <code>{`{ reference, status: "paid" }`}</code> เพื่อ confirm การชำระ</p>
              </div>

              <button onClick={handleSave} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"><Save size={14} /> บันทึก QR Settings</button>
            </div>
          )}

          {/* TrueWallet Fee */}
          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Percent size={16} /> ค่าธรรมเนียม TrueWallet</h3>
            <p className="text-xs text-muted-foreground">หักค่าธรรมเนียมจากยอดเงินที่เติมผ่าน TrueWallet (สลิป + ซอง)</p>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <label className="flex items-center cursor-pointer">
                <div className={`toggle-slider ${topUp.truewalletFeeEnabled ? "toggle-active" : ""}`} onClick={() => updateTopUp({ truewalletFeeEnabled: !topUp.truewalletFeeEnabled })} />
                <span className="text-sm font-medium text-foreground">เปิดหักค่าธรรมเนียม</span>
              </label>
            </div>
            {topUp.truewalletFeeEnabled && (
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">เปอร์เซ็นต์ ({topUp.truewalletFeePercent}%)</label>
                <input type="number" min="0" max="50" step="0.1" value={topUp.truewalletFeePercent} onChange={(e) => updateTopUp({ truewalletFeePercent: parseFloat(e.target.value) || 0 })} className="input-glass w-full px-4 py-3 text-sm" />
                <p className="text-[10px] text-muted-foreground mt-2">ตัวอย่าง: เติม ฿100 → หัก {topUp.truewalletFeePercent}% → ได้ ฿{(100 * (1 - topUp.truewalletFeePercent / 100)).toFixed(2)}</p>
              </div>
            )}
          </div>

          {/* Min/Max TopUp */}
          <div className="glass-card space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2"><DollarSign size={16} /> จำกัดยอดเติมเงิน</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">ขั้นต่ำ (0 = ไม่จำกัด)</label>
                <input type="number" min="0" value={topUp.minTopUp || 0} onChange={(e) => updateTopUp({ minTopUp: parseInt(e.target.value) || 0 })} className="input-glass w-full px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">สูงสุด (0 = ไม่จำกัด)</label>
                <input type="number" min="0" value={topUp.maxTopUp || 0} onChange={(e) => updateTopUp({ maxTopUp: parseInt(e.target.value) || 0 })} className="input-glass w-full px-3 py-2.5 text-sm" />
              </div>
            </div>
          </div>

          {/* Shop Account Settings */}
          <div className="glass-card space-y-6 border-2 border-primary/20">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                🏦 ตั้งค่าบัญชีร้าน & ตรวจสอบปลายทาง
              </h3>
            </div>

            {/* Preview Panel */}
            {(() => {
              const allAccounts: { type: string; label: string; number: string }[] = [];
              if (form.matchReceiverAccount) {
                allAccounts.push({ type: "bank", label: "บัญชีหลัก (เดิม)", number: form.matchReceiverAccount });
              }
              (form.matchReceiverAccounts || []).forEach((a: any) => {
                if (a.accountNumber) allAccounts.push({ type: a.type || "bank", label: a.label || `บัญชี ${a.type}`, number: a.accountNumber });
              });
              const typeIcon: Record<string, string> = { bank: "🏦", promptpay: "📱", truewallet: "💚" };
              const typeLabel: Record<string, string> = { bank: "ธนาคาร", promptpay: "PromptPay", truewallet: "TrueWallet" };
              const hasTwPhone = form.truewalletPhone && form.truewalletPhone.length >= 9;

              return (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Eye size={14} className="text-primary" /> Preview: บัญชีที่ระบบยอมรับ
                  </div>

                  {allAccounts.length === 0 && !hasTwPhone && !form.matchReceiverName && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive flex items-start gap-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span><strong>⚠️ ยังไม่ได้ตั้งค่าบัญชีร้าน!</strong> ระบบจะพึ่ง Thunder API Whitelist เพียงอย่างเดียว หากไม่ได้ตั้งค่าใน Thunder Dashboard ด้วย ลูกค้าจะเอาสลิปจากบัญชีใดก็ได้มาเติมเงิน</span>
                    </div>
                  )}

                  {allAccounts.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">บัญชีธนาคาร / PromptPay</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allAccounts.map((acc, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2 border border-border/30">
                            <span className="text-lg">{typeIcon[acc.type] || "🏦"}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground truncate">{acc.label}</p>
                              <p className="text-[11px] font-mono text-muted-foreground">{acc.number} <span className="text-[10px] text-muted-foreground/60">({typeLabel[acc.type] || acc.type})</span></p>
                            </div>
                            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasTwPhone && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">TrueWallet ซองอั่งเปา</span>
                      <div className="flex items-center gap-2.5 bg-background/60 rounded-lg px-3 py-2 border border-border/30 max-w-sm">
                        <span className="text-lg">💚</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">เบอร์รับซอง</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{form.truewalletPhone}</p>
                        </div>
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      </div>
                    </div>
                  )}

                  {form.matchReceiverName && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ตรวจสอบชื่อ</span>
                      <p className="text-xs text-foreground">ชื่อที่ยอมรับ: <span className="font-mono font-bold">{form.matchReceiverName}</span></p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Receiver Account (Legacy) */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">บัญชีหลัก (เลขบัญชี/PromptPay เดิม)</label>
              <input type="text" value={form.matchReceiverAccount || ""} onChange={(e) => setForm({ ...form, matchReceiverAccount: e.target.value })} className="input-glass w-full px-4 py-3 text-sm font-mono" placeholder="xxx-x-xxxxx-x" />
            </div>

            {/* Multiple Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">บัญชีเพิ่มเติม</label>
                <button onClick={() => setForm({ ...form, matchReceiverAccounts: [...(form.matchReceiverAccounts || []), { id: generateId(), type: "bank", label: "", accountNumber: "" }] })} className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1"><Plus size={12} /> เพิ่มบัญชี</button>
              </div>
              {(form.matchReceiverAccounts || []).map((acc: any, idx: number) => (
                <div key={acc.id || idx} className="p-3 rounded-xl bg-muted/10 border border-border/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">บัญชี #{idx + 1}</span>
                    <button onClick={() => setForm({ ...form, matchReceiverAccounts: (form.matchReceiverAccounts || []).filter((_: any, i: number) => i !== idx) })} className="p-1 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={12} /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select value={acc.type || "bank"} onChange={(e) => { const accs = [...(form.matchReceiverAccounts || [])]; accs[idx] = { ...accs[idx], type: e.target.value }; setForm({ ...form, matchReceiverAccounts: accs }); }} className="input-glass px-3 py-2 text-xs">
                      <option value="bank">🏦 ธนาคาร</option>
                      <option value="promptpay">📱 PromptPay</option>
                      <option value="truewallet">💚 TrueWallet</option>
                    </select>
                    <input type="text" value={acc.label || ""} onChange={(e) => { const accs = [...(form.matchReceiverAccounts || [])]; accs[idx] = { ...accs[idx], label: e.target.value }; setForm({ ...form, matchReceiverAccounts: accs }); }} className="input-glass px-3 py-2 text-xs" placeholder="ชื่อ/ป้ายกำกับ" />
                    <input type="text" value={acc.accountNumber || ""} onChange={(e) => { const accs = [...(form.matchReceiverAccounts || [])]; accs[idx] = { ...accs[idx], accountNumber: e.target.value }; setForm({ ...form, matchReceiverAccounts: accs }); }} className="input-glass px-3 py-2 text-xs font-mono" placeholder="เลขบัญชี" />
                  </div>
                </div>
              ))}
            </div>

            {/* Receiver Name */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">ชื่อผู้รับ (ตรวจสอบ)</label>
              <input type="text" value={form.matchReceiverName || ""} onChange={(e) => setForm({ ...form, matchReceiverName: e.target.value })} className="input-glass w-full px-4 py-3 text-sm" placeholder="ชื่อ-นามสกุล ผู้รับเงิน" />
              <p className="text-[10px] text-muted-foreground mt-1">ใช้ตรวจสอบว่าสลิปโอนเงินไปถูกคน (เว้นว่าง = ไม่ตรวจ)</p>
            </div>

            {/* TrueWallet Phone */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">เบอร์ TrueWallet (รับซองอั่งเปา)</label>
              <input type="tel" value={form.truewalletPhone || ""} onChange={(e) => setForm({ ...form, truewalletPhone: e.target.value })} className="input-glass w-full px-4 py-3 text-sm font-mono" placeholder="0812345678" />
            </div>
          </div>

          {/* Gift Codes */}
          {topUp.giftCodeEnabled && (
            <div className="glass-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Gift size={16} /> Gift Codes ({giftCodes.length})</h3>
                <button onClick={addGiftCode} className="btn-glass px-3 py-1.5 text-xs flex items-center gap-1"><Plus size={12} /> สร้าง Gift Code</button>
              </div>
              {giftCodes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี Gift Code</p>
              ) : (
                <div className="space-y-3">
                  {giftCodes.map((gc: GiftCode) => (
                    <div key={gc.id} className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`toggle-slider ${gc.enabled ? "toggle-active" : ""}`} onClick={() => updateGiftCode(gc.id, { enabled: !gc.enabled })} />
                          <span className="text-xs font-bold font-mono text-foreground">{gc.code}</span>
                          <button onClick={() => { navigator.clipboard.writeText(gc.code); toast.success("คัดลอกแล้ว!"); }} className="p-1 rounded hover:bg-muted/40"><Copy size={11} /></button>
                        </div>
                        <button onClick={() => removeGiftCode(gc.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 size={13} /></button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">โค้ด</label>
                          <input type="text" value={gc.code} onChange={(e) => updateGiftCode(gc.id, { code: e.target.value.toUpperCase() })} className="input-glass w-full px-3 py-2 text-xs font-mono" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">จำนวนเงิน (฿)</label>
                          <input type="number" min="1" value={gc.amount} onChange={(e) => updateGiftCode(gc.id, { amount: parseInt(e.target.value) || 0 })} className="input-glass w-full px-3 py-2 text-xs" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">ใช้ได้ (ครั้ง)</label>
                          <input type="number" min="1" value={gc.maxUses} onChange={(e) => updateGiftCode(gc.id, { maxUses: parseInt(e.target.value) || 1 })} className="input-glass w-full px-3 py-2 text-xs" />
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">ใช้แล้ว: {gc.usedCount}/{gc.maxUses} ครั้ง</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ข้อความแจ้งลูกค้า */}
      <div className="glass-card !p-5 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">ข้อความแจ้งลูกค้า</h3>
        </div>
        <p className="text-xs text-muted-foreground">ข้อความนี้จะแสดงเป็นกล่องแจ้งเตือนด้านบนของหน้าเติมเงิน (เว้นว่างเพื่อซ่อน)</p>
        <textarea
          value={topUp.noticeMessage || ""}
          onChange={(e) => updateTopUp({ noticeMessage: e.target.value })}
          className="input-glass w-full px-4 py-3 text-sm min-h-[80px] resize-y"
          placeholder="เช่น: โปรดตรวจสอบยอดเงินก่อนโอน..."
        />
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">สีกล่องข้อความ</label>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "amber", label: "เหลือง", color: "#f59e0b" },
              { value: "green", label: "เขียว", color: "#22c55e" },
              { value: "red", label: "แดง", color: "#ef4444" },
              { value: "blue", label: "น้ำเงิน", color: "#3b82f6" },
            ] as const).map((c) => (
              <button
                key={c.value}
                onClick={() => updateTopUp({ noticeColor: c.value })}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${(topUp.noticeColor || "amber") === c.value ? "border-foreground/40 bg-foreground/10 ring-1 ring-foreground/20" : "border-border/40 bg-muted/10 hover:bg-muted/20"}`}
              >
                <span className="w-4 h-4 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-2">ไอคอน</label>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "warning", label: "แจ้งเตือน", Icon: AlertTriangle },
              { value: "info", label: "ข้อมูล", Icon: Info },
              { value: "success", label: "สำเร็จ", Icon: CircleCheck },
              { value: "megaphone", label: "ประกาศ", Icon: Megaphone },
              { value: "bell", label: "แจ้งเตือน 🔔", Icon: Bell },
            ] as const).map((ic) => (
              <button
                key={ic.value}
                onClick={() => updateTopUp({ noticeIcon: ic.value })}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${(topUp.noticeIcon || "warning") === ic.value ? "border-foreground/40 bg-foreground/10 ring-1 ring-foreground/20" : "border-border/40 bg-muted/10 hover:bg-muted/20"}`}
              >
                <ic.Icon size={14} />
                {ic.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-Ban Configuration */}
      <div className="glass-card space-y-4">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2"><ShieldAlert size={16} className="text-destructive" /> ระบบแบนอัตโนมัติ (สลิป)</h3>
          <p className="text-xs text-muted-foreground mt-1">แบนผู้ใช้อัตโนมัติเมื่อพยายามใช้สลิปผิดพลาดเกินกำหนด</p>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border">
          <label className="flex items-center cursor-pointer">
            <div className={`toggle-slider ${form.autoBanEnabled !== false ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, autoBanEnabled: !(form.autoBanEnabled !== false) })} />
            <span className="text-sm font-semibold text-foreground">เปิดใช้งานระบบแบนอัตโนมัติ</span>
          </label>
        </div>

        {form.autoBanEnabled !== false && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">จำนวนครั้งสูงสุด (ก่อนถูกแบน)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.autoBanMaxAttempts ?? 3}
                  onChange={e => setForm({ ...form, autoBanMaxAttempts: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="input-glass w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-1">เมื่อตรวจพบความพยายามผิดพลาดถึงจำนวนนี้ ระบบจะแบนทันที</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">หน้าต่างเวลานับ (ชั่วโมง)</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form.autoBanWindowHours ?? 24}
                  onChange={e => setForm({ ...form, autoBanWindowHours: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="input-glass w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-1">นับเฉพาะความพยายามภายในกี่ชั่วโมงล่าสุด</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">ประเภทความผิดพลาดที่จะนับ</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/10 border border-border/40 cursor-pointer">
                  <div className={`toggle-slider ${form.autoBanIncludeWrongAccount !== false ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, autoBanIncludeWrongAccount: !(form.autoBanIncludeWrongAccount !== false) })} />
                  <span className="text-xs text-foreground">สลิปบัญชีปลายทางผิด</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/10 border border-border/40 cursor-pointer">
                  <div className={`toggle-slider ${form.autoBanIncludeDuplicate !== false ? "toggle-active" : ""}`} onClick={() => setForm({ ...form, autoBanIncludeDuplicate: !(form.autoBanIncludeDuplicate !== false) })} />
                  <span className="text-xs text-foreground">สลิปซ้ำ (เคยใช้แล้ว)</span>
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
              <p className="text-xs text-foreground flex items-start gap-2">
                <AlertTriangle size={14} className="text-destructive shrink-0 mt-0.5" />
                <span>ตัวอย่าง: หากผู้ใช้ส่งสลิปผิดพลาด <strong>{form.autoBanMaxAttempts ?? 3}</strong> ครั้ง ภายใน <strong>{form.autoBanWindowHours ?? 24}</strong> ชั่วโมง จะถูกแบนอัตโนมัติทันที</span>
              </p>
            </div>
          </>
        )}
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกการตั้งค่าเติมเงิน</button>
    </div>
  );
};

export default AdminTopUpTab;
