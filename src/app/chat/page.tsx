"use client";

import React, { useState, useEffect } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { ChannelSidebar } from "@/components/chat/ChannelSidebar";
import { ConversationHeader } from "@/components/chat/ConversationHeader";
import { MessageStream } from "@/components/chat/MessageStream";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ChannelDetailsDrawer } from "@/components/chat/ChannelDetailsDrawer";
import { useNexconnChat } from "@/components/chat/NexconnChatProvider";
import { cn } from "@/lib/utils";

function ChatInner() {
  const { setIsConversationVisible } = useNexconnChat();
  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Keep read receipts accurate on mobile: never mark Seen while sitting on the Conversations List
  useEffect(() => {
    const syncVisibility = () => {
      const isDesktop = window.innerWidth >= 768;
      setIsConversationVisible(isDesktop || mobileView === "chat");
    };
    syncVisibility();
    window.addEventListener("resize", syncVisibility);
    return () => {
      window.removeEventListener("resize", syncVisibility);
      setIsConversationVisible(false);
    };
  }, [mobileView, setIsConversationVisible]);

  return (
    <div className="relative flex h-[calc(100dvh-96px)] sm:h-[calc(100vh-100px)] overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-2xs">
      {/* Left Column: Channels & DMs */}
      <ChannelSidebar
        onSelectConversation={() => setMobileView("chat")}
        className={cn(mobileView === "chat" ? "hidden md:flex" : "flex")}
      />

      {/* Center Column: Header, Messages, Composer */}
      <div
        className={cn(
          "flex flex-1 flex-col justify-between min-w-0 bg-white",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}
      >
        <ConversationHeader
          showRightPanel={showRightPanel}
          onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
          onBackToList={() => setMobileView("list")}
        />
        <MessageStream />
        <MessageComposer />
      </div>

      {/* Right Column: Channel Details & Pinned Resources */}
      {showRightPanel && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/30 xl:hidden"
            onClick={() => setShowRightPanel(false)}
          />
          <div className="fixed inset-y-0 right-0 z-40 flex xl:static xl:z-auto shadow-xl xl:shadow-none">
            <ChannelDetailsDrawer />
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <ShellLayout>
      <ChatInner />
    </ShellLayout>
  );
}
