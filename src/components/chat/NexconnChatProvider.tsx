"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  ChatChannelItem,
  getWorkspaceChannels,
  getChannelDetails,
} from "@/lib/actions/chat-channels";
import {
  DirectMessagePeerItem,
  getWorkspaceDirectMessagePeers,
  getOrCreateDirectConversation,
} from "@/lib/actions/chat-direct";
import {
  ActiveConversation,
  ChatMessageItem,
  ChannelDetailsData,
} from "./types";

interface NexconnChatContextValue {
  isReady: boolean;
  isConnecting: boolean;
  connectionStatus: string;
  connectionError: string | null;
  currentUserId: string | null;
  channels: ChatChannelItem[];
  directPeers: DirectMessagePeerItem[];
  activeConversation: ActiveConversation | null;
  setActiveConversation: (conv: ActiveConversation | null) => void;
  messages: ChatMessageItem[];
  isLoadingMessages: boolean;
  channelDetails: ChannelDetailsData | null;
  sendMessage: (text: string) => Promise<boolean>;
  sendMedia: (file: File) => Promise<boolean>;
  refreshChannels: () => Promise<void>;
  refreshDirectPeers: () => Promise<void>;
  reconnect: () => Promise<void>;
}

const NexconnChatContext = createContext<NexconnChatContextValue | null>(null);

export function useNexconnChat() {
  const ctx = useContext(NexconnChatContext);
  if (!ctx) {
    throw new Error("useNexconnChat must be used within a NexconnChatProvider");
  }
  return ctx;
}

