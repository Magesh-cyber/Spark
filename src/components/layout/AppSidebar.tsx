"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { UserMenu } from "./UserMenu";
import { useWorkspace } from "@/lib/workspace-context";
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

export const AppSidebar: React.FC<AppSidebarProps> = ({ className, isMobile }) => {
  const pathname = usePathname();
  const { activeWorkspace, sidebarOpen, setSidebarOpen } = useWorkspace();

  const isPersonal =
    activeWorkspace.type === "personal" || activeWorkspace.type === "PERSONAL";

  // Navigation schema strictly honoring Section 7
  const personalNavItems: NavItem[] = [
    { title: "Home", href: "/", icon: LayoutDashboard },
    { title: "My Tasks", href: "/tasks", icon: CheckSquare },
    { title: "Projects", href: "/projects", icon: FolderKanban },
    { title: "Chat", href: "/chat", icon: MessageSquare },
    { title: "Meet", href: "/meet", icon: Video },
    { title: "AI Assistant", href: "/ai", icon: Bot },
    { title: "Docs", href: "/docs", icon: FileText },
    { title: "Settings", href: "/settings", icon: Settings },
  ];

  const orgNavItems: NavItem[] = [
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

  const navItems = isPersonal ? personalNavItems : orgNavItems;

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
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href + item.title}
                href={item.href}
                onClick={() => {
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
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span className="truncate">{item.title}</span>
                </div>

                {item.badge && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-medium leading-none",
                      isActive
                        ? "bg-blue-200/60 text-blue-800"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    )}
                  >
                    {item.badge}
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

