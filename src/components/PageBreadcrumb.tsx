import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ArrowLeft, Home } from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: LucideIcon;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}

const PageBreadcrumb = ({ items, title, subtitle, icon: Icon }: PageBreadcrumbProps) => {
  const navigate = useNavigate();

  const allItems: BreadcrumbItem[] = [
    { label: "หน้าหลัก", path: "/", icon: Home },
    ...items,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <button
          onClick={() => navigate(-1)}
          className="w-7 h-7 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center hover:bg-primary/10 hover:border-primary/20 transition-all duration-300 shrink-0 mr-1"
        >
          <ArrowLeft size={13} className="text-primary" />
        </button>
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={11} className="text-muted-foreground/30" />}
            {item.path ? (
              <Link
                to={item.path}
                className="text-[11px] font-medium text-muted-foreground/60 hover:text-primary transition-colors duration-200 flex items-center gap-1"
              >
                {item.icon && <item.icon size={11} />}
                {item.label}
              </Link>
            ) : (
              <span className="text-[11px] font-medium text-foreground/80 flex items-center gap-1">
                {item.icon && <item.icon size={11} />}
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Page title */}
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center shrink-0">
            <Icon size={18} className="text-primary" />
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground/60 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
};

export default PageBreadcrumb;
