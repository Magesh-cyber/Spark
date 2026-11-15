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
    { title: "Docs & Knowledge Base", category: "Docs", href: "/docs", icon: FileText },
    { title: "Video Meeting Rooms", category: "Meetings", href: "/meet", icon: Video },
    { title: "Team Channels & Chat", category: "Chat", href: "/chat", icon: MessageSquare },
    { title: "People & Teams Directory", category: "People", href: "/teams", icon: MessageSquare },
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
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={() => setSearchModalOpen(false)}
      />

      {/* Modal Dialog */}
      <div className="relative z-50 w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-modal overflow-hidden animate-in fade-in-50 zoom-in-95">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search projects, tasks, or docs..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredLinks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Navigation & Commands
              </div>
              {filteredLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleSelect(item.href)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-blue-600 transition-colors">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-normal text-slate-400">
                        {item.category}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] shadow-2xs">↑</kbd>
              <kbd className="ml-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] shadow-2xs">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] shadow-2xs">↵</kbd> to select
            </span>
          </div>
          <span>SPARK Search</span>
        </div>
      </div>
    </div>
  );
};

