import * as React from "react";
import { Search, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  viewMode?: "list" | "board";
  onViewModeChange?: (mode: "list" | "board") => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Filter items...",
  viewMode,
  onViewModeChange,
  filters,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        <div className="w-full sm:w-72">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        {filters}
      </div>

      <div className="flex items-center gap-2">
        {onViewModeChange && viewMode && (
          <div className="flex items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "rounded-[6px] p-1.5 text-xs transition-colors duration-150",
                viewMode === "list"
                  ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-medium"
                  : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
              )}
              aria-label="List view"
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("board")}
              className={cn(
                "rounded-[6px] p-1.5 text-xs transition-colors duration-150",
                viewMode === "board"
                  ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-medium"
                  : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
              )}
              aria-label="Board view"
              title="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}
        {actions}
      </div>
    </div>
  );
};
