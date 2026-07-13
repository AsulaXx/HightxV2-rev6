import { useState, ReactNode, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface AdminSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Extra content next to title (e.g. toggle, button) */
  headerRight?: ReactNode;
  /** Description under title */
  description?: string;
  className?: string;
}

const AdminSection = forwardRef<HTMLDivElement, AdminSectionProps>(({
  title,
  icon,
  children,
  defaultOpen = false,
  headerRight,
  description,
  className = "",
}, ref) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div ref={ref} className={`glass-card !p-0 overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <div className="text-left min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate">{title}</h3>
            {description && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerRight && <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground"
          >
            <ChevronDown size={16} />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-5 border-t border-border/20 pt-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

AdminSection.displayName = "AdminSection";

export default AdminSection;
