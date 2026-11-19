"use client";

import React, { useState } from "react";
import { Hash, Lock, Info, Users, ArrowLeft, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useNexconnChat } from "./NexconnChatProvider";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { AIChatSummaryModal } from "./AIChatSummaryModal";
import { summarizeConversationMessages, AIChatSummaryResult } from "@/lib/ai/service";

interface ConversationHeaderProps {
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  onBackToList?: () => void;
}

export function ConversationHeader({
  showRightPanel,
  onToggleRightPanel,
  onBackToList,
}: ConversationHeaderProps) {
  const { activeConversation, channelDetails, onlineUserIds, messages, summaries } = useNexconnChat();
  const { currentUser } = useWorkspace();

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<AIChatSummaryResult | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  if (!activeConversation) {
    return (
      <div className="flex h-[52px] items-center border-b border-[var(--spark-border)] px-4 bg-[var(--spark-surface)]">
        <span className="text-xs text-[var(--spark-text-muted)]">
          Select a conversation to start chatting
        </span>
      </div>
    );
  }

  const isChannel = activeConversation.type === "channel";
  const isPeerOnline = !isChannel && Boolean(onlineUserIds[activeConversation.nexconnTargetId]);

  const convKey = `${activeConversation.type}:${activeConversation.nexconnTargetId}`;
  const unreadCount = summaries[convKey]?.unreadCount || 0;

  const handleOpenAISummary = async () => {
    setIsSummaryOpen(true);
    setIsLoadingSummary(true);

    try {
      const res = await summarizeConversationMessages({
        messages: messages.map((m) => ({
          senderName: m.senderName,
          text: m.text,
          time: m.time,
          isMe: m.isMe,
        })),
        currentUserName: currentUser?.name || "Team Member",
        conversationName: activeConversation.name,
        conversationType: activeConversation.type,
      });

      setSummaryData(res);
    } catch (err) {
      console.error("Failed to generate AI summary:", err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <>
      <div className="flex h-[52px] items-center justify-between border-b border-[var(--spark-border)] px-4 bg-[var(--spark-surface)] select-none transition-colors duration-150">
        <div className="flex items-center gap-2.5 truncate min-w-0">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="md:hidden p-1.5 -ml-1 rounded-[6px] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150 shrink-0"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {isChannel ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
              {activeConversation.isPrivate ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Hash className="h-3.5 w-3.5" />
              )}
            </div>
          ) : (
            <div className="relative shrink-0">
              <Avatar
                name={activeConversation.name}
                size="sm"
                src={activeConversation.peer?.avatarUrl || undefined}
              />
              {isPeerOnline && (
                <span
                  className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#10B981] ring-2 ring-[var(--spark-surface)]"
                  title="Online"
                />
              )}
            </div>
          )}

          <div className="flex items-baseline gap-2 truncate">
            <span className="text-xs sm:text-[13px] font-semibold text-[var(--spark-text-primary)] truncate">
              {activeConversation.name}
            </span>

            {isChannel && activeConversation.description && (
              <span className="text-xs text-[var(--spark-text-muted)] font-normal truncate hidden md:inline">
                · {activeConversation.description}
              </span>
            )}

            {!isChannel && activeConversation.peer?.email && (
              <span className="text-[11px] text-[var(--spark-text-muted)] font-normal truncate hidden sm:inline">
                {activeConversation.peer.email}
              </span>
            )}

            {isPeerOnline && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#10B981]/12 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Instagram-style Catch Up with AI Button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleOpenAISummary}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-xs font-semibold transition-all shadow-2xs active:scale-[0.98]",
                unreadCount > 0
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm ring-1 ring-white/20 animate-pulse hover:opacity-95"
                  : "bg-[var(--spark-highlight)] text-[var(--spark-accent)] border border-[var(--spark-border)] hover:bg-[var(--spark-surface-elevated)]"
              )}
              title="Catch up on recent unread messages with SPARK AI"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Catch Up</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/25 text-white font-mono font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          )}

          {isChannel && channelDetails && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-1 text-[11px] text-[var(--spark-text-secondary)] font-medium">
              <Users className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
              <span>{channelDetails.members.length + 1} members</span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleRightPanel}
            className={cn(
              "p-1.5 rounded-[6px] transition-colors duration-150",
              showRightPanel
                ? "bg-[var(--spark-highlight)] text-[var(--spark-accent)]"
                : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)]"
            )}
            title="Toggle conversation details"
            aria-label="Toggle details"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AIChatSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        summaryData={summaryData}
        isLoading={isLoadingSummary}
        conversationName={activeConversation.name}
        conversationType={activeConversation.type}
        messageCount={messages.length}
      />
    </>
  );
}
