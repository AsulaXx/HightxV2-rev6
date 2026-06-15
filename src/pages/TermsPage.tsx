import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, FileText, Globe } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import PageBreadcrumb from "@/components/PageBreadcrumb";

type Tab = "tos" | "privacy";

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

const TermsPage = () => {
  const { settings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) || "tos");
  const [lang, setLang] = useState<"th" | "en">("th");

  const brandName = settings.brandName || "HightXClient";

  const getTosContent = () => {
    if (lang === "en") return settings.tosContentEn || defaultTosContentEn;
    return settings.tosContent || defaultTosContentTh;
  };

  const getPrivacyContent = () => {
    if (lang === "en") return settings.privacyContentEn || defaultPrivacyContentEn;
    return settings.privacyContent || defaultPrivacyContentTh;
  };

  return (
    <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <PageBreadcrumb
        items={[{ label: "หน้าแรก", path: "/" }, { label: tab === "tos" ? "ข้อตกลงการใช้บริการ" : "นโยบายความเป็นส่วนตัว" }]}
        title={tab === "tos" ? "ข้อตกลงการใช้บริการ" : "นโยบายความเป็นส่วนตัว"}
        subtitle=""
        icon={tab === "tos" ? FileText : Shield}
      />

      {/* Tab + Language Selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("tos")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              tab === "tos"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass-card hover:bg-muted/30 text-muted-foreground"
            }`}
          >
            <FileText size={14} />
            TOS
          </button>
          <button
            onClick={() => setTab("privacy")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
              tab === "privacy"
                ? "bg-primary text-primary-foreground shadow-md"
                : "glass-card hover:bg-muted/30 text-muted-foreground"
            }`}
          >
            <Shield size={14} />
            Privacy
          </button>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setLang("th")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              lang === "th" ? "bg-primary/15 text-primary border border-primary/20" : "bg-muted/20 text-muted-foreground border border-border/20"
            }`}
          >
            🇹🇭 ไทย
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              lang === "en" ? "bg-primary/15 text-primary border border-primary/20" : "bg-muted/20 text-muted-foreground border border-border/20"
            }`}
          >
            🇺🇸 EN
          </button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={`${tab}-${lang}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card !rounded-2xl p-5 sm:p-8"
      >
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {tab === "tos" ? <FileText size={18} className="text-primary" /> : <Shield size={18} className="text-primary" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {tab === "tos"
                ? (lang === "th" ? "ข้อตกลงการใช้บริการ" : "Terms of Service")
                : (lang === "th" ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy")}
            </h2>
            <p className="text-[10px] text-muted-foreground">{brandName}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none">
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground font-sans">
            {tab === "tos" ? getTosContent() : getPrivacyContent()}
          </pre>
        </div>
      </motion.div>
    </div>
  );
};

export default TermsPage;
