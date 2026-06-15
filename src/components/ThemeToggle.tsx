import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useRef, useEffect } from "react";

const options = [
  { value: "light" as const, label: "สว่าง", icon: Sun },
  { value: "dark" as const, label: "มืด", icon: Moon },
  { value: "system" as const, label: "ระบบ", icon: Monitor },
];

const ThemeToggle = () => {
  const { mode, setMode, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const CurrentIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-glass p-2.5 rounded-xl transition-all duration-300"
        title="เปลี่ยนธีม"
      >
        <CurrentIcon size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 glass-card !p-1.5 min-w-[140px] z-50 shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setMode(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                mode === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <opt.icon size={14} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
