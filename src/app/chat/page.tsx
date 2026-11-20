"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { ChannelSidebar } from "@/components/chat/ChannelSidebar";
import { ConversationHeader } from "@/components/chat/ConversationHeader";
import { MessageStream } from "@/components/chat/MessageStream";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { ChannelDetailsDrawer } from "@/components/chat/ChannelDetailsDrawer";
import { useNexconnChat } from "@/components/chat/NexconnChatProvider";
import { useWorkspace } from "@/lib/workspace-context";
import { getWorkspaceDirectMessagePeers, DirectMessagePeerItem } from "@/lib/actions/chat-direct";
import { generateRoomCode } from "@/lib/room-code";
import { VideoRoomModal } from "@/components/meet/VideoRoomModal";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function ChatInner() {
  const {
    activeConversation,
    setActiveConversation,
    directPeers,
    channels,
    setIsConversationVisible,
  } = useNexconnChat();
  const { activeWorkspace, currentUser } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [showRightPanel, setShowRightPanel] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // 1-on-1 Direct Call state inside DM
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [callRoomCode, setCallRoomCode] = useState("");
  const [callType, setCallType] = useState<"VOICE" | "VIDEO">("VIDEO");
  const [callReceiver, setCallReceiver] = useState<{
    id: string;
    fullName: string;
    email?: string;
    avatarUrl?: string | null;
  } | null>(null);

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

  // Handler to initiate 1-on-1 call from chat header or parameter
  const startDirectCallToPeer = (
    peer: { id: string; fullName: string; email?: string; avatarUrl?: string | null },
    type: "VOICE" | "VIDEO",
    existingRoomCode?: string
  ) => {
    const roomCode = existingRoomCode || generateRoomCode();
    setCallRoomCode(roomCode);
    setCallType(type);
    setCallReceiver(peer);
    setIsCallOpen(true);

    // If initiating a new call (not answering existing), broadcast to the peer's personal channel
    if (!existingRoomCode && currentUser?.id) {
      try {
        const supabase = createClient();
        const peerChan = supabase.channel(`spark-user-calls:${peer.id}`);
        peerChan.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            peerChan.send({
              type: "broadcast",
              event: "incoming-call",
              payload: {
                callerId: currentUser.id,
                callerName: currentUser.name || "Teammate",
                callerAvatar: currentUser.avatarUrl,
                callType: type,
                roomCode,
              },
            });
            setTimeout(() => supabase.removeChannel(peerChan), 2000);
          }
        });
      } catch (err) {
        console.warn("Could not broadcast incoming call:", err);
      }
    }
  };

  // Process searchParams for direct message redirection (?dm=userId&call=video or ?activeCall=...)
  const processedParamRef = useRef<string | null>(null);

  useEffect(() => {
    const dmUserId = searchParams.get("dm");
    const callParam = searchParams.get("call") as "voice" | "video" | null;
    const activeCall = searchParams.get("activeCall");
    const callTypeParam = (searchParams.get("type") as "voice" | "video" | null) || "video";

    if (!dmUserId || !activeWorkspace?.id || activeWorkspace.id === "personal-fallback") {
      return;
    }

    const paramKey = `${dmUserId}:${callParam || ""}:${activeCall || ""}`;
    if (processedParamRef.current === paramKey) return;
    processedParamRef.current = paramKey;

    async function resolvePeerAndStart() {
      // 1. Find peer from existing directPeers or fetch from workspace
      let targetPeer = directPeers.find((p) => p.id === dmUserId);
      if (!targetPeer && activeWorkspace?.id) {
        try {
          const res = await getWorkspaceDirectMessagePeers(activeWorkspace.id);
          targetPeer = res.peers.find((p) => p.id === dmUserId);
        } catch {}
      }

      if (targetPeer) {
        // Set active conversation to this user's direct message
        setActiveConversation({
          type: "direct",
          id: targetPeer.id,
          name: targetPeer.fullName,
          nexconnTargetId: targetPeer.id,
          peer: targetPeer,
        });
        setMobileView("chat");

        // If caller initiated a 1-on-1 call
        if (callParam) {
          startDirectCallToPeer(
            targetPeer,
            callParam === "voice" ? "VOICE" : "VIDEO"
          );
        }
        // If recipient accepted an incoming call
        else if (activeCall) {
          startDirectCallToPeer(
            targetPeer,
            callTypeParam === "voice" ? "VOICE" : "VIDEO",
            activeCall
          );
        }

        // Clean up URL parameters cleanly
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/chat");
        }
      }
    }

    resolvePeerAndStart();
  }, [searchParams, activeWorkspace?.id, directPeers, setActiveConversation]);

  // Auto-select default channel (#general) if activeConversation is null and no direct message was requested
  useEffect(() => {
    if (!searchParams.get("dm") && !activeConversation && channels.length > 0) {
      const defaultChan = channels.find((c) => c.isDefault) || channels[0];
      if (defaultChan) {
        setActiveConversation({
          type: "channel",
          id: defaultChan.id,
          name: defaultChan.name,
          nexconnTargetId: defaultChan.nexconnChannelId,
          description: defaultChan.description,
          isPrivate: defaultChan.type === "PRIVATE",
        });
      }
    }
  }, [searchParams, activeConversation, channels, setActiveConversation]);

  return (
    <div className="relative flex h-[calc(100dvh-76px)] sm:h-[calc(100vh-90px)] overflow-hidden rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] shadow-subtle transition-colors duration-150">
      {/* Contextual Secondary Sidebar: Channels & Direct Messages */}
      <ChannelSidebar
        onSelectConversation={() => setMobileView("chat")}
        className={cn(mobileView === "chat" ? "hidden md:flex" : "flex")}
      />

      {/* Main Workspace Canvas: Header, Messages, Composer */}
      <div
        className={cn(
          "flex flex-1 flex-col justify-between min-w-0 bg-[var(--spark-surface)]",
          mobileView === "list" ? "hidden md:flex" : "flex"
        )}
      >
        <ConversationHeader
          showRightPanel={showRightPanel}
          onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
          onBackToList={() => setMobileView("list")}
          onStartCall={(type) => {
            if (activeConversation?.peer) {
              startDirectCallToPeer(activeConversation.peer, type);
            }
          }}
        />
        <MessageStream />
        <MessageComposer />
      </div>

      {/* Right Slide-Over Panel: Channel Details & Pinned Resources */}
      {showRightPanel && (
        <>
          <div
            className="fixed inset-0 z-30 bg-[#0D0B14]/50 backdrop-blur-[2px] xl:hidden"
            onClick={() => setShowRightPanel(false)}
          />
          <div className="fixed inset-y-0 right-0 z-40 flex xl:static xl:z-auto shadow-modal xl:shadow-none">
            <ChannelDetailsDrawer />
          </div>
        </>
      )}

      {/* 1-on-1 Direct Call Room in Chat */}
      {isCallOpen && (
        <VideoRoomModal
          isOpen={isCallOpen}
          onClose={() => setIsCallOpen(false)}
          workspaceId={activeWorkspace?.id || ""}
          roomCode={callRoomCode}
          roomTitle={callReceiver ? `Call with ${callReceiver.fullName}` : "Direct Call"}
          callType={callType}
          currentUser={currentUser}
          receiver={callReceiver}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <ShellLayout>
      <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--spark-text-muted)]">Loading conversations...</div>}>
        <ChatInner />
      </Suspense>
    </ShellLayout>
  );
}
