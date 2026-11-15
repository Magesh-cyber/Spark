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
    mention: <MessageSquare className="h-3.5 w-3.5 text-blue-600" />,
    task: <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />,
    meeting: <Video className="h-3.5 w-3.5 text-violet-600" />,
    system: <Info className="h-3.5 w-3.5 text-slate-500" />,
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs">
            {unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-elevated animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">Notifications</span>
              {unreadNotificationCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markNotificationAsRead(notif.id)}
                  className={cn(
                    "flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-slate-50",
                    !notif.read && "bg-blue-50/40"
                  )}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    {typeIconMap[notif.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {notif.timestamp}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => setOpen(false)}
                        className="mt-1.5 inline-block text-[11px] font-medium text-blue-600 hover:underline"
                      >
                        View details →
                      </Link>
                    )}
                  </div>
                  {!notif.read && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600 mt-1" />
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

