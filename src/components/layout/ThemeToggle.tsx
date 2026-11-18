"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "rail" | "pill";
  collapsed?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = "icon",
  collapsed = false,
  className,
}) => {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = mounted ? theme === "dark" : false;

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className={cn(
          "group flex w-full items-center rounded-[8px] px-2.5 py-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-highlight)]/60 hover:text-[var(--spark-text-primary)] transition-colors duration-150 select-none",
          collapsed ? "justify-center px-0" : "justify-between",
          className
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isDark ? (
            <Sun className="h-4 w-4 shrink-0 text-amber-400 transition-transform duration-150 group-hover:rotate-12" />
          ) : (
            <Moon className="h-4 w-4 shrink-0 text-[var(--spark-accent)] transition-transform duration-150 group-hover:-rotate-12" />
          )}
          {!collapsed && (
            <span className="truncate">{isDark ? "Light Mode" : "Dark Mode"}</span>
          )}
        </div>
        {!collapsed && (
          <span className="inline-flex h-4 w-7 items-center rounded-full bg-[var(--spark-border)] p-0.5 transition-colors">
            <span
              className={cn(
                "h-3 w-3 rounded-full transition-transform duration-150",
                isDark
                  ? "translate-x-3 bg-[var(--spark-accent)]"
                  : "translate-x-0 bg-[var(--spark-surface)] shadow-2xs"
              )}
            />
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      className={cn(
        "relative inline-flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-highlight)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]",
        className
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-150" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--spark-accent)] transition-transform duration-150" />
      )}
    </button>
  );
};
