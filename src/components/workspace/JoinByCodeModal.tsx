"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, X, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinWorkspaceByCode } from "@/lib/actions/workspaces";
import { joinChannelByCode } from "@/lib/actions/chat-channels";
import { useWorkspace } from "@/lib/workspace-context";

interface JoinByCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinByCodeModal({ isOpen, onClose }: JoinByCodeModalProps) {
  const router = useRouter();
  const { refreshWorkspaces } = useWorkspace();
  const [code, setCode] = useState("");
  const [targetType, setTargetType] = useState<"WORKSPACE" | "CHANNEL">("WORKSPACE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "error";
    message: string;
    redirectUrl?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setFeedback({
        type: "error",
        message: "Please enter a valid 6-character alphanumeric code.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (targetType === "WORKSPACE") {
        const res = await joinWorkspaceByCode(cleanCode);
        if (res.success) {
          await refreshWorkspaces();
          if (res.requiresApproval) {
            setFeedback({
              type: "info",
              message: res.message || "Your join request has been sent to the workspace owner for review.",
            });
          } else {
            setFeedback({
              type: "success",
              message: res.message || `Successfully joined ${res.workspaceName || "workspace"}!`,
              redirectUrl: res.workspaceSlug ? `/workspaces/${res.workspaceSlug}` : "/workspaces",
            });
            setTimeout(() => {
              if (res.workspaceSlug) {
                router.push(`/workspaces/${res.workspaceSlug}`);
                onClose();
              }
            }, 1500);
          }
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Failed to join workspace with provided code.",
          });
        }
      } else {
        // Channel join
        const res = await joinChannelByCode(cleanCode);
        if (res.success) {
          setFeedback({
            type: "success",
            message: res.message || `Successfully joined #${res.channelName}!`,
            redirectUrl: "/chat",
          });
          setTimeout(() => {
            router.push("/chat");
            onClose();
          }, 1500);
        } else {
          setFeedback({
            type: "error",
            message: res.error || "Failed to join channel with provided code.",
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#0D0B14]/55 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-md rounded-[14px] border spark-glass p-6 text-[var(--spark-text-primary)] shadow-modal animate-in fade-in-50 zoom-in-95">
        <div className="flex items-center justify-between pb-3.5 border-b border-[var(--spark-border)]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                Join with 6-Character Code
              </h3>
              <p className="text-[11px] text-[var(--spark-text-muted)]">
                Enter a code shared by your workspace owner or channel admin
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Type toggle */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-[8px] bg-[var(--spark-surface)] border border-[var(--spark-border)]">
          <button
            type="button"
            onClick={() => {
              setTargetType("WORKSPACE");
              setFeedback(null);
            }}
            className={`py-1.5 px-3 rounded-[6px] text-xs font-medium transition-all duration-150 flex items-center justify-center gap-1.5 ${
              targetType === "WORKSPACE"
                ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-semibold shadow-2xs"
                : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Workspace Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType("CHANNEL");
              setFeedback(null);
            }}
            className={`py-1.5 px-3 rounded-[6px] text-xs font-medium transition-all duration-150 flex items-center justify-center gap-1.5 ${
              targetType === "CHANNEL"
                ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-semibold shadow-2xs"
                : "text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)]"
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            <span>Channel Code</span>
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-[8px] border p-3 text-xs flex items-start gap-2.5 ${
              feedback.type === "success"
                ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                : feedback.type === "info"
                ? "border-[var(--spark-accent)]/30 bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)]"
                : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
            ) : feedback.type === "info" ? (
              <ShieldCheck className="h-4 w-4 text-[var(--spark-accent)] shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{feedback.message}</p>
              {feedback.redirectUrl && (
                <p className="text-[11px] opacity-80 mt-1">Redirecting you now...</p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
              Enter 6-Character Alphanumeric Code
            </label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="e.g. X9K2P4"
                maxLength={6}
                required
                className="w-full text-center tracking-[0.35em] font-mono text-xl font-bold uppercase py-2.5 px-4 rounded-[8px] bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] placeholder:tracking-normal focus:outline-none focus:border-[var(--spark-accent)] focus:ring-1 focus:ring-[var(--spark-accent)] transition-all duration-150"
              />
            </div>
            <p className="text-[11px] text-[var(--spark-text-muted)] mt-1.5 text-center">
              {targetType === "WORKSPACE"
                ? "Public workspaces grant instant access. Private workspaces notify the owner for approval."
                : "Enter the channel code to join discussions in an accessible workspace."}
            </p>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--spark-border)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={code.length !== 6}
              rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Join {targetType === "WORKSPACE" ? "Workspace" : "Channel"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