export function NexconnChatProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("DISCONNECTED");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [channels, setChannels] = useState<ChatChannelItem[]>([]);
  const [directPeers, setDirectPeers] = useState<DirectMessagePeerItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [channelDetails, setChannelDetails] = useState<ChannelDetailsData | null>(null);

  const activeConvRef = useRef<ActiveConversation | null>(null);
  activeConvRef.current = activeConversation;

  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;

  // 1. Load Channels and Direct Peers for the active workspace
  const refreshChannels = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") return;
    const res = await getWorkspaceChannels(activeWorkspace.id);
    if (res.channels) {
      setChannels(res.channels);
      // Auto-select default #general channel if no conversation is currently selected
      if (!activeConvRef.current && res.channels.length > 0) {
        const defaultChan = res.channels.find((c) => c.isDefault) || res.channels[0];
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
    }
  }, [activeWorkspace?.id]);

  const refreshDirectPeers = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") return;
    const res = await getWorkspaceDirectMessagePeers(activeWorkspace.id);
    if (res.peers) {
      setDirectPeers(res.peers);
    }
  }, [activeWorkspace?.id]);

  // 2. Initialize and Connect Nexconn Client
  const connectNexconn = useCallback(async () => {
    if (!activeWorkspace?.id || activeWorkspace.id === "personal-fallback") return;

    try {
      setIsConnecting(true);
      setConnectionError(null);
      setConnectionStatus("CONNECTING");

      // Dynamic import to ensure browser-only execution
      const {
        NCEngine,
        ConnectionStatusHandler,
        MessageHandler,
        AreaCode,
        LogLevel,
      } = await import("@nexconn/chat");

      const appKey = process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
      if (!appKey) {
        throw new Error("NEXT_PUBLIC_NEXCONN_APP_KEY is not configured.");
      }

      // Initialize Engine once
      try {
        NCEngine.initialize({
          appKey,
          logLevel: LogLevel.WARN,
          areaCode: AreaCode.SG,
        });
      } catch {
        // Safe if already initialized
      }

      // Register connection status handler
      NCEngine.addConnectionStatusHandler(
        "spark-connection-handler",
        new ConnectionStatusHandler({
          onConnectionStatusChanged({ status }: { status: any }) {
            const statusStr = String(status);
            setConnectionStatus(statusStr === "0" ? "CONNECTED" : statusStr);
          },
        })
      );

      // Register global incoming message handler
      NCEngine.addMessageHandler(
        "spark-global-message-handler",
        new MessageHandler({
          onMessageReceived(event) {
            const incomingList = event.messages || [];
            if (incomingList.length === 0) return;

            const active = activeConvRef.current;
            const myId = currentUserIdRef.current;

            for (const msg of incomingList) {
              const isMe = msg.senderUserId === myId;
              let matchesCurrent = false;

              if (active) {
                if (active.type === "channel") {
                  matchesCurrent = msg.channelIdentifier?.channelId === active.nexconnTargetId;
                } else if (active.type === "direct") {
                  const peerId = isMe ? msg.channelIdentifier?.channelId : msg.senderUserId;
                  matchesCurrent = peerId === active.nexconnTargetId;
                }
              }

              if (matchesCurrent) {
                const formattedMsg: ChatMessageItem = {
                  id: msg.messageId || `msg_${Date.now()}_${Math.random()}`,
                  senderId: msg.senderUserId,
                  senderName: isMe ? "You" : (active?.type === "direct" ? active.name : msg.senderUserId),
                  text: (msg.content as any)?.text || "",
                  time: new Date(msg.sentTime || Date.now()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                  timestamp: msg.sentTime || Date.now(),
                  isMe,
                  messageType: msg.messageType || "RC:TxtMsg",
                  fileInfo: (msg.content as any)?.fileUrl
                    ? {
                        name: (msg.content as any)?.name || "Attachment",
                        url: (msg.content as any)?.fileUrl,
                        size: (msg.content as any)?.size,
                        type: msg.messageType === "RC:ImgMsg" ? "image" : "file",
                      }
                    : undefined,
                };

                setMessages((prev) => {
                  if (prev.some((m) => m.id === formattedMsg.id)) return prev;
                  return [...prev, formattedMsg];
                });
              }
            }
          },
        })
      );

      // Fetch workspace-scoped token from server
      const tokenRes = await fetch("/api/chat/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace.id }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error || "Failed to obtain chat token.");
      }

      setCurrentUserId(tokenData.userId);

      // Connect socket session
      const connectResult = await NCEngine.connect({ token: tokenData.token });
      if (connectResult && !connectResult.isOk) {
        throw new Error(connectResult.msg || "Failed to connect to Nexconn.");
      }

      setIsReady(true);
      setConnectionStatus("CONNECTED");
    } catch (err: any) {
      console.error("[Nexconn Client Connection Error]:", err?.message || err);
      setConnectionError(err.message || "Connection failed.");
      setConnectionStatus("DISCONNECTED");
      setIsReady(false);
    } finally {
      setIsConnecting(false);
    }
  }, [activeWorkspace?.id]);

  // 3. Manage lifecycle on mount and workspace change
  useEffect(() => {
    refreshChannels();
    refreshDirectPeers();
    connectNexconn();

    return () => {
      // Disconnect previous session on workspace transition or unmount
      import("@nexconn/chat").then(({ NCEngine }) => {
        try {
          NCEngine.disconnect();
          NCEngine.removeConnectionStatusHandler("spark-connection-handler");
          NCEngine.removeMessageHandler("spark-global-message-handler");
        } catch {
          // Safe ignore on teardown
        }
      });
      setIsReady(false);
      setConnectionStatus("DISCONNECTED");
    };
  }, [activeWorkspace?.id, refreshChannels, refreshDirectPeers, connectNexconn]);

  // 4. Load message history when active conversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setChannelDetails(null);
      return;
    }

    let isCancelled = false;

    async function loadHistory() {
      setIsLoadingMessages(true);
      try {
        const {
          BaseChannel,
          GroupChannelIdentifier,
          DirectChannelIdentifier,
        } = await import("@nexconn/chat");

        const identifier =
          activeConversation?.type === "channel"
            ? new GroupChannelIdentifier(activeConversation.nexconnTargetId)
            : new DirectChannelIdentifier(activeConversation!.nexconnTargetId);

        const query = BaseChannel.createMessagesQuery({
          channelIdentifier: identifier,
          pageSize: 40,
        });

        const result = await query.loadNextPage();

        if (!isCancelled && result && result.isOk && result.data) {
          const list: any[] = (result.data as any).messages || (Array.isArray(result.data) ? result.data : []);
          const myId = currentUserIdRef.current;

          const formatted: ChatMessageItem[] = list.map((msg: any) => {
            const isMe = msg.senderUserId === myId;
            return {
              id: msg.messageId || `msg_${msg.sentTime}_${Math.random()}`,
              senderId: msg.senderUserId,
              senderName: isMe ? "You" : (activeConversation?.type === "direct" ? activeConversation.name : msg.senderUserId),
              text: msg.content?.text || "",
              time: new Date(msg.sentTime || Date.now()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              timestamp: msg.sentTime || Date.now(),
              isMe,
              messageType: msg.messageType || "RC:TxtMsg",
              fileInfo: msg.content?.fileUrl
                ? {
                    name: msg.content.name || "Attachment",
                    url: msg.content.fileUrl,
                    size: msg.content.size,
                    type: msg.messageType === "RC:ImgMsg" ? "image" : "file",
                  }
                : undefined,
            };
          });

          // Sort ascending by timestamp
          formatted.sort((a, b) => a.timestamp - b.timestamp);
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Failed to load message history:", err);
      } finally {
        if (!isCancelled) setIsLoadingMessages(false);
      }
    }

    loadHistory();

    // If channel, load full details
    if (activeConversation.type === "channel" && activeWorkspace?.id) {
      getChannelDetails(activeWorkspace.id, activeConversation.id).then((res) => {
        if (!isCancelled && res.channel) {
          setChannelDetails(res.channel as any);
        }
      });
    } else {
      setChannelDetails(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [activeConversation, activeWorkspace?.id]);

  // 5. Send Text Message
  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const active = activeConversation;
      if (!active || !text.trim()) return false;

      const myId = currentUserIdRef.current;
      const optimisticId = `opt_${Date.now()}`;
      const trimmedText = text.trim();

      // Optimistic local update
      const optimisticMsg: ChatMessageItem = {
        id: optimisticId,
        senderId: myId || "me",
        senderName: "You",
        text: trimmedText,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        isMe: true,
        messageType: "RC:TxtMsg",
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const {
          GroupChannel,
          DirectChannel,
          SendTextMessageParams,
        } = await import("@nexconn/chat");

        const params = new SendTextMessageParams({ text: trimmedText });

        if (active.type === "channel") {
          const channel = new GroupChannel(active.nexconnTargetId);
          const res = await channel.sendMessage(params);
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send message to channel.");
          }
        } else {
          const channel = new DirectChannel(active.nexconnTargetId);
          const res = await channel.sendMessage(params);
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send direct message.");
          }

          // Record or bump direct conversation in SPARK database
          if (activeWorkspace?.id) {
            await getOrCreateDirectConversation(activeWorkspace.id, active.nexconnTargetId);
          }
        }

        return true;
      } catch (err: any) {
        console.error("Failed to send message:", err);
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return false;
      }
    },
    [activeConversation, activeWorkspace?.id]
  );

  // 6. Send Media / Attachment
  const sendMedia = useCallback(
    async (file: File): Promise<boolean> => {
      const active = activeConversation;
      if (!active || !file) return false;

      try {
        const {
          GroupChannel,
          DirectChannel,
          Helper,
        } = await import("@nexconn/chat");

        const isImage = file.type.startsWith("image/");
        let params: any;

        if (isImage) {
          const imageRes = await Helper.createSendImageMessageParams(file);
          if (imageRes.isOk && imageRes.data) {
            params = imageRes.data;
          }
        }

        if (!params) {
          const fileRes = await Helper.createSendFileMessageParams(file);
          if (fileRes.isOk && fileRes.data) {
            params = fileRes.data;
          }
        }

        if (!params) {
          throw new Error("Failed to prepare file parameters.");
        }

        if (active.type === "channel") {
          const channel = new GroupChannel(active.nexconnTargetId);
          const res = await channel.sendMediaMessage(params);
          if (res && !res.isOk) throw new Error(res.msg);
        } else {
          const channel = new DirectChannel(active.nexconnTargetId);
          const res = await channel.sendMediaMessage(params);
          if (res && !res.isOk) throw new Error(res.msg);
        }

        return true;
      } catch (err: any) {
        console.error("Failed to send attachment:", err);
        return false;
      }
    },
    [activeConversation]
  );

  return (
    <NexconnChatContext.Provider
      value={{
        isReady,
        isConnecting,
        connectionStatus,
        connectionError,
        currentUserId,
        channels,
        directPeers,
        activeConversation,
        setActiveConversation,
        messages,
        isLoadingMessages,
        channelDetails,
        sendMessage,
        sendMedia,
        refreshChannels,
        refreshDirectPeers,
        reconnect: connectNexconn,
      }}
    >
      {children}
    </NexconnChatContext.Provider>
  );
}
