import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-slate-100 text-slate-800 border border-slate-200",
        secondary: "bg-slate-200 text-slate-800",
        outline: "border border-slate-300 text-slate-700 bg-transparent",
        success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border border-amber-200",
        error: "bg-red-50 text-red-700 border border-red-200",
        info: "bg-blue-50 text-blue-700 border border-blue-200",
        violet: "bg-violet-50 text-violet-700 border border-violet-200",
      },
      size: {
        sm: "text-[11px] px-1.5 py-0.2",
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
    default: "bg-slate-500",
    secondary: "bg-slate-600",
    outline: "bg-slate-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    violet: "bg-violet-500",
  };

  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "mr-1.5 h-1.5 w-1.5 rounded-full",
            variant ? dotColorMap[variant] : dotColorMap.default
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };

