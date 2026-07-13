import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { TENANT_BRAND } from "@/lib/tenantConfig";
import { Shield, FileText, ExternalLink, Zap } from "lucide-react";
import logo from "@/assets/logo.png";

/**
 * FooterV2 — Tactical footer: 3 cols on desktop, brand + links + socials.
 * Dark violet, top border neon violet, no glass.
 */
const FooterV2 = () => {
  const { settings } = useSiteSettings();
  const socials = settings.socialLinks || [];

  return (
    <footer className="v2-footer relative z-10 mt-auto">
      {/* Top neon line */}
      <div className="v2-footer-topline" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-[10px] overflow-hidden v2-footer-logo">
                <img src={settings.logoUrl || logo} alt={settings.brandName} className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-base" style={{ color: "hsl(272 95% 78%)", fontFamily: "'Kanit', 'Prompt', sans-serif" }}>
                {settings.brandName}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "hsl(270 15% 62%)" }}>
              {settings.footerText}
            </p>
          </div>

          {/* Legal links */}
          <div>
            <div className="v2-footer-heading">
              <Shield size={11} /> ข้อกำหนด
            </div>
            <div className="space-y-1.5">
              <Link to="/terms" className="v2-footer-link">
                <FileText size={11} /> ข้อตกลงการใช้งาน
              </Link>
              <Link to="/terms?tab=privacy" className="v2-footer-link">
                <Shield size={11} /> นโยบายความเป็นส่วนตัว
              </Link>
              <Link to="/status" className="v2-footer-link">
                <Zap size={11} /> สถานะระบบ
              </Link>
            </div>
          </div>

          {/* Social links */}
          <div>
            <div className="v2-footer-heading">
              <ExternalLink size={11} /> ช่องทางติดต่อ
            </div>
            {socials.length === 0 ? (
              <p className="text-[11px]" style={{ color: "hsl(270 12% 50%)" }}>ยังไม่มีช่องทาง</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {socials.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v2-footer-social"
                    title={link.label}
                  >
                    {link.iconUrl ? (
                      <img src={link.iconUrl} alt={link.label} className="w-3.5 h-3.5 object-contain rounded-sm" />
                    ) : (
                      <ExternalLink size={11} />
                    )}
                    <span>{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="v2-footer-bottom flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
          <p className="text-[10px]" style={{ color: "hsl(270 12% 50%)" }}>
            © {new Date().getFullYear()} {settings.brandName}. All rights reserved.
          </p>
          {TENANT_BRAND.developerName && (
            <p className="text-[10px]" style={{ color: "hsl(270 12% 45%)" }}>
              Powered by{" "}
              {TENANT_BRAND.developerUrl ? (
                <a
                  href={TENANT_BRAND.developerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold"
                  style={{ color: "hsl(272 90% 68%)" }}
                >
                  {TENANT_BRAND.developerName}
                </a>
              ) : (
                <span className="font-semibold" style={{ color: "hsl(272 90% 68%)" }}>
                  {TENANT_BRAND.developerName}
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
};

export default FooterV2;
