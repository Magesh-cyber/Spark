"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  FileText,
  Download,
  MessageSquare,
  Check,
  CheckCheck,
  Clock,
  ChevronDown,
  AlertCircle,
  Lock,
  X,
  ZoomIn,
  Copy,
  Mic,
  Reply,
  ClipboardCheck,
} from "lucide-react";
import { useNexconnChat } from "./NexconnChatProvider";
import { ChatMessageItem } from "./types";
import { cn } from "@/lib/utils";

function getDateDividerLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function appendDownloadParam(url: string): string {
  if (!url) return "#";
  if (url.startsWith("blob:")) return url;
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
}

export function MessageStream() {
  const {
    messages,
    isLoadingMessages,
    activeConversation,
    isOtherTyping,
    setReplyingTo,
    acknowledgeHandover,
    currentUserId,
  } = useNexconnChat();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(
    null
  );

  const handleCopyText = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
    }).catch(() => {});
  };

  // Identify the latest outgoing message ID so we display the clean text receipt underneath it
  const latestMyMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isMe) return messages[i].id;
    }
    return null;
  }, [messages]);

  // Group messages by calendar day
  const groupedMessages = useMemo(() => {
    const groups: { dateLabel: string; items: ChatMessageItem[] }[] = [];
    let currentLabel = "";
    let currentItems: ChatMessageItem[] = [];

    for (const msg of messages) {
      const label = getDateDividerLabel(msg.timestamp);
      if (label !== currentLabel) {
        if (currentItems.length > 0) {
          groups.push({ dateLabel: currentLabel, items: currentItems });
        }
        currentLabel = label;
        currentItems = [msg];
      } else {
        currentItems.push(msg);
      }
    }

    if (currentItems.length > 0) {
      groups.push({ dateLabel: currentLabel, items: currentItems });
    }

    return groups;
  }, [messages]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom("auto");
  }, [activeConversation?.id]);

  const showScrollBottomRef = useRef(false);
  showScrollBottomRef.current = showScrollBottom;

  useEffect(() => {
    if (!showScrollBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages, isOtherTyping]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 150);
  };

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[var(--spark-canvas)]/55">
        <div className="h-14 w-14 rounded-[18px] spark-clay-icon text-[var(--spark-accent)] flex items-center justify-center mb-3.5">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-[var(--spark-text-primary)]">
          No conversation selected
        </p>
        <p className="text-xs text-[var(--spark-text-secondary)] mt-1 max-w-xs">
          Select a channel or direct message from the sidebar to start chatting.
        </p>
      </div>
    );
  }

  if (isLoadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center bg-[var(--spark-canvas)]/55">
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--spark-accent)] animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-[var(--spark-accent)] animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-[var(--spark-accent)] animate-bounce" />
          </div>
          <span className="text-xs text-[var(--spark-text-secondary)] font-medium">
            Loading messages...
          </span>
        </div>
      </div>
    );
  }

  const isChannel = activeConversation.type === "channel";

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[var(--spark-canvas)]/55 relative"
    >
      {/* Subtle Secure Transmission Notice */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 select-none">
          <Lock className="h-2.5 w-2.5 shrink-0" />
          <span>Secured with TLS &amp; AES-256 encrypted workspace media</span>
        </div>
      </div>

      {/* Empty State */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="h-14 w-14 rounded-[18px] spark-clay-icon text-[var(--spark-accent)] flex items-center justify-center mb-3.5">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--spark-text-primary)]">
            {isChannel
              ? `Welcome to #${activeConversation.name}!`
              : `Direct conversation with ${activeConversation.name}`}
          </h3>
          <p className="text-xs text-[var(--spark-text-secondary)] max-w-sm mt-1 leading-relaxed">
            {isChannel
              ? activeConversation.description ||
                "This is the start of the channel. Share messages, photos, videos, or documents securely."
              : "This is the start of your private conversation. All messages and media are strictly workspace-authorized."}
          </p>
        </div>
      )}

      {/* Message Groups by Date */}
      {groupedMessages.map((group) => (
        <div key={group.dateLabel} className="space-y-2.5">
          {/* Centered Date Badge */}
          <div className="flex justify-center my-3 sticky top-1 z-10">
            <span className="px-3 py-0.5 rounded-full bg-[var(--spark-surface)]/95 backdrop-blur-sm border border-[var(--spark-border)] text-[10px] font-semibold text-[var(--spark-text-secondary)] shadow-2xs">
              {group.dateLabel}
            </span>
          </div>

          {/* Messages in Group */}
          {group.items.map((msg, idx) => {
            const prevMsg = idx > 0 ? group.items[idx - 1] : null;
            const isGroupedWithPrev =
              Boolean(prevMsg) &&
              prevMsg!.senderId === msg.senderId &&
              msg.timestamp - prevMsg!.timestamp < 180_000;

            const isMe = msg.isMe;
            const isLatestOutgoing = isMe && msg.id === latestMyMessageId;

            const receiptTitle =
              msg.status === "sending"
                ? "Pending"
                : msg.status === "error"
                ? "Failed to send"
                : msg.status === "read"
                ? msg.seenBy && msg.seenBy.length > 0 && isChannel
                  ? `Seen by ${msg.seenBy.map((s) => s.name).join(", ")}`
                  : "Seen"
                : msg.status === "delivered"
                ? "Delivered"
                : "Sent";

            return (
              <div
                key={msg.id}
                className={cn("space-y-1", isGroupedWithPrev ? "!mt-1" : "")}
              >
                <div
                  className={cn(
                    "flex items-end gap-2 group/msg transition-all",
                    isMe ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Incoming Message Avatar (hidden when tightly grouped with previous) */}
                  {!isMe && (
                    <div className="w-7 shrink-0 mb-0.5">
                      {!isGroupedWithPrev && (
                        <Avatar
                          name={msg.senderName}
                          size="sm"
                          src={msg.senderAvatar || undefined}
                        />
                      )}
                    </div>
                  )}

                  {/* Subtle Hover Action Toolbar (left side for outgoing) */}
                  {isMe && (
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 flex items-center gap-1 mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyingTo({
                            messageId: msg.id,
                            senderName: "You",
                            senderId: msg.senderId,
                            text: msg.text || (msg.fileInfo ? `[${msg.fileInfo.type}]` : ""),
                          })
                        }
                        className="p-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                        title="Reply in thread"
                        aria-label="Reply in thread"
                      >
                        <Reply className="h-3 w-3" />
                      </button>
                      {msg.text && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="p-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-[#10B981]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={cn(
                      "relative max-w-[85%] sm:max-w-md lg:max-w-lg px-3.5 py-2 shadow-2xs transition-colors duration-150",
                      isMe
                        ? "bg-[var(--spark-accent)] text-white rounded-[14px] rounded-tr-[4px]"
                        : "bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-text-primary)] rounded-[14px] rounded-tl-[4px]"
                    )}
                  >
                    {/* Sender Name in Group Channels */}
                    {!isMe && isChannel && !isGroupedWithPrev && (
                      <div className="text-[11px] font-semibold text-[var(--spark-accent)] mb-0.5 select-none">
                        {msg.senderName}
                      </div>
                    )}

                    {/* Threaded Quoted Parent Message */}
                    {msg.replyTo && (
                      <div
                        className={cn(
                          "mb-2 px-2.5 py-1.5 rounded-[8px] border-l-2 text-xs select-none transition-colors",
                          isMe
                            ? "bg-white/12 border-white/80 text-white"
                            : "bg-[var(--spark-canvas)] border-[var(--spark-accent)] text-[var(--spark-text-secondary)]"
                        )}
                      >
                        <div className="flex items-center gap-1 font-semibold text-[11px]">
                          <Reply className="h-3 w-3 shrink-0" />
                          <span>@{msg.replyTo.senderName}</span>
                        </div>
                        <p className="truncate italic text-[11px] opacity-90 mt-0.5">
                          &quot;{msg.replyTo.text}&quot;
                        </p>
                      </div>
                    )}

                    {/* Shift Handover Report Card */}
                    {msg.isHandover && msg.handoverData && (
                      <div
                        className={cn(
                          "rounded-[10px] p-3 space-y-2.5 mb-2 border",
                          isMe
                            ? "bg-white/10 border-white/20 text-white"
                            : "bg-[var(--spark-canvas)] border-emerald-500/40 text-[var(--spark-text-primary)]"
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-2 border-b pb-2 border-current/15">
                          <div className="flex items-center gap-1.5">
                            <ClipboardCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                            <span className="font-bold text-[11px] uppercase tracking-wider">
                              Shift Handover Report
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            {msg.handoverData.shiftPeriod}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="font-semibold block text-[10px] opacity-80 uppercase tracking-wide">
                              ✅ Completed Work
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                              {msg.handoverData.completed}
                            </p>
                          </div>

                          {msg.handoverData.inProgress && msg.handoverData.inProgress !== "None" && (
                            <div>
                              <span className="font-semibold block text-[10px] opacity-80 uppercase tracking-wide">
                                🔄 Ongoing / In-Progress
                              </span>
                              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                                {msg.handoverData.inProgress}
                              </p>
                            </div>
                          )}

                          {msg.handoverData.blockers && msg.handoverData.blockers !== "None reported" && (
                            <div>
                              <span className="font-semibold block text-[10px] text-amber-300 uppercase tracking-wide">
                                ⚠️ Blockers / Critical Incidents
                              </span>
                              <p className="mt-0.5 whitespace-pre-wrap text-amber-200 leading-relaxed">
                                {msg.handoverData.blockers}
                              </p>
                            </div>
                          )}

                          <div>
                            <span className="font-semibold block text-[10px] opacity-80 uppercase tracking-wide">
                              📋 Instructions for Incoming Shift
                            </span>
                            <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                              {msg.handoverData.nextSteps}
                            </p>
                          </div>
                        </div>

                        {/* Sign-off / Acknowledgment Footer */}
                        <div className="pt-2 border-t border-current/15">
                          {msg.acknowledgments && msg.acknowledgments.length > 0 ? (
                            <div className="space-y-1">
                              {msg.acknowledgments.map((ack, i) => (
                                <div
                                  key={ack.id || `${ack.userId}-${i}`}
                                  className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium"
                                >
                                  <CheckCheck className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    ✓ Handover Acknowledged by <strong>{ack.userName}</strong>
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <span className="text-[10px] opacity-70 italic">
                                Pending acknowledgment
                              </span>
                              {!isMe && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    acknowledgeHandover(
                                      msg.id,
                                      msg.handoverData!.shiftPeriod,
                                      msg.senderId
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-[6px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="h-3 w-3" />
                                  Acknowledge Handover
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Attachment Card (Image / Video / Audio / File) */}
                    {msg.fileInfo && (
                      <div className={cn(msg.text ? "mb-2" : "mb-0.5")}>
                        {msg.fileInfo.type === "image" ? (
                          <div className="relative group/img rounded-[10px] overflow-hidden border border-black/10 dark:border-white/10 bg-black/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.fileInfo.url}
                              alt={msg.fileInfo.name}
                              onClick={() =>
                                setLightboxImage({
                                  url: msg.fileInfo!.url,
                                  name: msg.fileInfo!.name,
                                })
                              }
                              className="max-h-64 w-auto max-w-full object-cover rounded-[10px] cursor-pointer transition-transform duration-150 group-hover/img:scale-[1.01]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxImage({
                                  url: msg.fileInfo!.url,
                                  name: msg.fileInfo!.name,
                                })
                              }
                              className="absolute top-2 right-2 p-1.5 rounded-full bg-[#0D0B14]/70 text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-150"
                              aria-label="Preview full image"
                            >
                              <ZoomIn className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : msg.fileInfo.type === "video" ? (
                          <div className="rounded-[10px] overflow-hidden border border-black/15 bg-black">
                            <video
                              src={msg.fileInfo.url}
                              controls
                              playsInline
                              preload="metadata"
                              className="max-h-64 w-full max-w-xs sm:max-w-sm rounded-[10px]"
                            />
                          </div>
                        ) : msg.fileInfo.type === "audio" ? (
                          <div
                            className={cn(
                              "rounded-[10px] p-2.5 border space-y-2 max-w-full",
                              isMe
                                ? "bg-white/12 border-white/20 text-white"
                                : "bg-[var(--spark-canvas)] border-[var(--spark-border)] text-[var(--spark-text-primary)]"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 truncate font-medium">
                                <Mic className="h-3.5 w-3.5 shrink-0 opacity-85" />
                                <span className="truncate">
                                  {msg.fileInfo.name.startsWith("voice-message-")
                                    ? "Voice message"
                                    : msg.fileInfo.name}
                                </span>
                              </div>
                              <div
                                className={cn(
                                  "flex items-center gap-1.5 text-[10px] shrink-0",
                                  isMe ? "text-violet-100/90" : "text-[var(--spark-text-muted)]"
                                )}
                              >
                                {msg.fileInfo.size ? (
                                  <span>{formatFileSize(msg.fileInfo.size)}</span>
                                ) : null}
                                {msg.fileInfo.encrypted && (
                                  <Lock className="h-2.5 w-2.5" aria-label="Encrypted" />
                                )}
                                <a
                                  href={appendDownloadParam(msg.fileInfo.url)}
                                  download={msg.fileInfo.name}
                                  className="hover:opacity-100 opacity-80 transition-opacity"
                                  title="Download audio"
                                  aria-label="Download audio"
                                >
                                  <Download className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                            <audio
                              src={msg.fileInfo.url}
                              controls
                              preload="metadata"
                              className="h-9 w-full min-w-[210px] sm:min-w-[250px] max-w-xs"
                            />
                          </div>
                        ) : (
                          <a
                            href={appendDownloadParam(msg.fileInfo.url)}
                            target="_blank"
                            rel="noreferrer"
                            download={msg.fileInfo.name}
                            className={cn(
                              "inline-flex items-center gap-2.5 rounded-[10px] p-2.5 text-xs transition-colors duration-150 border max-w-full",
                              isMe
                                ? "bg-white/12 border-white/20 text-white hover:bg-white/20"
                                : "bg-[var(--spark-canvas)] border-[var(--spark-border)] text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)]"
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px]",
                                isMe
                                  ? "bg-white/20 text-white"
                                  : "bg-[var(--spark-highlight)] text-[var(--spark-accent)]"
                              )}
                            >
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="truncate min-w-0">
                              <div className="font-medium truncate">
                                {msg.fileInfo.name}
                              </div>
                              <div
                                className={cn(
                                  "text-[10px] flex items-center gap-1.5",
                                  isMe ? "text-violet-100" : "text-[var(--spark-text-muted)]"
                                )}
                              >
                                {msg.fileInfo.size ? (
                                  <span>{formatFileSize(msg.fileInfo.size)}</span>
                                ) : null}
                                {msg.fileInfo.encrypted && (
                                  <span className="inline-flex items-center gap-0.5">
                                    <Lock className="h-2.5 w-2.5" />
                                    Encrypted
                                  </span>
                                )}
                              </div>
                            </div>
                            <Download className="h-3.5 w-3.5 ml-1 shrink-0 opacity-80" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Message Text / Caption */}
                    {msg.text && !msg.isHandover && (
                      <p
                        className={cn(
                          "text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap break-words",
                          isMe ? "text-white" : "text-[var(--spark-text-primary)]"
                        )}
                      >
                        {msg.text}
                      </p>
                    )}

                    {/* Message Meta: Time + Live Read Receipt Icon */}
                    <div
                      className={cn(
                        "flex items-center justify-end gap-1 mt-1 text-[10px] select-none",
                        isMe ? "text-violet-100/90" : "text-[var(--spark-text-muted)]"
                      )}
                    >
                      <span>{msg.time}</span>

                      {isMe && (
                        <span
                          className="inline-flex items-center ml-0.5"
                          title={receiptTitle}
                        >
                          {msg.status === "sending" ? (
                            <Clock
                              className="h-3 w-3 text-violet-100/90 animate-pulse"
                              aria-label="Pending"
                            />
                          ) : msg.status === "error" ? (
                            <AlertCircle
                              className="h-3 w-3 text-amber-200"
                              aria-label="Failed to send"
                            />
                          ) : msg.status === "read" ? (
                            <CheckCheck
                              className="h-3.5 w-3.5 text-emerald-300 drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                              aria-label="Seen"
                            />
                          ) : msg.status === "delivered" ? (
                            <CheckCheck
                              className="h-3.5 w-3.5 text-violet-100/80"
                              aria-label="Delivered"
                            />
                          ) : (
                            <Check
                              className="h-3.5 w-3.5 text-violet-100/80"
                              aria-label="Sent"
                            />
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtle Hover Action Toolbar (right side for incoming) */}
                  {!isMe && (
                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 flex items-center gap-1 mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          setReplyingTo({
                            messageId: msg.id,
                            senderName: msg.senderName,
                            senderId: msg.senderId,
                            text: msg.text || (msg.fileInfo ? `[${msg.fileInfo.type}]` : ""),
                          })
                        }
                        className="p-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                        title="Reply in thread"
                        aria-label="Reply in thread"
                      >
                        <Reply className="h-3 w-3" />
                      </button>
                      {msg.text && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.text)}
                          className="p-1 rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:border-[var(--spark-border-strong)] transition-colors duration-150"
                          title="Copy message"
                          aria-label="Copy message"
                        >
                          {copiedId === msg.id ? (
                            <Check className="h-3 w-3 text-[#10B981]" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Clear Instagram / WhatsApp style status label under the latest outgoing message */}
                {isLatestOutgoing && (
                  <div className="flex justify-end pr-1 text-[10px] font-medium select-none">
                    {msg.status === "sending" ? (
                      <span className="text-[var(--spark-text-muted)]">Pending...</span>
                    ) : msg.status === "error" ? (
                      <span className="text-rose-500">Not delivered</span>
                    ) : msg.status === "read" ? (
                      <span className="text-[var(--spark-accent)] font-semibold">
                        {isChannel && msg.seenBy && msg.seenBy.length > 0
                          ? msg.seenBy.length === 1
                            ? `Seen by ${msg.seenBy[0].name}`
                            : `Seen by ${msg.seenBy[0].name} +${msg.seenBy.length - 1}`
                          : "Seen"}
                      </span>
                    ) : msg.status === "delivered" ? (
                      <span className="text-[var(--spark-text-muted)]">Delivered</span>
                    ) : (
                      <span className="text-[var(--spark-text-muted)]">Sent</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Typing Indicator Bubble */}
      {isOtherTyping && (
        <div className="flex items-end gap-2 justify-start animate-in fade-in slide-in-from-bottom-2">
          {!isChannel && activeConversation.peer && (
            <Avatar
              name={activeConversation.peer.fullName}
              size="sm"
              src={activeConversation.peer.avatarUrl || undefined}
            />
          )}
          <div className="bg-[var(--spark-surface)] border border-[var(--spark-border)] text-[var(--spark-text-secondary)] rounded-[14px] rounded-tl-[4px] px-3.5 py-2 shadow-2xs flex items-center gap-1.5">
            <span className="text-[11px] font-medium mr-1">
              {isChannel ? "Someone is typing" : `${activeConversation.name} is typing`}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--spark-accent)] animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--spark-accent)] animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--spark-accent)] animate-bounce" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Floating Glassmorphic Scroll to Bottom Pill */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="fixed bottom-24 right-8 z-20 flex items-center gap-1 spark-glass border text-[var(--spark-text-primary)] shadow-elevated hover:bg-[var(--spark-highlight)] hover:text-[var(--spark-highlight-text)] px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 animate-in fade-in"
        >
          <span>Latest messages</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Full-Screen Secure Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-[#0D0B14]/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="w-full max-w-4xl flex items-center justify-between mb-3 text-[#F4F2FA]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-xs font-medium truncate">
              <Lock className="h-3.5 w-3.5 text-[#10B981] shrink-0" />
              <span className="truncate">{lightboxImage.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={appendDownloadParam(lightboxImage.url)}
                download={lightboxImage.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors duration-150"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-[6px] bg-white/10 hover:bg-white/20 transition-colors duration-150"
                aria-label="Close preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full object-contain rounded-[12px] shadow-modal border border-white/10"
          />
        </div>
      )}
    </div>
  );
}
