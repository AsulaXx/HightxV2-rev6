import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Pencil, Check, GripVertical } from "lucide-react";
import { ReactNode, useState, useRef, useEffect } from "react";

interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Additional header content (right side) */
  headerRight?: ReactNode;
  /** Wrap children in glass-card */
  glass?: boolean;
  className?: string;
  /** Enable title editing */
  onTitleChange?: (newTitle: string) => void;
  /** Show drag handle */
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragOver?: boolean;
}

const CollapsibleSection = ({
  title,
  icon,
  isOpen,
  onToggle,
  children,
  headerRight,
  glass = false,
  className = "",
  onTitleChange,
  draggable: isDraggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver = false,
}: CollapsibleSectionProps) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSaveTitle = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setEditValue(title);
    }
    setEditing(false);
  };

  return (
    <div
      className={`${glass ? "glass-card overflow-hidden" : ""} ${className} ${isDragOver ? "ring-2 ring-primary/50 rounded-2xl" : ""} transition-all`}
      draggable={isDraggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isDraggable && (
            <GripVertical
              size={16}
              className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
              onMouseDown={(e) => e.stopPropagation()}
            />
          )}
          {editing ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") { setEditValue(title); setEditing(false); }
                }}
                onBlur={handleSaveTitle}
                className="input-glass px-3 py-1 text-lg font-bold w-48 md:w-64"
              />
              <button onClick={handleSaveTitle} className="text-primary hover:text-primary/80">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <h2 className="font-heading text-lg md:text-2xl font-bold text-foreground flex items-center gap-2 min-w-0">
              {icon} <span className="truncate">{title}</span>
              {onTitleChange && (
                <Pencil
                  size={14}
                  className="text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditValue(title);
                    setEditing(true);
                  }}
                />
              )}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerRight}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-muted-foreground group-hover:text-foreground transition-colors"
          >
            <ChevronDown size={18} />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleSection;
