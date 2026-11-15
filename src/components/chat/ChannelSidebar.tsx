"use client";

import React, { useState } from "react";
import { Hash, Lock, Plus, Radio, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useNexconnChat } from "./NexconnChatProvider";
import { CreateChannelModal } from "./CreateChannelModal";
import { cn } from "@/lib/utils";

export function ChannelSidebar() {
  const {
    channels,
    directPeers,
    activeConversation,
    setActiveConversation,
    connectionStatus,
    isConnecting,
    reconnect,
  } = useNexconnChat();

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="w-60 sm:w-64 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-between select-none">
      {/* Top Header */}
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
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lists */}
      <div className="p-2 overflow-y-auto flex-1 space-y-4">
        {/* Channels */}
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Channels
          </div>
          <div className="mt-1 space-y-0.5">
            {channels.map((c) => {
              const isActive =
                activeConversation?.type === "channel" &&
                activeConversation.id === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() =>
                    setActiveConversation({
                      type: "channel",
                      id: c.id,
                      name: c.name,
                      nexconnTargetId: c.nexconnChannelId,
                      description: c.description,
                      isPrivate: c.type === "PRIVATE",
                    })
                  }
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-left",
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {c.type === "PRIVATE" ? (
                      <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                  </div>
                  {c.isDefault && (
                    <span className="text-[10px] text-slate-400 font-normal shrink-0">
                      general
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages */}
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Direct Messages
          </div>
          <div className="mt-1 space-y-0.5">
            {directPeers.length === 0 ? (
              <div className="px-2 py-1 text-[11px] text-slate-400 font-normal italic">
                No other members in workspace
              </div>
            ) : (
              directPeers.map((peer) => {
                const isActive =
                  activeConversation?.type === "direct" &&
                  activeConversation.id === peer.id;

                return (
                  <button
                    key={peer.id}
                    onClick={() =>
                      setActiveConversation({
                        type: "direct",
                        id: peer.id,
                        name: peer.fullName,
                        nexconnTargetId: peer.id, // Peer's User ID
                        peer,
                      })
                    }
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-left",
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Avatar name={peer.fullName} size="sm" src={peer.avatarUrl || undefined} />
                      <span className="truncate">{peer.fullName}</span>
                    </div>
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

