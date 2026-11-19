"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Send,
  Sparkles,
  Key,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Layers,
  ListTodo,
  FileText,
  X,
  User,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useWorkspace } from "@/lib/workspace-context";
import { askWorkspaceAssistant, getAIStatus } from "@/lib/ai/service";
import { getWorkspaceProjects } from "@/lib/actions/projects";
import { getWorkspaceTasks } from "@/lib/actions/tasks";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  providerUsed?: "gemini" | "openai" | "groq" | "heuristic";
}

const QUICK_STARTERS = [
  {
    icon: ListTodo,
    label: "High-Priority Deliverables",
    prompt: "What are my high-priority tasks, blockers, and upcoming deadlines in this workspace?",
  },
  {
    icon: Layers,
    label: "Project Milestones",
    prompt: "Summarize progress across all active projects, completion rates, and key owners.",
  },
  {
    icon: FileText,
    label: "Shift Handover Protocol",
    prompt: "Prepare a structured shift handover update summarizing completed work, in-progress items, and blockers.",
  },
  {
    icon: Sparkles,
    label: "Draft Team Announcement",
    prompt: "Draft a concise, executive team announcement regarding our milestone delivery and sprint goals.",
  },
];

export default function AIAssistantPage() {
  const { activeWorkspace, currentUser } = useWorkspace();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Configuration State
  const [aiStatus, setAiStatus] = useState<{
    isConfigured: boolean;
    provider: "gemini" | "openai" | "groq" | "heuristic";
    modelName: string;
  }>({
    isConfigured: false,
    provider: "heuristic",
    modelName: "Loading AI Engine...",
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [workspaceContextSummary, setWorkspaceContextSummary] = useState<{
    projectsSummary?: string;
    tasksSummary?: string;
  }>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load AI configuration status & real workspace context
  useEffect(() => {
    getAIStatus().then(setAiStatus).catch(() => {});

    if (activeWorkspace?.id) {
      // Gather active projects
      getWorkspaceProjects(activeWorkspace.id)
        .then((res) => {
          if (res?.projects && res.projects.length > 0) {
            const summary = res.projects
              .map(
                (p) =>
                  `• ${p.name} [${p.key}]: ${p.status}, ${p.taskStats.completionPercentage}% complete (${p.taskStats.done}/${p.taskStats.total} done, Lead: ${p.ownerName})`
              )
              .join("\n");
            setWorkspaceContextSummary((prev) => ({ ...prev, projectsSummary: summary }));
          }
        })
        .catch(() => {});

      // Gather active tasks
      getWorkspaceTasks(activeWorkspace.id)
        .then((res) => {
          if (res?.tasks && res.tasks.length > 0) {
            const urgentCount = res.tasks.filter((t) => t.priority === "URGENT").length;
            const highCount = res.tasks.filter((t) => t.priority === "HIGH").length;
            const inProgressCount = res.tasks.filter((t) => t.status === "IN_PROGRESS").length;
            const summary = `${res.tasks.length} total tasks (${inProgressCount} in progress, ${highCount} high priority, ${urgentCount} urgent). Top issues: ${res.tasks
              .slice(0, 5)
              .map((t) => `${t.issueKey || t.title} (${t.status}, ${t.priority})`)
              .join("; ")}`;
            setWorkspaceContextSummary((prev) => ({ ...prev, tasksSummary: summary }));
          }
        })
        .catch(() => {});
    }
  }, [activeWorkspace?.id]);

  // Initial welcome greeting
  useEffect(() => {
    if (messages.length === 0) {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages([
        {
          id: "welcome-1",
          role: "assistant",
          content: `Hello **${currentUser.name}**! 👋 I am **SPARK AI**, your workplace copilot for **${
            activeWorkspace?.name || "your organization"
          }**.\n\nI have real-time visibility into your active projects, work item boards, deliverables, and team communications. How can I assist you today?`,
          timestamp: now,
          providerUsed: aiStatus.provider,
        },
      ]);
    }
  }, [currentUser.name, activeWorkspace?.name, aiStatus.provider]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSubmitting]);

  const handleSendMessage = async (promptToSend?: string) => {
    const text = (promptToSend || inputPrompt).trim();
    if (!text || isSubmitting) return;

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: timeString,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt("");
    setIsSubmitting(true);

    try {
      const result = await askWorkspaceAssistant({
        prompt: text,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
        workspaceContext: {
          workspaceName: activeWorkspace?.name || "SPARK Workspace",
          currentUser: {
            name: currentUser.name,
            role: currentUser.role,
            email: currentUser.email,
          },
          projectsSummary: workspaceContextSummary.projectsSummary,
          tasksSummary: workspaceContextSummary.tasksSummary,
        },
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        providerUsed: result.providerUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("AI Assistant request failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "I encountered a temporary issue generating a response. Please verify your workspace connection or check the API key settings.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          providerUsed: "heuristic",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    }).catch(() => {});
  };

  const handleClearHistory = () => {
    if (confirm("Clear conversation history with SPARK AI?")) {
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: `Conversation reset. How can I assist you with **${activeWorkspace?.name}**?`,
          timestamp: now,
          providerUsed: aiStatus.provider,
        },
      ]);
    }
  };

  return (
    <ShellLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--spark-border)]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--spark-text-primary)]">
                SPARK AI Copilot
              </h1>
              <Badge variant="violet" dot size="sm">
                Live Assistant
              </Badge>
            </div>
            <p className="text-xs text-[var(--spark-text-secondary)] mt-0.5">
              Workspace intelligence, project coordination, and automated workplace summaries for{" "}
              <strong className="text-[var(--spark-text-primary)]">{activeWorkspace?.name || "your team"}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* AI Engine Status Pill */}
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-all shadow-2xs",
                aiStatus.isConfigured
                  ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30 hover:bg-violet-500/20"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
              )}
              title="Click to view AI engine configuration and API keys"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>{aiStatus.modelName}</span>
              <Key className="h-3 w-3 opacity-60 ml-0.5" />
            </button>

            <button
              type="button"
              onClick={handleClearHistory}
              className="p-1.5 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              title="Reset conversation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Copilot Shell */}
        <div className="flex flex-col h-[calc(100vh-230px)] rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-sm overflow-hidden">
          {/* Top Context Subheader */}
          <div className="flex items-center justify-between border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/70 px-4 py-2 text-xs">
            <div className="flex items-center gap-2 text-[var(--spark-text-secondary)]">
              <span className="font-semibold text-[var(--spark-text-primary)]">Context:</span>
              <span className="px-2 py-0.5 rounded-[6px] bg-[var(--spark-surface)] border border-[var(--spark-border)] font-medium text-[var(--spark-text-primary)]">
                {activeWorkspace?.name || "Active Workspace"}
              </span>
              <span className="hidden md:inline text-[11px] text-[var(--spark-text-muted)]">
                • Synchronized with Projects &amp; Work Items
              </span>
            </div>

            <div className="flex items-center gap-2 text-[var(--spark-text-secondary)] text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-[var(--spark-text-primary)]">{currentUser.name}</span>
              <span className="hidden sm:inline text-[var(--spark-text-muted)]">({currentUser.role})</span>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[var(--spark-canvas)]/40">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-3xl",
                    isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  {/* Avatar */}
                  <div className="shrink-0 mt-0.5">
                    {isUser ? (
                      <Avatar name={currentUser.name} size="sm" src={currentUser.avatarUrl || undefined} />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "flex flex-col space-y-1.5 rounded-[12px] p-4 text-xs sm:text-[13px] leading-relaxed shadow-2xs",
                      isUser
                        ? "bg-[var(--spark-accent)] text-white rounded-tr-none"
                        : "bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-text-primary)] rounded-tl-none"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 font-medium border-b border-white/10 dark:border-black/10 pb-1 mb-1">
                      <span>{isUser ? "You" : "SPARK AI Copilot"}</span>
                      <div className="flex items-center gap-2">
                        {!isUser && msg.providerUsed && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-bold bg-violet-500/15 text-violet-700 dark:text-violet-300">
                            {msg.providerUsed === "heuristic" ? "Semantic Fallback" : msg.providerUsed}
                          </span>
                        )}
                        <span>{msg.timestamp}</span>
                        {!isUser && (
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="hover:opacity-100 transition-opacity p-0.5"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Content Body with Markdown Rendering */}
                    <div className="prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap font-sans">
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}

            {isSubmitting && (
              <div className="flex gap-3 max-w-xl mr-auto animate-in fade-in">
                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-[var(--spark-surface)] border border-[var(--spark-border)] rounded-[12px] rounded-tl-none p-3.5 flex items-center gap-2 text-xs text-[var(--spark-text-secondary)] shadow-2xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
                  <span>Synthesizing workspace context...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Prompts Row */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-[var(--spark-border)] bg-[var(--spark-surface-subtle)]/40 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[var(--spark-text-muted)] uppercase tracking-wider shrink-0 select-none">
                  Quick Prompts:
                </span>
                {QUICK_STARTERS.map((starter, idx) => {
                  const Icon = starter.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(starter.prompt)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[11px] font-medium text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-accent)]/40 hover:bg-[var(--spark-highlight)] transition-all shrink-0 shadow-2xs active:scale-95 disabled:opacity-50"
                    >
                      <Icon className="h-3 w-3 text-[var(--spark-accent)]" />
                      <span>{starter.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Composer Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-[var(--spark-border)] bg-[var(--spark-surface)] p-3 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder={`Ask SPARK AI anything about ${activeWorkspace?.name || "your workspace"}, projects, or tasks...`}
              disabled={isSubmitting}
              className="flex-1 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-3.5 py-2 text-xs sm:text-[13px] text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:bg-[var(--spark-surface)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)] transition-colors"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )
              }
              disabled={!inputPrompt.trim() || isSubmitting}
            >
              {isSubmitting ? "Thinking..." : "Send"}
            </Button>
          </form>
        </div>
      </div>

      {/* AI Engine & API Key Setup Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                  <Key className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">SPARK AI Engine Configuration</h3>
                  <p className="text-[11px] text-white/80">
                    Connect Google Gemini, OpenAI, or Groq for live LLM intelligence
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs">
              {/* Current Status Box */}
              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface-subtle)] border border-[var(--spark-border)] flex items-start gap-3">
                <div className="h-8 w-8 rounded-[8px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--spark-text-primary)]">Active Engine:</span>
                    <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                      {aiStatus.modelName}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--spark-text-secondary)] mt-0.5">
                    {aiStatus.isConfigured
                      ? "Direct API connection verified and active."
                      : "Semantic Fallback Engine is active. All AI summaries, smart replies, checklists, and chat copilot work deterministically without external API costs."}
                  </p>
                </div>
              </div>

              {/* Step by Step Setup Instructions */}
              <div className="space-y-3">
                <h4 className="font-semibold text-[var(--spark-text-primary)] text-xs">
                  How to add an API key (Recommended: Google Gemini Free Tier):
                </h4>

                <div className="space-y-2">
                  <div className="p-3 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--spark-text-primary)]">
                        Option 1: Google Gemini (100% Free Tier, No Card Required)
                      </span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline font-medium"
                      >
                        Get Key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-[var(--spark-text-secondary)]">
                      Visit Google AI Studio, sign in with your Google account, and click <strong>Create API Key</strong>.
                    </p>
                    <div className="p-2 rounded-[6px] bg-zinc-900 text-zinc-100 font-mono text-[11px] select-all">
                      GEMINI_API_KEY=&quot;AIzaSy...&quot;
                    </div>
                  </div>

                  <div className="p-3 rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--spark-text-primary)]">
                        Option 2: OpenAI (GPT-4o mini)
                      </span>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline font-medium"
                      >
                        Get Key <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="text-[11px] text-[var(--spark-text-secondary)]">
                      Create a standard OpenAI project secret key.
                    </p>
                    <div className="p-2 rounded-[6px] bg-zinc-900 text-zinc-100 font-mono text-[11px] select-all">
                      OPENAI_API_KEY=&quot;sk-proj-...&quot;
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-[8px] bg-violet-500/10 border border-violet-500/25 text-[11px] text-[var(--spark-text-secondary)] space-y-1">
                  <div className="font-semibold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-violet-600" />
                    Where to paste it:
                  </div>
                  <p>
                    Open the file <code className="px-1.5 py-0.5 rounded bg-[var(--spark-surface)] border font-mono">.env.local</code> in the root of the project and paste the line above. Next.js will automatically detect it.
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2 border-t border-[var(--spark-border)]">
                <Button variant="outline" size="sm" onClick={() => setIsConfigModalOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
