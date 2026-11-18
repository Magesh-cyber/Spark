import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

/* Selective Claymorphism: tactile 3D icon medallion inside clean minimalist frame */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex min-h-[240px] flex-col items-center justify-center rounded-[12px] border border-dashed border-[var(--spark-border-strong)] bg-[var(--spark-canvas)]/60 p-8 text-center transition-colors duration-150",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] spark-clay-icon text-[var(--spark-accent)] transition-transform duration-150 hover:scale-[1.03]">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-[var(--spark-text-primary)] tracking-tight">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-[var(--spark-text-secondary)] font-normal leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex items-center gap-2.5">
          {actionLabel && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && (
            <Button variant="outline" size="sm" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
