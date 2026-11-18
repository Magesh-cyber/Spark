"use client";

import React, { useState } from "react";
import { Hash, Lock, Plus, RefreshCw, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useNexconnChat } from "./NexconnChatProvider";
import { CreateChannelModal } from "./CreateChannelModal";
import { cn } from "@/lib/utils";

interface ChannelSidebarProps {
  onSelectConversation?: () => void;
  className?: string;
}

export function ChannelSidebar({
  onSelectConversation,
  className,
}: ChannelSidebarProps = {}) {
  const {
    channels,
    directPeers,
    activeConversation,
    setActiveConversation,
    connectionStatus,
    isConnecting,
    reconnect,
    summaries,
    onlineUserIds,
  } = useNexconnChat();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const filteredPeers = directPeers.filter(
    (p) =>
      p.fullName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      p.email.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      className={cn(
        "w-full md:w-[272px] lg:w-[288px] shrink-0 border-r border-[var(--spark-border)] bg-[var(--spark-canvas)]/70 dark:bg-[var(--spark-surface)] flex flex-col justify-between select-none transition-colors duration-150",
        className
      )}
    >
      {/* Top Header */}
      <div>
        <div className="h-[52px] px-3.5 border-b border-[var(--spark-border)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--spark-text-primary)] tracking-tight">
            Conversations
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1.5 rounded-[6px] text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] transition-colors duration-150"
            title="Create a new channel"
            aria-label="Create channel"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="px-3 pt-3 pb-1.5">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--spark-text-muted)] pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-[6px] bg-[var(--spark-surface)] dark:bg-[var(--spark-canvas)] border border-[var(--spark-border)] text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)] focus:ring-1 focus:ring-[var(--spark-accent)] transition-all duration-150"
            />
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="p-2.5 overflow-y-auto flex-1 space-y-5">
        {/* Channels */}
        <div>
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
            <span>Channels</span>
            <span className="text-[10px] font-medium tabular-nums">
              {filteredChannels.length}
            </span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredChannels.map((c) => {
              const isActive =
                activeConversation?.type === "channel" &&
                activeConversation.id === c.id;

              const summary = summaries[`channel:${c.nexconnChannelId}`];
              const unread = summary?.unreadCount || 0;

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveConversation({
                      type: "channel",
                      id: c.id,
                      name: c.name,
                      nexconnTargetId: c.nexconnChannelId,
                      description: c.description,
                      isPrivate: c.type === "PRIVATE",
                    });
                    onSelectConversation?.();
                  }}
                  className={cn(
                    "flex w-full items-start justify-between rounded-[8px] px-2.5 py-2 text-xs transition-colors duration-150 text-left group",
                    isActive
                      ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-medium"
                      : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)]"
                  )}
                >
                  <div className="flex items-start gap-2 truncate min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {c.type === "PRIVATE" ? (
                        <Lock
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive
                              ? "text-[var(--spark-accent)]"
                              : "text-[var(--spark-text-muted)]"
                          )}
                        />
                      ) : (
                        <Hash
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive
                              ? "text-[var(--spark-accent)]"
                              : "text-[var(--spark-text-muted)]"
                          )}
                        />
                      )}
                    </div>
                    <div className="truncate min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "truncate",
                            unread > 0 && "font-bold text-[var(--spark-text-primary)]"
                          )}
                        >
                          {c.name}
                        </span>
                        {summary?.lastMessageTime && (
                          <span className="text-[10px] text-[var(--spark-text-muted)] shrink-0 font-normal">
                            {summary.lastMessageTime}
                          </span>
                        )}
                      </div>

                      {summary?.lastMessageText ? (
                        <p
                          className={cn(
                            "text-[11px] truncate mt-0.5",
                            unread > 0
                              ? "font-semibold text-[var(--spark-text-primary)]"
                              : "text-[var(--spark-text-muted)] font-normal"
                          )}
                        >
                          {summary.lastSenderName && summary.lastSenderName !== "You"
                            ? `${summary.lastSenderName}: `
                            : ""}
                          {summary.lastMessageText}
                        </p>
                      ) : c.description ? (
                        <p className="text-[11px] text-[var(--spark-text-muted)] font-normal truncate mt-0.5">
                          {c.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {unread > 0 && (
                    <span className="ml-1.5 shrink-0 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-bold bg-[var(--spark-accent)] text-white shadow-2xs">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages */}
        <div>
          <div className="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
            <span>Direct Messages</span>
            <span className="text-[10px] font-medium tabular-nums">
              {filteredPeers.length}
            </span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredPeers.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-[var(--spark-text-muted)] font-normal italic">
                No direct messages
              </div>
            ) : (
              filteredPeers.map((peer) => {
                const isActive =
                  activeConversation?.type === "direct" &&
                  activeConversation.id === peer.id;

                const summary = summaries[`direct:${peer.id}`];
                const unread = summary?.unreadCount || 0;
                const isTyping = summary?.isTyping || false;

                return (
                  <button
                    key={peer.id}
                    onClick={() => {
                      setActiveConversation({
                        type: "direct",
                        id: peer.id,
                        name: peer.fullName,
                        nexconnTargetId: peer.id,
                        peer,
                      });
                      onSelectConversation?.();
                    }}
                    className={cn(
                      "flex w-full items-start justify-between rounded-[8px] px-2.5 py-2 text-xs transition-colors duration-150 text-left group",
                      isActive
                        ? "bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] font-medium"
                        : "text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)]"
                    )}
                  >
                    <div className="flex items-start gap-2.5 truncate min-w-0 flex-1">
                      <div className="relative shrink-0 mt-0.5">
                        <Avatar
                          name={peer.fullName}
                          size="sm"
                          src={peer.avatarUrl || undefined}
                        />
                        {onlineUserIds[peer.id] && (
                          <span
                            className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[#10B981] ring-2 ring-[var(--spark-surface)]"
                            title="Online"
                          />
                        )}
                      </div>

                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={cn(
                              "truncate",
                              unread > 0 && "font-bold text-[var(--spark-text-primary)]"
                            )}
                          >
                            {peer.fullName}
                          </span>
                          {summary?.lastMessageTime && (
                            <span className="text-[10px] text-[var(--spark-text-muted)] shrink-0 font-normal">
                              {summary.lastMessageTime}
                            </span>
                          )}
                        </div>

                        {isTyping ? (
                          <p className="text-[11px] text-[var(--spark-accent)] font-medium italic animate-pulse mt-0.5">
                            typing...
                          </p>
                        ) : summary?.lastMessageText ? (
                          <p
                            className={cn(
                              "text-[11px] truncate mt-0.5",
                              unread > 0
                                ? "font-semibold text-[var(--spark-text-primary)]"
                                : "text-[var(--spark-text-muted)] font-normal"
                            )}
                          >
                            {summary.lastSenderName === "You" ? "You: " : ""}
                            {summary.lastMessageText}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[var(--spark-text-muted)] font-normal truncate mt-0.5">
                            {peer.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {unread > 0 && (
                      <span className="ml-1.5 shrink-0 inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10px] font-bold bg-[var(--spark-accent)] text-white shadow-2xs">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer Connection Status */}
      <div className="px-3.5 py-2.5 border-t border-[var(--spark-border)] bg-[var(--spark-surface)] flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          {connectionStatus === "CONNECTED" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.65)]" />
              <span className="font-medium text-[var(--spark-text-secondary)]">
                Nexconn Connected
              </span>
            </>
          ) : isConnecting ? (
            <>
              <span className="h-2 w-2 rounded-full bg-[#F59E0B] animate-ping" />
              <span className="font-medium text-amber-600 dark:text-amber-400">
                Connecting...
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="font-medium text-rose-600 dark:text-rose-400">
                Disconnected
              </span>
            </>
          )}
        </div>

        {connectionStatus !== "CONNECTED" && !isConnecting && (
          <button
            onClick={() => reconnect()}
            className="p-1 rounded-[6px] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
            title="Reconnect"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
      </div>

      <CreateChannelModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
