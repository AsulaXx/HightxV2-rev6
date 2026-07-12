import { Link } from "react-router-dom";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { TENANT_BRAND } from "@/lib/tenantConfig";

const Footer = () => {
  const { settings } = useSiteSettings();

  return (
    <footer className="relative z-10 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="glass-panel rounded-xl flex flex-col sm:flex-row justify-between items-center gap-2 px-5 py-3">
          <p className="text-[11px] text-muted-foreground">
            {settings.footerText}
          </p>
          <div className="flex items-center gap-3">
            <Link to="/terms" className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors">
              ข้อตกลง
            </Link>
            <span className="text-muted-foreground/20">|</span>
            <Link to="/terms?tab=privacy" className="text-[10px] text-muted-foreground/50 hover:text-primary transition-colors">
              นโยบายความเป็นส่วนตัว
            </Link>
            {TENANT_BRAND.developerName && (
              <>
                <span className="text-muted-foreground/20">|</span>
                <p className="text-[10px] text-muted-foreground/40">
                  Powered by {TENANT_BRAND.developerUrl ? (
                    <a href={TENANT_BRAND.developerUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary/50 hover:text-primary transition-colors">
                      {TENANT_BRAND.developerName}
                    </a>
                  ) : (
                    <span className="font-semibold text-primary/50">{TENANT_BRAND.developerName}</span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
