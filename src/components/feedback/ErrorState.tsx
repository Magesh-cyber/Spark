import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Failed to load content",
  message = "An unexpected error occurred while communicating with the service. Please try again.",
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex min-h-[260px] flex-col items-center justify-center rounded-[10px] border border-rose-500/30 bg-rose-500/8 p-8 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-[var(--spark-text-primary)] tracking-tight">
        {title}
      </h3>
      <p className="mt-1 max-w-md text-xs text-[var(--spark-text-secondary)] font-normal leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-5">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            Retry request
          </Button>
        </div>
      )}
    </div>
  );
};
