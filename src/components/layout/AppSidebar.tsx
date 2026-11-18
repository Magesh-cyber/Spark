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
  { title: "Docs", href: "/docs", icon: FileText },
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
  { title: "Docs & Knowledge", href: "/docs", icon: FileText },
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
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());

  const totalChatUnread = chat?.totalUnreadCount ?? 0;

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

    // Wave 1: Primary routes immediately after paint
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

    // Wave 2: Secondary routes staggered gently during idle time
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

  const sidebarContent = (
    <div className="flex h-full w-full flex-col justify-between bg-white text-slate-800">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Top Header: Brand + Close for mobile */}
        <div className="flex h-[56px] items-center justify-between px-4 border-b border-slate-100">
          <SparkLogo size="md" href="/" />
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Global Workspace Switcher */}
        <WorkspaceSwitcher />

        {/* Navigation Items List */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 select-none">
            {isPersonal ? "Personal Workspace" : "Organization Workspace"}
          </div>

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
                  if (isMobile) setSidebarOpen(false);
                }}
                className={cn(
                  "group flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-xs font-medium transition-colors select-none",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {isNavigatingToThis ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                  ) : (
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                  )}
                  <span className="truncate">{item.title}</span>
                </div>

                {dynamicBadge && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center min-w-4 h-4 rounded-full px-1.5 text-[10px] font-bold leading-none",
                      item.href === "/chat" && totalChatUnread > 0
                        ? "bg-blue-600 text-white shadow-2xs"
                        : isActive
                        ? "bg-blue-200/60 text-blue-800"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}
                  >
                    {dynamicBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Account Footer */}
      <UserMenu />
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex w-[240px] shrink-0 border-r border-slate-200 bg-white min-h-screen sticky top-0 h-screen z-30",
          className
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[260px] max-w-[85vw] bg-white shadow-xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
