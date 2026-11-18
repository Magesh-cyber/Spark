"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Settings, LogOut, ChevronUp } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  compact?: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ compact = false }) => {
  const { currentUser, signOut, activeWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setOpen(false);
    await signOut();
  };

  return (
    <div
      className={cn(
        "relative w-full border-t border-[var(--spark-border)]",
        compact ? "p-2" : "p-3"
      )}
      ref={containerRef}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={compact ? currentUser.name : undefined}
        className={cn(
          "flex w-full items-center rounded-[8px] p-1.5 transition-colors duration-150 hover:bg-[var(--spark-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]",
          compact ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            name={currentUser.name}
            src={currentUser.avatarUrl}
            size="sm"
            status="online"
          />
          {!compact && (
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-semibold text-[var(--spark-text-primary)] leading-tight">
                {currentUser.name}
              </p>
              <p className="truncate text-[11px] text-[var(--spark-text-secondary)] leading-tight mt-0.5">
                {currentUser.email || "Authenticated Account"}
              </p>
            </div>
          )}
        </div>
        {!compact && (
          <ChevronUp
            className={cn(
              "h-3.5 w-3.5 text-[var(--spark-text-muted)] transition-transform duration-150 shrink-0",
              !open && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Glassmorphic User Popover Menu */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full z-50 mb-1.5 rounded-[12px] border spark-glass p-1.5 text-[var(--spark-text-primary)] shadow-elevated animate-in fade-in-50 zoom-in-95",
            compact ? "left-2 w-56" : "left-3 right-3"
          )}
        >
          <div className="px-2.5 py-2 border-b border-[var(--spark-border)]">
            <p className="text-xs font-semibold text-[var(--spark-text-primary)] truncate">
              {currentUser.name}
            </p>
            <p className="text-[11px] text-[var(--spark-text-secondary)] truncate">
              {currentUser.email}
            </p>
            <div className="mt-1.5 inline-flex items-center rounded-[4px] bg-[var(--spark-highlight)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--spark-highlight-text)]">
              {currentUser.role}
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              prefetch={false}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
            >
              <User className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
              <span>Profile & Account</span>
            </Link>
            <Link
              href={
                activeWorkspace.slug
                  ? `/workspaces/${activeWorkspace.slug}/settings`
                  : "/settings"
              }
              prefetch={false}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
            >
              <Settings className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
              <span>Workspace Settings</span>
            </Link>
          </div>

          <div className="h-px bg-[var(--spark-border)] my-1" />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors duration-150 disabled:opacity-50 text-left"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
};
