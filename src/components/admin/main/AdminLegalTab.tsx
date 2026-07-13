import { useState } from "react";
import { Save, FileText, Shield, Rocket, Info } from "lucide-react";
import { AdminTabProps } from "./AdminTabProps";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { toast } from "sonner";

const defaultTosContentTh = `ข้อตกลงการใช้บริการ

1. การยอมรับเงื่อนไข
เมื่อคุณเข้าใช้งานเว็บไซต์นี้ ถือว่าคุณยอมรับข้อตกลงและเงื่อนไขทั้งหมดที่ระบุไว้

2. ประเภทสินค้าและบริการ
- สินค้าทั้งหมดเป็นซอฟต์แวร์/โปรแกรมดิจิทัล (Software License Key)
- สินค้าบางรายการอาจเป็นโปรแกรมช่วยเล่น (Game Enhancement Tools)
- ผู้ซื้อยอมรับความเสี่ยงในการใช้งานด้วยตนเอง
- เราไม่รับผิดชอบต่อผลกระทบจากการใช้งานโปรแกรมในเกมหรือแพลตฟอร์มใดๆ

3. การซื้อและคืนเงิน
- สินค้าดิจิทัลไม่สามารถคืนเงินได้หลังจากรับคีย์แล้ว
- คีย์ที่ได้รับแล้วเป็นความรับผิดชอบของผู้ซื้อ
- ห้ามแชร์ ขายต่อ หรือเผยแพร่คีย์สินค้าโดยไม่ได้รับอนุญาต
- สงวนสิทธิ์เปลี่ยนแปลงราคาได้โดยไม่ต้องแจ้งล่วงหน้า

4. ระบบเครดิตและการเติมเงิน
- การเติมเงินผ่านช่องทางที่กำหนดเท่านั้น
- ยอดเครดิตที่เติมแล้วไม่สามารถถอนคืนเป็นเงินสดได้
- การทุจริตเติมเงินจะถูกระงับบัญชีทันที

5. บัญชีผู้ใช้
- ผู้ใช้ต้องรับผิดชอบต่อความปลอดภัยของบัญชีตนเอง
- ห้ามใช้บัญชีร่วมกับผู้อื่น
- สงวนสิทธิ์ในการระงับบัญชีที่ละเมิดข้อตกลงโดยไม่ต้องแจ้งล่วงหน้า

6. ข้อจำกัดความรับผิดชอบ
- เราไม่รับประกันว่าโปรแกรมจะทำงานได้ตลอดเวลา
- การอัพเดทเกม/แพลตฟอร์มอาจทำให้โปรแกรมใช้งานไม่ได้ชั่วคราว
- ระยะเวลาของคีย์นับจากวันที่เปิดใช้งาน ไม่ใช่วันที่ซื้อ

7. การเปลี่ยนแปลงข้อตกลง
เราสงวนสิทธิ์ในการแก้ไขข้อตกลงได้ตลอดเวลา การใช้บริการต่อถือว่ายอมรับข้อตกลงใหม่`;

const defaultTosContentEn = `Terms of Service

1. Acceptance of Terms
By accessing this website, you agree to all terms and conditions stated herein.

2. Products and Services
- All products are digital software / license keys
- Some products may be game enhancement tools
- Users accept all risks associated with usage
- We are not responsible for any consequences from using the software in games or platforms

3. Purchases and Refunds
- Digital products are non-refundable after key delivery
- Delivered keys are the buyer's responsibility
- Sharing, reselling, or distributing keys without permission is prohibited
- Prices are subject to change without notice

4. Credits and Top-Up
- Top-up through designated channels only
- Credits are non-withdrawable as cash
- Fraudulent top-ups will result in immediate account suspension

5. User Accounts
- Users are responsible for their own account security
- Account sharing is prohibited
- We reserve the right to suspend accounts that violate these terms

6. Limitation of Liability
- We do not guarantee software will work at all times
- Game/platform updates may temporarily disable the software
- Key duration starts from activation date, not purchase date

7. Changes to Terms
We reserve the right to modify these terms at any time. Continued use constitutes acceptance of updated terms.`;

const defaultPrivacyContentTh = `นโยบายความเป็นส่วนตัว

1. ข้อมูลที่เราเก็บรวบรวม
- อีเมลและชื่อผู้ใช้เมื่อสมัครสมาชิก
- ประวัติการซื้อและการทำธุรกรรม
- ข้อมูลการเข้าใช้งาน (IP Address, อุปกรณ์, เบราว์เซอร์)

2. การใช้ข้อมูล
- เพื่อให้บริการและปรับปรุงประสบการณ์ผู้ใช้
- เพื่อติดต่อสื่อสารเกี่ยวกับบริการ
- เพื่อป้องกันการฉ้อโกงและรักษาความปลอดภัย

3. การแบ่งปันข้อมูล
- เราไม่ขายข้อมูลส่วนบุคคลของคุณ
- อาจแบ่งปันข้อมูลกับผู้ให้บริการที่จำเป็น (เช่น ระบบชำระเงิน)

4. ความปลอดภัยของข้อมูล
- ใช้การเข้ารหัสเพื่อปกป้องข้อมูล
- จำกัดการเข้าถึงข้อมูลส่วนบุคคลเฉพาะผู้ที่จำเป็น

5. สิทธิ์ของผู้ใช้
- สามารถขอดู แก้ไข หรือลบข้อมูลส่วนบุคคลได้
- สามารถยกเลิกการรับข่าวสารได้ตลอดเวลา`;

