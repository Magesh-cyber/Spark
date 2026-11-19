"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  Hash,
  Mail,
  UserPlus,
  CheckSquare,
  Clock,
  Video,
  Calendar,
  Info,
  X,
  ExternalLink,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { deleteNotification as deleteNotificationServer } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import type { NotificationType } from "@/lib/types";

function formatRelativeTime(dateString: string): string {
  try {
    const timestamp = new Date(dateString).getTime();
    if (isNaN(timestamp)) return dateString;
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export const NotificationMenu: React.FC = () => {
  const {
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  } = useWorkspace();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  // Refresh notifications when menu opens
  useEffect(() => {
    if (open) {
      refreshNotifications();
    }
  }, [open, refreshNotifications]);

  const renderIcon = (type: NotificationType) => {
    switch (type) {
      case "CHAT_DM":
      case "mention":
        return <MessageSquare className="h-3.5 w-3.5 text-[var(--spark-accent)]" />;
      case "CHAT_CHANNEL":
        return <Hash className="h-3.5 w-3.5 text-[var(--spark-accent)]" />;
      case "WORKSPACE_INVITATION":
        return <Mail className="h-3.5 w-3.5 text-[#8B5CF6]" />;
      case "MEMBER_JOINED":
        return <UserPlus className="h-3.5 w-3.5 text-[#10B981]" />;
      case "TASK_ASSIGNED":
      case "task":
        return <CheckSquare className="h-3.5 w-3.5 text-[#F59E0B]" />;
      case "TASK_DEADLINE":
        return <Clock className="h-3.5 w-3.5 text-[#EF4444]" />;
      case "MEETING_SCHEDULED":
      case "meeting":
        return <Video className="h-3.5 w-3.5 text-[var(--spark-accent)]" />;
      case "CALENDAR_EVENT":
        return <Calendar className="h-3.5 w-3.5 text-[var(--spark-accent)]" />;
      case "SYSTEM":
      case "system":
      default:
        return <Info className="h-3.5 w-3.5 text-[var(--spark-text-muted)]" />;
    }
  };

  const handleNotificationClick = (notif: (typeof notifications)[0]) => {
    if (!notif.read) {
      markNotificationAsRead(notif.id);
    }
    if (notif.link) {
      setOpen(false);
      router.push(notif.link);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markNotificationAsRead(id);
    await deleteNotificationServer(id);
    refreshNotifications();
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
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--spark-accent)] px-1 text-[10px] font-bold text-white shadow-xs animate-in zoom-in-50">
            {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-[14px] border spark-glass p-0 text-[var(--spark-text-primary)] shadow-elevated animate-in fade-in-50 zoom-in-95 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--spark-border)] px-4 py-3 bg-[var(--spark-surface-subtle)]/60">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--spark-text-primary)]">
                Notifications
              </span>
              {unreadNotificationCount > 0 && (
                <span className="rounded-full bg-[var(--spark-highlight)] px-2 py-0.5 text-[10px] font-semibold text-[var(--spark-highlight-text)]">
                  {unreadNotificationCount} new
                </span>
              )}
            </div>
            {unreadNotificationCount > 0 && (
              <button
                type="button"
                onClick={markAllNotificationsAsRead}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] transition-colors duration-150"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--spark-border)] bg-[var(--spark-surface)]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--spark-text-secondary)]">
                <Bell className="h-6 w-6 mx-auto mb-2 text-[var(--spark-text-muted)] opacity-50" />
                <p className="font-medium text-[var(--spark-text-primary)]">No notifications</p>
                <p className="text-[11px] text-[var(--spark-text-muted)] mt-1">
                  You are all caught up across your workspaces.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "group flex items-start gap-3 p-3.5 transition-colors duration-150 cursor-pointer hover:bg-[var(--spark-surface-subtle)] relative",
                    !notif.read && "bg-[var(--spark-highlight)]/30"
                  )}
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--spark-surface-subtle)] border border-[var(--spark-border)]">
                    {renderIcon(notif.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn(
                        "truncate text-xs text-[var(--spark-text-primary)]",
                        !notif.read ? "font-semibold" : "font-medium"
                      )}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-[var(--spark-text-muted)] whitespace-nowrap">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--spark-text-secondary)] line-clamp-2 leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--spark-accent)] group-hover:underline">
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    {!notif.read && (
                      <span className="h-2 w-2 rounded-full bg-[var(--spark-accent)]" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--spark-surface)] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] transition-opacity"
                      aria-label="Dismiss notification"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
