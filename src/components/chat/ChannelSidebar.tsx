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
        "w-full md:w-64 lg:w-72 shrink-0 border-r border-slate-200 bg-slate-50/60 flex flex-col justify-between select-none",
        className
      )}
    >
      {/* Top Header */}
      <div>
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-900 tracking-tight">
            Conversations
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
            title="Create a new channel"
            aria-label="Create channel"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Search */}
        <div className="px-2.5 pt-2.5 pb-1">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-md bg-white border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Lists */}
      <div className="p-2 overflow-y-auto flex-1 space-y-4">
        {/* Channels */}
        <div>
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Channels</span>
            <span className="text-[10px] text-slate-400 font-normal">{filteredChannels.length}</span>
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
                    "flex w-full items-start justify-between rounded-lg p-2 text-xs transition-colors text-left group",
                    isActive
                      ? "bg-blue-50 text-blue-900 font-medium shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-start gap-2 truncate min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      {c.type === "PRIVATE" ? (
                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <Hash className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </div>
                    <div className="truncate min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("truncate", unread > 0 && "font-bold text-slate-900")}>
                          {c.name}
                        </span>
                        {summary?.lastMessageTime && (
                          <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                            {summary.lastMessageTime}
                          </span>
                        )}
                      </div>

                      {summary?.lastMessageText ? (
                        <p className={cn("text-[11px] truncate mt-0.5", unread > 0 ? "font-semibold text-slate-800" : "text-slate-400 font-normal")}>
                          {summary.lastSenderName && summary.lastSenderName !== "You" ? `${summary.lastSenderName}: ` : ""}
                          {summary.lastMessageText}
                        </p>
                      ) : c.description ? (
                        <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                          {c.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {unread > 0 && (
                    <span className="ml-1.5 shrink-0 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
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
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span>Direct Messages</span>
            <span className="text-[10px] text-slate-400 font-normal">{filteredPeers.length}</span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredPeers.length === 0 ? (
              <div className="px-2 py-1 text-[11px] text-slate-400 font-normal italic">
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
                        nexconnTargetId: peer.id, // Peer's User ID
                        peer,
                      });
                      onSelectConversation?.();
                    }}
                    className={cn(
                      "flex w-full items-start justify-between rounded-lg p-2 text-xs transition-colors text-left group",
                      isActive
                        ? "bg-blue-50 text-blue-900 font-medium shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-start gap-2.5 truncate min-w-0 flex-1">
                      <div className="relative shrink-0 mt-0.5">
                        <Avatar name={peer.fullName} size="sm" src={peer.avatarUrl || undefined} />
                        {onlineUserIds[peer.id] && (
                          <span
                            className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                            title="Online"
                          />
                        )}
                      </div>

                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("truncate", unread > 0 && "font-bold text-slate-900")}>
                            {peer.fullName}
                          </span>
                          {summary?.lastMessageTime && (
                            <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                              {summary.lastMessageTime}
                            </span>
                          )}
                        </div>

                        {isTyping ? (
                          <p className="text-[11px] text-blue-600 font-medium italic animate-pulse mt-0.5">
                            typing...
                          </p>
                        ) : summary?.lastMessageText ? (
                          <p className={cn("text-[11px] truncate mt-0.5", unread > 0 ? "font-semibold text-slate-800" : "text-slate-400 font-normal")}>
                            {summary.lastSenderName === "You" ? "You: " : ""}
                            {summary.lastMessageText}
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-normal truncate mt-0.5">
                            {peer.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {unread > 0 && (
                      <span className="ml-1.5 shrink-0 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-xs">
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
      <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          {connectionStatus === "CONNECTED" ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-700">Nexconn Connected</span>
            </>
          ) : isConnecting ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span className="font-medium text-amber-700">Connecting...</span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="font-medium text-rose-700">Disconnected</span>
            </>
          )}
        </div>

        {connectionStatus !== "CONNECTED" && !isConnecting && (
          <button
            onClick={() => reconnect()}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
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
