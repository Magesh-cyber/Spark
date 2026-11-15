"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Settings, LogOut, ChevronUp } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const UserMenu: React.FC = () => {
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
    <div className="relative w-full p-3 border-t border-slate-200/80" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar
            name={currentUser.name}
            src={currentUser.avatarUrl}
            size="sm"
            status="online"
          />
          <div className="min-w-0 text-left">
            <p className="truncate text-xs font-semibold text-slate-900 leading-tight">
              {currentUser.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 leading-tight">
              {currentUser.email || "Authenticated Account"}
            </p>
          </div>
        </div>
        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-200",
            !open && "rotate-180"
          )}
        />
      </button>

      {/* User Popover Menu */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 z-50 mb-1.5 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-elevated animate-in fade-in-50 zoom-in-95">
          <div className="px-2.5 py-2 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-900">{currentUser.name}</p>
            <p className="text-[11px] text-slate-500">{currentUser.email}</p>
            <div className="mt-1 inline-flex items-center rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {currentUser.role}
            </div>
          </div>

          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span>Profile & Account</span>
            </Link>
            <Link
              href={activeWorkspace.slug ? `/workspaces/${activeWorkspace.slug}/settings` : "/settings"}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              <span>Workspace Settings</span>
            </Link>
          </div>

          <div className="h-px bg-slate-100 my-1" />

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 text-left"
          >
            <LogOut className="h-3.5 w-3.5 text-red-500" />
            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
};
