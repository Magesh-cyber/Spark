import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  hint?: string;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  label,
  hint,
  className,
}) => {
  const generatedId =
    id || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <button
        id={generatedId}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--spark-canvas)] disabled:cursor-not-allowed disabled:opacity-50 mt-0.5",
          checked
            ? "border-[var(--spark-accent)] bg-[var(--spark-accent)] text-white"
            : "border-[var(--spark-border-strong)] bg-[var(--spark-surface)] hover:border-[var(--spark-accent)]"
        )}
      >
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </button>
      {(label || hint) && (
        <div className="flex flex-col select-none">
          {label && (
            <label
              htmlFor={generatedId}
              className="text-xs font-medium text-[var(--spark-text-primary)] cursor-pointer"
            >
              {label}
            </label>
          )}
          {hint && (
            <span className="text-[11px] text-[var(--spark-text-secondary)] font-normal">
              {hint}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
