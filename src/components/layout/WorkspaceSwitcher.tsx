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
import { Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

export const WorkspaceSwitcher: React.FC = () => {
  const { activeWorkspace, workspaces, setActiveWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
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
    <div className="relative w-full px-3 py-2" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-slate-50/70 p-2 text-left transition-colors hover:bg-slate-100 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs font-semibold text-xs">
            {isPersonal ? (
              <User className="h-3.5 w-3.5 text-slate-600" />
            ) : (
              <Building2 className="h-3.5 w-3.5 text-blue-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900 leading-tight">
              {activeWorkspace.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 capitalize leading-tight">
              {isPersonal ? "Personal" : "Organization"} · {activeWorkspace.role}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Switcher Dropdown Menu */}
      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1.5 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-elevated animate-in fade-in-50 zoom-in-95">
          {/* Personal Workspace Section */}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{ws.name}</span>
              </div>
              {activeWorkspace.id === ws.id && (
                <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              )}
            </button>
          ))}

          {/* Organizations Section */}
          {orgWorkspaces.length > 0 && (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-left transition-colors"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="truncate font-medium">{ws.name}</span>
                    {ws.memberCount !== undefined && (
                      <span className="text-[10px] text-slate-400">
                        ({ws.memberCount})
                      </span>
                    )}
                  </div>
                  {activeWorkspace.id === ws.id && (
                    <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  )}
                </button>
              ))}
            </>
          )}

          <div className="my-1 h-px bg-slate-100" />

          {/* Workspace Management Actions */}
          <Link
            href="/workspaces/create"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-slate-500" />
            <span>Create Organization</span>
          </Link>

          <Link
            href={`/workspaces/${activeWorkspace.slug}/settings`}
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-slate-500" />
            <span>Workspace Settings</span>
          </Link>

          <Link
            href="/workspaces"
            prefetch={false}
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Grid className="h-3.5 w-3.5 text-slate-500" />
            <span>Manage All Workspaces</span>
          </Link>
        </div>
      )}
    </div>
  );
};
