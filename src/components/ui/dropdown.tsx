import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownContext = React.createContext<DropdownContextValue | undefined>(undefined);

export function Dropdown({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error("DropdownTrigger must be used within Dropdown");

  return (
    <div
      onClick={() => context.setOpen(!context.open)}
      className={cn("cursor-pointer", className)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          context.setOpen(!context.open);
        }
      }}
    >
      {children}
    </div>
  );
}

/* Glassmorphism Overlay strictly for floating dropdown menus */
export function DropdownContent({
  children,
  align = "right",
  className,
  width = "w-56",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  width?: string;
}) {
  const context = React.useContext(DropdownContext);
  if (!context || !context.open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1.5 rounded-[12px] border spark-glass p-1.5 text-[var(--spark-text-primary)] shadow-elevated focus:outline-none animate-in fade-in-50 zoom-in-95",
        width,
        align === "right" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  destructive = false,
  disabled = false,
  icon,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const context = React.useContext(DropdownContext);

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    context?.setOpen(false);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 text-left",
        destructive
          ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
          : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)]",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {icon && <span className="h-4 w-4 shrink-0 text-[var(--spark-text-muted)]">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[var(--spark-border)]" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
      {children}
    </div>
  );
}
