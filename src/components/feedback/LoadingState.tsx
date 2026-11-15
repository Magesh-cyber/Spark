import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  type?: "table" | "cards" | "detail" | "board";
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = "table",
  count = 4,
  className,
}) => {
  if (type === "cards") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-slate-200 bg-white p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <div className="pt-2 flex items-center justify-between">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "board") {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-slate-100/70 p-3 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-6 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-[8px]" />
            <Skeleton className="h-20 w-full rounded-[8px]" />
            <Skeleton className="h-20 w-full rounded-[8px]" />
          </div>
        ))}
      </div>
    );
  }

  // Default: Table skeleton
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 space-y-3", className)}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-[8px]" />
          <Skeleton className="h-8 w-24 rounded-[8px]" />
        </div>
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-6 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

