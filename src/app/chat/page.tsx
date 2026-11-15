"use client";

import React, { useState } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { NexconnChatProvider } from "@/components/chat/NexconnChatProvider";
import { ChannelSidebar } from "@/components/chat/ChannelSidebar";
import { ConversationHeader } from "@/components/chat/ConversationHeader";
import { MessageStream } from "@/components/chat/MessageStream";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ChannelDetailsDrawer } from "@/components/chat/ChannelDetailsDrawer";

function ChatInner() {
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-2xs">
      {/* Left Column: Channels & DMs */}
      <ChannelSidebar />

      {/* Center Column: Header, Messages, Composer */}
      <div className="flex flex-1 flex-col justify-between min-w-0 bg-white">
        <ConversationHeader
          showRightPanel={showRightPanel}
          onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
        />
        <MessageStream />
        <MessageComposer />
      </div>

      {/* Right Column: Channel Details & Pinned Resources */}
      {showRightPanel && <ChannelDetailsDrawer />}
    </div>
  );
}

export default function ChatPage() {
  return (
    <ShellLayout>
      <NexconnChatProvider>
        <ChatInner />
      </NexconnChatProvider>
    </ShellLayout>
  );
}
