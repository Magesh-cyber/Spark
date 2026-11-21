"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  MessageSquare,
  Video,
  Bot,
  FileText,
  Settings,
  Calendar,
  Users,
  LineChart,
  X,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { useWorkspace } from "@/lib/workspace-context";
import { useNexconnChatOptional } from "@/components/chat/NexconnChatProvider";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  className?: string;
  isMobile?: boolean;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const PERSONAL_NAV_ITEMS: NavItem[] = [
  { title: "Home", href: "/", icon: LayoutDashboard },
  { title: "My Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "Chat", href: "/chat", icon: MessageSquare },
  { title: "Meet", href: "/meet", icon: Video },
  { title: "AI Assistant", href: "/ai", icon: Bot },
  { title: "Settings", href: "/settings", icon: Settings },
];

const ORG_NAV_ITEMS: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Chat", href: "/chat", icon: MessageSquare },
  { title: "Meetings", href: "/meet", icon: Video },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "My Tasks", href: "/tasks", icon: CheckSquare },
  { title: "Calendar", href: "/calendar", icon: Calendar },
  { title: "AI Assistant", href: "/ai", icon: Bot },
  { title: "People & Teams", href: "/teams", icon: Users },
  { title: "Insights", href: "/insights", icon: LineChart },
  { title: "Settings", href: "/settings", icon: Settings },
];

const PRIORITY_ROUTES = ["/", "/chat", "/teams", "/insights"];

export const AppSidebar: React.FC<AppSidebarProps> = ({ className, isMobile }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { activeWorkspace, sidebarOpen, setSidebarOpen } = useWorkspace();
  const chat = useNexconnChatOptional();
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const totalChatUnread = chat?.totalUnreadCount ?? 0;

  // Hydrate collapsed rail preference from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("spark_rail_collapsed");
      if (saved === "true") setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("spark_rail_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Clear optimistic active state whenever route completes navigation
  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  const isPersonal =
    activeWorkspace.type === "personal" || activeWorkspace.type === "PERSONAL";

  const navItems = isPersonal ? PERSONAL_NAV_ITEMS : ORG_NAV_ITEMS;

  // Staggered once-only background prefetch so routes load instantaneously without saturating CPU
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(
      setTimeout(() => {
        PRIORITY_ROUTES.forEach((href) => {
          if (!prefetchedRoutesRef.current.has(href)) {
            prefetchedRoutesRef.current.add(href);
            router.prefetch(href);
          }
        });
      }, 200)
    );

    timers.push(
      setTimeout(() => {
        navItems.forEach((item, idx) => {
          if (!prefetchedRoutesRef.current.has(item.href)) {
            timers.push(
              setTimeout(() => {
                if (!prefetchedRoutesRef.current.has(item.href)) {
                  prefetchedRoutesRef.current.add(item.href);
                  router.prefetch(item.href);
                }
              }, idx * 120)
            );
          }
        });
      }, 900)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [router, isPersonal, navItems]);

  const renderSidebarContent = (isCompact: boolean, mobileMode: boolean) => (
    <div className="flex h-full w-full flex-col justify-between bg-[var(--spark-surface-subtle)] text-[var(--spark-text-primary)] transition-colors duration-150">
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Top Header: Brand + Collapse / Mobile Close */}
        <div
          className={cn(
            "flex h-[58px] items-center border-b border-[var(--spark-border)] shrink-0",
            isCompact ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          <SparkLogo size="md" href="/" showWordmark={!isCompact} />

          {mobileMode ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-[6px] p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] lg:hidden transition-colors duration-150"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            !isCompact && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden lg:inline-flex rounded-[6px] p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
                title="Collapse navigation rail"
                aria-label="Collapse navigation rail"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        {/* Expand button when collapsed on desktop */}
        {!mobileMode && isCompact && (
          <div className="flex justify-center pt-2.5 px-2">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] transition-colors duration-150"
              title="Expand navigation rail"
              aria-label="Expand navigation rail"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Global Workspace Switcher */}
        <WorkspaceSwitcher compact={isCompact} />

        {/* Navigation Items List */}
        <nav className={cn("flex-1 py-2 space-y-0.5", isCompact ? "px-2" : "px-3")}>
          {!isCompact && (
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)] select-none">
              {isPersonal ? "Personal Workspace" : "Organization Workspace"}
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const targetPath = optimisticHref ?? pathname;
            const isActive =
              item.href === "/"
                ? targetPath === "/"
                : targetPath?.startsWith(item.href);
            const isNavigatingToThis = optimisticHref === item.href && pathname !== item.href;

            const dynamicBadge =
              item.href === "/chat" && totalChatUnread > 0
                ? totalChatUnread > 99
                  ? "99+"
                  : String(totalChatUnread)
                : item.badge;

            return (
              <Link
                key={item.href + item.title}
                href={item.href}
                prefetch={false}
                title={isCompact ? item.title : undefined}
                onMouseEnter={() => {
                  if (!prefetchedRoutesRef.current.has(item.href)) {
                    prefetchedRoutesRef.current.add(item.href);
                  }
                  router.prefetch(item.href);
                }}
                onClick={() => {
                  if (pathname !== item.href) {
                    setOptimisticHref(item.href);
                  }
                  if (mobileMode) setSidebarOpen(false);
                }}
                className={cn(
                  "group relative flex items-center rounded-[8px] text-xs font-medium transition-colors duration-150 select-none",
                  isCompact
                    ? "justify-center h-9 w-full px-0"
                    : "justify-between px-2.5 py-2",
                  isActive
                    ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-semibold"
                    : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)]"
                )}
              >
                <div className={cn("flex items-center truncate", !isCompact && "gap-2.5")}>
                  {isNavigatingToThis ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--spark-accent)]" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors duration-150",
                        isActive
                          ? "text-[var(--spark-accent)]"
                          : "text-[var(--spark-text-muted)] group-hover:text-[var(--spark-text-primary)]"
                      )}
                    />
                  )}
                  {!isCompact && <span className="truncate">{item.title}</span>}
                </div>

                {/* Unread Badge (expanded vs compact dot) */}
                {dynamicBadge && !isCompact && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1.5 text-[10px] font-bold leading-none",
                      item.href === "/chat" && totalChatUnread > 0
                        ? "bg-[var(--spark-accent)] text-white shadow-2xs"
                        : isActive
                        ? "bg-[var(--spark-accent)]/20 text-[var(--spark-highlight-text)]"
                        : "bg-[var(--spark-surface-subtle)] text-[var(--spark-text-secondary)]"
                    )}
                  >
                    {dynamicBadge}
                  </span>
                )}

                {dynamicBadge && isCompact && item.href === "/chat" && totalChatUnread > 0 && (
                  <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-[var(--spark-accent)] ring-2 ring-[var(--spark-surface)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Rail Controls: User Account Footer */}
      <div className="shrink-0">
        <UserMenu compact={isCompact} />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Collapsible Navigation Rail */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 border-r border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] min-h-screen sticky top-0 h-screen z-30 transition-[width] duration-150 ease-out",
          collapsed ? "w-[68px]" : "w-[244px]",
          className
        )}
      >
        {renderSidebarContent(collapsed, false)}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#110F13]/60 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[268px] max-w-[85vw] bg-[var(--spark-surface-subtle)] border-r border-[var(--spark-border)] shadow-modal animate-in slide-in-from-left duration-200">
            {renderSidebarContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
};
