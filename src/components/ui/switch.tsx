import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  className,
}) => {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--spark-canvas)] disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-[var(--spark-accent)]" : "bg-[var(--spark-border-strong)]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-150 ease-in-out",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col select-none">
          {label && (
            <span
              onClick={() => !disabled && onCheckedChange(!checked)}
              className="text-xs font-medium text-[var(--spark-text-primary)] cursor-pointer"
            >
              {label}
            </span>
          )}
          {description && (
            <span className="text-[11px] text-[var(--spark-text-secondary)] font-normal leading-tight">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
