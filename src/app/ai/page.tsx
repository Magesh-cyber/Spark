"use client";

import React, { useState } from "react";
import { Bot, Send, Info } from "lucide-react";
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
    setStatusMessage("SPARK AI assistant is being configured for your workspace.");
    setInputPrompt("");
  };

  return (
    <ShellLayout>
      <div className="space-y-6">
        <PageHeader
          title="SPARK AI"
          description={`Context-aware assistant for ${activeWorkspace?.name || "your workspace"}.`}
          badge={
            <Badge variant="violet" dot size="sm">
              Assistant
            </Badge>
          }
        />

        <div className="flex flex-col h-[calc(100vh-220px)] rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] overflow-hidden transition-colors duration-150">
          <div className="flex items-center justify-between border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/60 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--spark-text-secondary)]">Workspace:</span>
              <span className="rounded-[6px] bg-[var(--spark-surface)] border border-[var(--spark-border)] px-2 py-0.5 text-[var(--spark-text-primary)] font-medium">
                {activeWorkspace?.name || "Active Workspace"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[var(--spark-text-secondary)] text-[11px]">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <span className="hidden sm:inline">{currentUser.name}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center bg-[var(--spark-canvas)]/45">
            <div className="max-w-md space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] spark-clay-icon text-[var(--spark-accent)]">
                <Bot className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                Ask SPARK AI
              </h3>
              <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed">
                Summarize conversations, draft documents, and search across {activeWorkspace?.name}.
              </p>

              {statusMessage && (
                <div className="rounded-[8px] border border-[var(--spark-accent)]/30 bg-[var(--spark-highlight)]/60 p-3 text-xs text-[var(--spark-highlight-text)] flex items-start gap-2 text-left">
                  <Info className="h-4 w-4 text-[var(--spark-accent)] shrink-0 mt-0.5" />
                  <span>{statusMessage}</span>
                </div>
              )}
            </div>
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask anything about ${activeWorkspace?.name || "this workspace"}...`}
              className="flex-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3.5 py-2 text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:bg-[var(--spark-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--spark-accent)] transition-colors duration-150"
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
