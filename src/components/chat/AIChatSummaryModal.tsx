"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  Bot,
  ArrowRight,
  ListFilter,
  Layers,
  ChevronRight,
  Clock,
} from "lucide-react";
import { AIChatSummaryResult } from "@/lib/ai/service";

interface AIChatSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: AIChatSummaryResult | null;
  isLoading: boolean;
  conversationName: string;
  conversationType: "channel" | "direct";
  messageCount: number;
}

export function AIChatSummaryModal({
  isOpen,
  onClose,
  summaryData,
  isLoading,
  conversationName,
  conversationType,
  messageCount,
}: AIChatSummaryModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!summaryData) return;
    const text = [
      `SPARK AI Summary — ${conversationType === "channel" ? `#${conversationName}` : conversationName}`,
      "",
      summaryData.summary,
      "",
      "Key Highlights:",
      ...summaryData.keyPoints.map((p) => `• ${p}`),
      ...(summaryData.actionItems.length > 0
        ? ["", "Action Items:", ...summaryData.actionItems.map((a) => `• ${a}`)]
        : []),
      ...(summaryData.questions.length > 0
        ? ["", "Unresolved Questions:", ...summaryData.questions.map((q) => `• ${q}`)]
        : []),
    ].join("\n");

    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-[14px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-[var(--spark-border)] bg-[var(--spark-surface-subtle)] px-5 py-4 text-[var(--spark-text-primary)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)] border border-[var(--spark-border)] flex items-center justify-center shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold tracking-tight text-[var(--spark-text-primary)]">Catch Up with AI</h3>
                <span className="px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold uppercase tracking-wider bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] border border-[var(--spark-border)]">
                  Smart Digest
                </span>
              </div>
              <p className="text-[11px] text-[var(--spark-text-secondary)]">
                {conversationType === "channel" ? `#${conversationName}` : conversationName} • {messageCount} recent messages
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-[6px] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
              <div className="h-10 w-10 rounded-full border-2 border-[var(--spark-accent)] border-t-transparent animate-spin" />
              <p className="text-xs font-semibold text-[var(--spark-text-primary)]">
                Synthesizing conversation...
              </p>
              <p className="text-[11px] text-[var(--spark-text-muted)] max-w-xs">
                Extracting key decisions, tasks, and questions so you can catch up instantly.
              </p>
            </div>
          ) : !summaryData ? (
            <div className="py-8 text-center text-[var(--spark-text-muted)]">
              Could not generate summary at this time.
            </div>
          ) : (
            <>
              {/* Executive Summary */}
              <div className="p-3.5 rounded-[10px] bg-[var(--spark-surface-subtle)] border border-[var(--spark-border)]">
                <div className="text-[10px] uppercase font-bold text-[var(--spark-accent)] tracking-wider mb-1 flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  <span>Overview</span>
                </div>
                <p className="text-xs text-[var(--spark-text-primary)] leading-relaxed font-medium">
                  {summaryData.summary}
                </p>
              </div>

              {/* Key Highlights */}
              {summaryData.keyPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-[var(--spark-text-primary)] flex items-center gap-1.5">
                    <ListFilter className="h-3.5 w-3.5 text-blue-500" />
                    Key Highlights
                  </span>
                  <ul className="space-y-1.5 pl-1">
                    {summaryData.keyPoints.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-xs text-[var(--spark-text-secondary)] leading-snug"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--spark-accent)] mt-1.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {summaryData.actionItems.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--spark-border-subtle)]">
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Action Items & Commitments
                  </span>
                  <div className="space-y-1">
                    {summaryData.actionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-[6px] bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-[var(--spark-text-primary)] flex items-start gap-2"
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unresolved Questions */}
              {summaryData.questions.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-[var(--spark-border-subtle)]">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    Open Questions
                  </span>
                  <div className="space-y-1">
                    {summaryData.questions.map((q, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-[6px] bg-amber-500/5 border border-amber-500/20 text-[11px] text-[var(--spark-text-primary)]"
                      >
                        {q}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider Info Pill */}
              <div className="pt-2 text-[10px] text-[var(--spark-text-muted)] flex items-center justify-between">
                <span>
                  Generated via{" "}
                  <strong className="text-[var(--spark-text-primary)] capitalize">
                    {summaryData.providerUsed === "heuristic"
                      ? "SPARK Semantic Engine"
                      : `${summaryData.providerUsed} LLM`}
                  </strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Real-time
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[var(--spark-surface-subtle)] border-t border-[var(--spark-border)] flex items-center justify-between">
          <button
            onClick={handleCopy}
            disabled={!summaryData || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-xs font-semibold text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-elevated)] transition disabled:opacity-50"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy Digest"}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-[6px] bg-[var(--spark-accent)] text-white text-xs font-semibold hover:bg-[var(--spark-accent-hover)] transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
