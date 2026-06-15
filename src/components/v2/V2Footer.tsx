import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { TENANT_BRAND } from "@/lib/tenantConfig";

const V2Footer = () => {
  const { settings } = useSiteSettings();
  return (
    <footer className="relative z-10 mt-auto border-t border-white/10 bg-[#070707]">
      <div className="max-w-[1320px] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="v2-label" style={{ color: "hsl(var(--primary))" }}>// SYS</span>
          <p className="v2-label">{settings.footerText}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/terms" className="v2-label hover:text-white transition-colors">TERMS</Link>
          <span className="text-white/15">·</span>
          <Link to="/terms?tab=privacy" className="v2-label hover:text-white transition-colors">PRIVACY</Link>
          {TENANT_BRAND.developerName && (
            <>
              <span className="text-white/15">·</span>
              <span className="v2-label">
                BUILT BY{" "}
                {TENANT_BRAND.developerUrl ? (
                  <a href={TENANT_BRAND.developerUrl} target="_blank" rel="noopener noreferrer" style={{ color: "hsl(var(--primary))" }}>
                    {TENANT_BRAND.developerName.toUpperCase()}
                  </a>
                ) : (
                  <span style={{ color: "hsl(var(--primary))" }}>{TENANT_BRAND.developerName.toUpperCase()}</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>
    </footer>
  );
};

export default V2Footer;
