import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, leftIcon, rightIcon, id, disabled, ...props }, ref) => {
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
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-[var(--spark-text-muted)]">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full rounded-[6px] border bg-[var(--spark-surface)] px-3 py-1.5 text-sm text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--spark-canvas)] disabled:cursor-not-allowed disabled:bg-[var(--spark-surface-subtle)] disabled:text-[var(--spark-text-muted)] disabled:border-[var(--spark-border)]",
              error
                ? "border-rose-500 focus-visible:ring-rose-500"
                : "border-[var(--spark-border)] hover:border-[var(--spark-border-strong)]",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-[var(--spark-text-muted)]">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 font-normal">{error}</p>}
        {!error && hint && (
          <p className="text-xs text-[var(--spark-text-muted)] font-normal">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
