import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--spark-text-secondary)] select-none"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          disabled={disabled}
          className={cn(
            "flex min-h-[80px] w-full rounded-[6px] border bg-[var(--spark-surface)] px-3 py-2 text-sm text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--spark-canvas)] disabled:cursor-not-allowed disabled:bg-[var(--spark-surface-subtle)] disabled:text-[var(--spark-text-muted)] disabled:border-[var(--spark-border)]",
            error
              ? "border-rose-500 focus-visible:ring-rose-500"
              : "border-[var(--spark-border)] hover:border-[var(--spark-border-strong)]",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-normal">{error}</p>}
        {!error && hint && (
          <p className="text-xs text-[var(--spark-text-muted)] font-normal">{hint}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
