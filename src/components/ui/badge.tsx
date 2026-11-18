import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[6px] px-2 py-0.5 text-xs font-medium transition-colors duration-150 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)] border border-[var(--spark-border)]",
        secondary:
          "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] border border-transparent",
        outline:
          "border border-[var(--spark-border-strong)] text-[var(--spark-text-secondary)] bg-transparent",
        success:
          "bg-[#10B981]/12 text-emerald-700 dark:text-emerald-300 border border-[#10B981]/25",
        warning:
          "bg-[#F59E0B]/12 text-amber-700 dark:text-amber-300 border border-[#F59E0B]/25",
        error:
          "bg-rose-500/12 text-rose-700 dark:text-rose-300 border border-rose-500/25",
        info:
          "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] border border-[var(--spark-accent)]/25",
        violet:
          "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] border border-[var(--spark-accent)]/30",
      },
      size: {
        sm: "text-[11px] px-1.5 py-0.5 leading-none",
        md: "text-xs px-2 py-0.5",
        lg: "text-xs px-2.5 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  const dotColorMap = {
    default: "bg-[var(--spark-text-muted)]",
    secondary: "bg-[var(--spark-accent)]",
    outline: "bg-[var(--spark-text-muted)]",
    success: "bg-[#10B981]",
    warning: "bg-[#F59E0B]",
    error: "bg-rose-500",
    info: "bg-[var(--spark-accent)]",
    violet: "bg-[var(--spark-accent)]",
  };

  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "mr-1.5 h-1.5 w-1.5 rounded-full shrink-0",
            variant ? dotColorMap[variant] : dotColorMap.default
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
