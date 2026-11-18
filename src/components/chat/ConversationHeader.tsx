"use client";

import React from "react";
import { Hash, Lock, Info, Users, ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useNexconnChat } from "./NexconnChatProvider";
import { cn } from "@/lib/utils";

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
  const { activeConversation, channelDetails, onlineUserIds } = useNexconnChat();

  if (!activeConversation) {
    return (
      <div className="flex h-12 items-center border-b border-slate-200 px-4 bg-white">
        <span className="text-xs text-slate-400">Select a conversation to start chatting</span>
      </div>
    );
  }

  const isChannel = activeConversation.type === "channel";

  return (
    <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 bg-white select-none">
      <div className="flex items-center gap-2.5 truncate min-w-0">
        {onBackToList && (
          <button
            type="button"
            onClick={onBackToList}
            className="md:hidden p-1.5 -ml-1 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {isChannel ? (
          activeConversation.isPrivate ? (
            <Lock className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <Hash className="h-4 w-4 text-slate-500 shrink-0" />
          )
        ) : (
          <div className="relative shrink-0">
            <Avatar
              name={activeConversation.name}
              size="sm"
              src={activeConversation.peer?.avatarUrl || undefined}
            />
            {onlineUserIds[activeConversation.nexconnTargetId] && (
              <span
                className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                title="Online"
              />
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 truncate">
          <span className="text-xs font-semibold text-slate-900 truncate">
            {activeConversation.name}
          </span>

          {isChannel && activeConversation.description && (
            <span className="text-xs text-slate-400 font-normal truncate hidden md:inline">
              · {activeConversation.description}
            </span>
          )}

          {!isChannel && activeConversation.peer?.email && (
            <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">
              ({activeConversation.peer.email})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isChannel && channelDetails && (
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 font-medium mr-2">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>{channelDetails.members.length + 1} members</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleRightPanel}
          className={cn(
            "p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors",
            showRightPanel && "bg-slate-100 text-slate-900 font-semibold"
          )}
          title="Toggle conversation details"
          aria-label="Toggle details"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

