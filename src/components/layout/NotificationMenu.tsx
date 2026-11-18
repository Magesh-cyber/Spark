"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCheck, MessageSquare, CheckSquare, Video, Info } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";

export const NotificationMenu: React.FC = () => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useWorkspace();
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

  const typeIconMap = {
    mention: <MessageSquare className="h-3.5 w-3.5 text-[var(--spark-accent)]" />,
    task: <CheckSquare className="h-3.5 w-3.5 text-[#10B981]" />,
    meeting: <Video className="h-3.5 w-3.5 text-[var(--spark-accent)]" />,
    system: <Info className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />,
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-highlight)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--spark-accent)] px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-[14px] border spark-glass p-0 text-[var(--spark-text-primary)] shadow-elevated animate-in fade-in-50 zoom-in-95 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--spark-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                Notifications
              </span>
              {unreadNotificationCount > 0 && (
                <span className="rounded-full bg-[var(--spark-highlight)] px-2 py-0.5 text-[10px] font-medium text-[var(--spark-highlight-text)]">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] transition-colors duration-150"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--spark-border)]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--spark-text-secondary)]">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markNotificationAsRead(notif.id)}
                  className={cn(
                    "flex items-start gap-3 p-3.5 transition-colors duration-150 cursor-pointer hover:bg-[var(--spark-surface-subtle)]",
                    !notif.read && "bg-[var(--spark-highlight)]/35"
                  )}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--spark-surface-subtle)] border border-[var(--spark-border)]">
                    {typeIconMap[notif.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-[var(--spark-text-primary)]">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-[var(--spark-text-muted)] whitespace-nowrap">
                        {notif.timestamp}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--spark-text-secondary)] line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => setOpen(false)}
                        className="mt-1.5 inline-block text-[11px] font-medium text-[var(--spark-accent)] hover:underline"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                  {!notif.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--spark-accent)] mt-1" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