const defaultPrivacyContentEn = `Privacy Policy

1. Information We Collect
- Email and username upon registration
- Purchase and transaction history
- Access data (IP address, device, browser)

2. Use of Information
- To provide and improve user experience
- To communicate about services
- To prevent fraud and maintain security

3. Information Sharing
- We do not sell your personal data
- We may share data with necessary service providers (e.g., payment systems)

4. Data Security
- We use encryption to protect data
- Access to personal data is restricted to authorized personnel only

5. User Rights
- You may request to view, edit, or delete your personal data
- You may opt out of communications at any time`;

const AdminLegalTab = ({ form, setForm, handleSave }: AdminTabProps) => {
  const [legalLang, setLegalLang] = useState<"th" | "en">("th");
  const { updateSettings } = useSiteSettings();

  const termsVersion = Number(form.termsVersion || 1);
  const privacyVersion = Number(form.privacyVersion || 1);

  const publishNew = (which: "terms" | "privacy" | "both") => {
    const patch: any = { legalUpdatedAt: new Date().toISOString() };
    if (which === "terms" || which === "both") patch.termsVersion = termsVersion + 1;
    if (which === "privacy" || which === "both") patch.privacyVersion = privacyVersion + 1;
    setForm({ ...form, ...patch });
    updateSettings(patch);
    toast.success(`เผยแพร่เวอร์ชันใหม่ — ผู้ใช้ทุกคนจะเห็นหน้ายอมรับข้อตกลง (${which === "both" ? "ทั้งสองไฟล์" : which === "terms" ? "TOS" : "Privacy"})`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">📜 ข้อตกลงและนโยบาย</h1>
        <p className="text-sm text-muted-foreground mt-1">แก้ไข TOS และนโยบายความเป็นส่วนตัว (ไทย/อังกฤษ)</p>
      </div>

      {/* Version banner */}
      <div className="glass-card !p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Info size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">เวอร์ชันปัจจุบัน — TOS v{termsVersion} · Privacy v{privacyVersion}</p>
            <p className="text-[10px] text-muted-foreground">เผยแพร่เวอร์ชันใหม่จะบังคับให้ผู้ใช้ทุกคน re-accept ก่อนใช้งาน</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => publishNew("terms")} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5"><Rocket size={12} /> เผยแพร่ TOS ใหม่</button>
          <button onClick={() => publishNew("privacy")} className="btn-glass px-3 py-2 text-xs flex items-center gap-1.5"><Rocket size={12} /> เผยแพร่ Privacy ใหม่</button>
          <button onClick={() => publishNew("both")} className="btn-gradient px-3 py-2 text-xs flex items-center gap-1.5"><Rocket size={12} /> เผยแพร่ทั้งสอง</button>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setLegalLang("th")} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${legalLang === "th" ? "bg-primary text-primary-foreground" : "glass-card text-muted-foreground"}`}>🇹🇭 ภาษาไทย</button>
        <button onClick={() => setLegalLang("en")} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${legalLang === "en" ? "bg-primary text-primary-foreground" : "glass-card text-muted-foreground"}`}>🇺🇸 English</button>
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><FileText size={16} /> {legalLang === "th" ? "ข้อตกลงการใช้บริการ (TOS)" : "Terms of Service (TOS)"}</h3>
        <textarea
          value={legalLang === "th" ? (form.tosContent || defaultTosContentTh) : (form.tosContentEn || defaultTosContentEn)}
          onChange={(e) => setForm({ ...form, [legalLang === "th" ? "tosContent" : "tosContentEn"]: e.target.value })}
          className="input-glass w-full px-4 py-3 text-sm min-h-[300px] resize-y font-mono leading-relaxed"
          placeholder={legalLang === "th" ? "เนื้อหาข้อตกลงการใช้บริการ..." : "Terms of Service content..."}
        />
      </div>

      <div className="glass-card space-y-4">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Shield size={16} /> {legalLang === "th" ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy"}</h3>
        <textarea
          value={legalLang === "th" ? (form.privacyContent || defaultPrivacyContentTh) : (form.privacyContentEn || defaultPrivacyContentEn)}
          onChange={(e) => setForm({ ...form, [legalLang === "th" ? "privacyContent" : "privacyContentEn"]: e.target.value })}
          className="input-glass w-full px-4 py-3 text-sm min-h-[300px] resize-y font-mono leading-relaxed"
          placeholder={legalLang === "th" ? "เนื้อหานโยบายความเป็นส่วนตัว..." : "Privacy Policy content..."}
        />
      </div>

      <button onClick={handleSave} className="btn-gradient w-full py-3.5 text-sm flex items-center justify-center gap-2"><Save size={16} /> บันทึกข้อตกลง</button>
    </div>
  );
};

export default AdminLegalTab;
