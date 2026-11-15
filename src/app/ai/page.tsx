"use client";

import React, { useState } from "react";
import { Bot, Send, Sparkles, Shield, Info } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";

export default function AIAssistantPage() {
  const { activeWorkspace, currentUser } = useWorkspace();
  const [inputPrompt, setInputPrompt] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;
    setStatusMessage(
      "AI model API connection is pending release. Simulated responses have been disabled to preserve data integrity."
    );
    setInputPrompt("");
  };

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="SPARK AI Assistant"
          description={`Context-aware intelligence across conversations, projects, and documentation for ${activeWorkspace?.name || "your workspace"}.`}
          badge={
            <Badge variant="violet" dot size="sm">
              Workspace Grounded
            </Badge>
          }
        />

        {/* Assistant Main Canvas */}
        <div className="flex flex-col h-[calc(100vh-220px)] rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          {/* Top Context Selector Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Active Context:</span>
              <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-slate-800 font-medium">
                {activeWorkspace?.name || "Active Workspace"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Scoped to Verified User: {currentUser.name}</span>
            </div>
          </div>

          {/* Conversation Stream Canvas — Truthful State */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center">
            <div className="max-w-md space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 border border-violet-200">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Context-Aware Assistant for {activeWorkspace?.name}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                SPARK AI integrates with authorized workspace channels, team messages, and documents. Fictional conversation histories and simulated tasks have been permanently removed.
              </p>

              {statusMessage && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 flex items-start gap-2 text-left">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Composer Bar */}
          <form
            onSubmit={handleSend}
            className="border-t border-slate-200 bg-white p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask a question about ${activeWorkspace?.name || "this workspace"}...`}
              className="flex-1 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              leftIcon={<Send className="h-3.5 w-3.5" />}
              disabled={!inputPrompt.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      </div>
    </ShellLayout>
  );
}
