"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Plus,
  Building2,
  User,
  Settings,
  Grid,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { prefetchWorkspaceBootstrap } from "@/lib/bootstrap-client";
import { cn } from "@/lib/utils";

interface WorkspaceSwitcherProps {
  compact?: boolean;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ compact = false }) => {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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

  const personalWorkspaces = workspaces.filter(
    (w) => w.type === "personal" || w.type === "PERSONAL"
  );
  const orgWorkspaces = workspaces.filter(
    (w) => w.type === "organization" || w.type === "ORGANIZATION"
  );

  const isPersonal =
    activeWorkspace.type === "personal" || activeWorkspace.type === "PERSONAL";

  return (
    <div
      className={cn("relative w-full py-2.5", compact ? "px-2" : "px-3")}
      ref={dropdownRef}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title={compact ? `${activeWorkspace.name} (${activeWorkspace.role})` : undefined}
        className={cn(
          "flex w-full items-center rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] text-left transition-colors duration-150 hover:bg-[var(--spark-surface-subtle)] hover:border-[var(--spark-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]",
          compact ? "justify-center p-1.5" : "justify-between gap-2 p-2"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[var(--spark-highlight)] border border-[var(--spark-accent)]/20 text-[var(--spark-accent)] font-semibold text-xs">
            {isPersonal ? (
              <User className="h-3.5 w-3.5" />
            ) : (
              <Building2 className="h-3.5 w-3.5" />
            )}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[var(--spark-text-primary)] leading-tight">
                {activeWorkspace.name}
              </p>
              <p className="truncate text-[11px] text-[var(--spark-text-secondary)] capitalize leading-tight mt-0.5">
                {isPersonal ? "Personal" : "Organization"} · {activeWorkspace.role}
              </p>
            </div>
          )}
        </div>
        {!compact && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-[var(--spark-text-muted)] transition-transform duration-150 shrink-0",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Glassmorphic Switcher Dropdown Menu */}
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1.5 rounded-[12px] border spark-glass p-1.5 text-[var(--spark-text-primary)] shadow-elevated animate-in fade-in-50 zoom-in-95",
            compact ? "left-2 w-60" : "left-3 right-3"
          )}
        >
          {/* Personal Workspace Section */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
            Personal
          </div>
          {personalWorkspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onMouseEnter={() => {
                if (ws.id !== activeWorkspace.id) {
                  prefetchWorkspaceBootstrap(ws.id, { preloadOnly: true });
                }
              }}
              onClick={() => {
                setActiveWorkspace(ws);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-xs text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] text-left transition-colors duration-150"
            >
              <div className="flex items-center gap-2 truncate">
                <User className="h-3.5 w-3.5 text-[var(--spark-text-muted)] shrink-0" />
                <span className="truncate">{ws.name}</span>
              </div>
              {activeWorkspace.id === ws.id && (
                <Check className="h-3.5 w-3.5 text-[var(--spark-accent)] shrink-0" />
              )}
            </button>
          ))}

          {/* Organizations Section */}
          {orgWorkspaces.length > 0 && (
            <>
              <div className="my-1 h-px bg-[var(--spark-border)]" />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
                Organizations
              </div>
              {orgWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onMouseEnter={() => {
                    if (ws.id !== activeWorkspace.id) {
                      prefetchWorkspaceBootstrap(ws.id, { preloadOnly: true });
                    }
                  }}
                  onClick={() => {
                    setActiveWorkspace(ws);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[6px] px-2 py-1.5 text-xs text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] text-left transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-[var(--spark-accent)] shrink-0" />
                    <span className="truncate font-medium">{ws.name}</span>
                    {ws.memberCount !== undefined && (
                      <span className="text-[10px] text-[var(--spark-text-muted)]">
                        ({ws.memberCount})
                      </span>
                    )}
                  </div>
                  {activeWorkspace.id === ws.id && (
                    <Check className="h-3.5 w-3.5 text-[var(--spark-accent)] shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}

          <div className="my-1 h-px bg-[var(--spark-border)]" />

          {/* Workspace Management Actions */}
          <Link
            href="/workspaces/create"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
          >
            <Plus className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
            <span>Create Organization</span>
          </Link>

          <Link
            href={`/workspaces/${activeWorkspace.slug}/settings`}
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
          >
            <Settings className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
            <span>Workspace Settings</span>
          </Link>

          <Link
            href="/workspaces"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
          >
            <Grid className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />
            <span>Manage All Workspaces</span>
          </Link>
        </div>
      )}
    </div>
  );
};
