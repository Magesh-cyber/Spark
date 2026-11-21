"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckSquare,
  FolderKanban,
  FileText,
  MessageSquare,
  Video,
  ArrowRight,
  Bot,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";

export const GlobalSearchModal: React.FC = () => {
  const { searchModalOpen, setSearchModalOpen } = useWorkspace();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!searchModalOpen) {
      setQuery("");
    }
  }, [searchModalOpen]);

  if (!searchModalOpen) return null;

  const quickLinks = [
    { title: "Task Board & Items", category: "Tasks", href: "/tasks", icon: CheckSquare },
    { title: "Projects & Milestones", category: "Projects", href: "/projects", icon: FolderKanban },
    { title: "Video Meeting Rooms", category: "Meetings", href: "/meet", icon: Video },
    { title: "Team Channels & Chat", category: "Chat", href: "/chat", icon: MessageSquare },
    { title: "People & Teams Directory", category: "People", href: "/teams", icon: Users },
    { title: "SPARK AI Assistant", category: "AI", href: "/ai", icon: Bot },
  ];

  const filteredLinks = query.trim()
    ? quickLinks.filter(
        (link) =>
          link.title.toLowerCase().includes(query.toLowerCase()) ||
          link.category.toLowerCase().includes(query.toLowerCase())
      )
    : quickLinks;

  const handleSelect = (href: string) => {
    setSearchModalOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D0B14]/55 backdrop-blur-sm transition-opacity"
        onClick={() => setSearchModalOpen(false)}
      />

      {/* Glassmorphic Command Palette Dialog */}
      <div className="relative z-50 w-full max-w-xl rounded-[14px] border spark-glass text-[var(--spark-text-primary)] shadow-modal overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-[var(--spark-border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--spark-accent)] mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search projects, tasks, or docs..."
            className="w-full bg-transparent text-sm text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded-[4px] border border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--spark-text-secondary)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredLinks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--spark-text-secondary)]">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
                Navigation & Commands
              </div>
              {filteredLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-xs font-medium text-[var(--spark-text-secondary)] hover:bg-[var(--spark-highlight)] hover:text-[var(--spark-highlight-text)] transition-colors duration-150 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--spark-surface-subtle)] text-[var(--spark-text-muted)] group-hover:bg-[var(--spark-surface)] group-hover:text-[var(--spark-accent)] transition-colors duration-150">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-normal text-[var(--spark-text-muted)]">
                        {item.category}
                      </span>
                      <ArrowRight className="h-3 w-3 text-[var(--spark-accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--spark-border)] bg-[var(--spark-canvas)] px-4 py-2 text-[11px] text-[var(--spark-text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded-[4px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-1 py-0.5 text-[10px]">
                ↑
              </kbd>
              <kbd className="ml-1 rounded-[4px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-1 py-0.5 text-[10px]">
                ↓
              </kbd>{" "}
              to navigate
            </span>
            <span>
              <kbd className="rounded-[4px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-1 py-0.5 text-[10px]">
                ↵
              </kbd>{" "}
              to select
            </span>
          </div>
          <span className="font-medium text-[var(--spark-accent)]">SPARK Search</span>
        </div>
      </div>
    </div>
  );
};
