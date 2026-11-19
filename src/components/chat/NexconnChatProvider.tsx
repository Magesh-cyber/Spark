"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
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
import { recordChatNotification } from "@/lib/actions/notifications";
import { clientChatCache, clientMembersCache } from "@/lib/client-caches";
import { subscribeBootstrap } from "@/lib/bootstrap-client";
import { createClient } from "@/lib/supabase/client";
import {
  decodeMediaMessage,
  encodeMediaMessage,
  encodeRichMessage,
  getMediaKindFromMime,
  getMediaSummaryLabel,
  getHandoverSummaryLabel,
  type SparkMediaEnvelope,
} from "@/lib/chat-media-envelope";
import {
  acknowledgeShiftHandover,
  getChannelHandoverAcknowledgments,
  notifyNewShiftHandover,
} from "@/lib/actions/chat-handover";
import type { ReadCursorEntry } from "@/app/api/chat/read-receipts/route";
import {
  ActiveConversation,
  ChatMessageItem,
  ChannelDetailsData,
  ConversationSummary,
  MessageSeenEntry,
  MessageReplyInfo,
  HandoverReportData,
  HandoverSignOff,
} from "./types";

export interface NexconnChatContextValue {
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
  sendMessage: (text: string, replyTo?: MessageReplyInfo, handoverData?: HandoverReportData) => Promise<boolean>;
  sendMedia: (file: File, caption?: string) => Promise<{ success: boolean; error?: string }>;
  replyingTo: MessageReplyInfo | null;
  setReplyingTo: (reply: MessageReplyInfo | null) => void;
  handoverAcks: Record<string, HandoverSignOff[]>;
  acknowledgeHandover: (messageId: string, shiftPeriod: string, handoverAuthorId?: string) => Promise<boolean>;
  sendHandoverReport: (data: HandoverReportData) => Promise<boolean>;
  refreshChannels: () => Promise<void>;
  refreshDirectPeers: () => Promise<void>;
  reconnect: () => Promise<void>;
  summaries: Record<string, ConversationSummary>;
  sendTyping: () => void;
  isOtherTyping: boolean;
  totalUnreadCount: number;
  onlineUserIds: Record<string, boolean>;
  setIsConversationVisible: (visible: boolean) => void;
}

const NexconnChatContext = createContext<NexconnChatContextValue | null>(null);

export function useNexconnChat() {
  const ctx = useContext(NexconnChatContext);
  if (!ctx) {
    throw new Error("useNexconnChat must be used within a NexconnChatProvider");
  }
  return ctx;
}

export function useNexconnChatOptional() {
  return useContext(NexconnChatContext);
}

/**
 * Extracts items array from Nexconn SDK PageData<T> ({ data: T[] }) or fallback shapes.
 */
function extractPageItems(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.messages)) return data.messages;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Extracts the owning workspaceId tagged on a Nexconn message (from content.extra or secure media URL).
 * Guarantees Direct Messages between two users who share multiple organizations remain strictly isolated.
 */
function extractMessageWorkspaceId(msg: any, fileUrl?: string): string | null {
  const extraRaw = (msg?.content as any)?.extra;
  if (typeof extraRaw === "string" && extraRaw.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(extraRaw);
      if (typeof parsed?.workspaceId === "string" && parsed.workspaceId.length > 0) {
        return parsed.workspaceId;
      }
    } catch {}
  }

  if (fileUrl && fileUrl.includes("workspaceId=")) {
    try {
      const urlObj = new URL(fileUrl, "http://localhost");
      const wsParam = urlObj.searchParams.get("workspaceId");
      if (wsParam) return wsParam;
    } catch {}
  }

  return null;
}

/**
 * Produces a symmetric canonical conversation key shared by BOTH sender & receiver
 * for read receipts and delivery acknowledgements within the active workspace.
 */
function getCanonicalReceiptKey(
  type: "channel" | "direct",
  targetId: string,
  myUserId: string | null
): string | null {
  if (!targetId) return null;
  if (type === "channel") {
    return `channel:${targetId}`;
  }
  if (!myUserId) return null;
  const [a, b] = [myUserId, targetId].sort();
  return `direct:${a}:${b}`;
}

/**
 * Parses a raw Nexconn message payload (plain text, secure SPARK media envelope, or native SDK media).
 */
function parseIncomingContent(msg: any): {
  text: string;
  fileInfo?: ChatMessageItem["fileInfo"];
  summaryText: string;
  replyTo?: MessageReplyInfo;
  isHandover?: boolean;
  handoverData?: HandoverReportData;
} {
  const rawText = (msg?.content as any)?.text || "";
  const decoded = decodeMediaMessage(rawText);

  if (decoded.media) {
    return {
      text: decoded.text,
      fileInfo: {
        name: decoded.media.name,
        url: decoded.media.url,
        size: decoded.media.size,
        mimeType: decoded.media.mimeType,
        type: decoded.media.kind,
        encrypted: true,
      },
      summaryText: getMediaSummaryLabel(decoded.media.kind, decoded.text),
      replyTo: decoded.replyTo,
      isHandover: Boolean(decoded.handover),
      handoverData: decoded.handover,
    };
  }

  if (decoded.handover) {
    return {
      text: decoded.text,
      fileInfo: undefined,
      summaryText: getHandoverSummaryLabel(decoded.handover.shiftPeriod),
      replyTo: decoded.replyTo,
      isHandover: true,
      handoverData: decoded.handover,
    };
  }

  if ((msg?.content as any)?.fileUrl) {
    const type: "image" | "file" =
      msg.messageType === "RC:ImgMsg" ? "image" : "file";
    return {
      text: rawText,
      fileInfo: {
        name: (msg.content as any)?.name || "Attachment",
        url: (msg.content as any)?.fileUrl,
        size: (msg.content as any)?.size,
        type,
      },
      summaryText: getMediaSummaryLabel(type, rawText),
      replyTo: decoded.replyTo,
    };
  }

  return {
    text: decoded.text || rawText,
    fileInfo: undefined,
    summaryText: decoded.replyTo
      ? `↩️ Replying to @${decoded.replyTo.senderName}: ${decoded.text || rawText}`
      : decoded.text || rawText,
    replyTo: decoded.replyTo,
    isHandover: Boolean(decoded.handover),
    handoverData: decoded.handover,
  };
}

/**
 * Merges and deduplicates chat messages by ID (also reconciling optimistic opt_ IDs).
 */
function mergeMessages(
  base: ChatMessageItem[],
  incoming: ChatMessageItem[]
): ChatMessageItem[] {
  const byId = new Map<string, ChatMessageItem>();
  for (const m of base) {
    byId.set(m.id, m);
  }
  for (const m of incoming) {
    if (!m.id.startsWith("opt_") && m.isMe) {
      for (const [existingId, existingMsg] of byId.entries()) {
        if (
          existingId.startsWith("opt_") &&
          existingMsg.isMe &&
          existingMsg.text === m.text &&
          (existingMsg.fileInfo?.name || "") === (m.fileInfo?.name || "") &&
          Math.abs(existingMsg.timestamp - m.timestamp) < 20_000
        ) {
          byId.delete(existingId);
          break;
        }
      }
    }
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function NexconnChatProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace, currentUser, addNotification } = useWorkspace();
  const pathname = usePathname();
  const addNotificationRef = useRef(addNotification);
  addNotificationRef.current = addNotification;

  const isAuthPage =
    pathname?.startsWith("/auth") || pathname?.startsWith("/invitations/accept");

  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("DISCONNECTED");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [channels, setChannels] = useState<ChatChannelItem[]>(() => {
    if (activeWorkspace?.id) {
      return clientChatCache.getChannels(activeWorkspace.id) || [];
    }
    return [];
  });
  const [directPeers, setDirectPeers] = useState<DirectMessagePeerItem[]>(() => {
    if (activeWorkspace?.id) {
      return clientChatCache.getPeers(activeWorkspace.id) || [];
    }
    return [];
  });
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [rawMessages, setRawMessages] = useState<ChatMessageItem[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [channelDetails, setChannelDetails] = useState<ChannelDetailsData | null>(null);
  const [isConversationVisible, setIsConversationVisible] = useState<boolean>(true);

  // Strictly workspace-partitioned stores:
  // conversationsStore key = `${workspaceId}:${type}:${targetId}`
  const [conversationsStore, setConversationsStore] = useState<Record<string, ChatMessageItem[]>>({});
  // summariesByWorkspace = workspaceId -> `${type}:${targetId}` -> ConversationSummary
  const [summariesByWorkspace, setSummariesByWorkspace] = useState<
    Record<string, Record<string, ConversationSummary>>
  >({});
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Record<string, boolean>>({});
  // canonicalKey -> readerUserId -> ReadCursorEntry (scoped to active workspace)
  const [readCursors, setReadCursors] = useState<
    Record<string, Record<string, ReadCursorEntry>>
  >({});
  const [deliveredCursors, setDeliveredCursors] = useState<Record<string, number>>({});

  const activeConvRef = useRef<ActiveConversation | null>(null);
  activeConvRef.current = activeConversation;

  const activeWorkspaceIdRef = useRef<string | null>(null);
  activeWorkspaceIdRef.current = activeWorkspace?.id || null;

  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId || currentUser?.id || null;

  const currentUserNameRef = useRef<string>(currentUser?.name || "Member");
  currentUserNameRef.current = currentUser?.name || "Member";

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const isConversationVisibleRef = useRef(isConversationVisible);
  isConversationVisibleRef.current = isConversationVisible;

  const connectedUserIdRef = useRef<string | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  const channelsRef = useRef<ChatChannelItem[]>([]);
  channelsRef.current = channels;

  const directPeersRef = useRef<DirectMessagePeerItem[]>([]);
  directPeersRef.current = directPeers;

  const channelDetailsRef = useRef<ChannelDetailsData | null>(null);
  channelDetailsRef.current = channelDetails;

  const conversationsStoreRef = useRef(conversationsStore);
  conversationsStoreRef.current = conversationsStore;

  const realtimeChannelRef = useRef<any>(null);
  const lastSentReceiptRef = useRef<Map<string, number>>(new Map());
  const loadedHistoryKeysRef = useRef<Set<string>>(new Set());
  const channelDetailsCacheRef = useRef<Map<string, ChannelDetailsData>>(new Map());
  const lastTypingSentRef = useRef<number>(0);

  const [replyingTo, setReplyingTo] = useState<MessageReplyInfo | null>(null);
  const [handoverAcks, setHandoverAcks] = useState<Record<string, HandoverSignOff[]>>({});

  const getStoreKey = useCallback(
    (wsId: string, type: "channel" | "direct", targetId: string) => {
      return `${wsId}:${type}:${targetId}`;
    },
    []
  );

  const getActiveConvKey = useCallback(() => {
    const active = activeConvRef.current;
    if (!active) return null;
    return `${active.type}:${active.nexconnTargetId}`;
  }, []);

  const resolveSenderName = useCallback((senderId: string) => {
    if (!senderId) return "Team Member";
    if (senderId === currentUserIdRef.current) return "You";

    const peer = directPeersRef.current.find((p) => p.id === senderId);
    if (peer?.fullName) return peer.fullName;

    const wsId = activeWorkspaceIdRef.current;
    if (wsId) {
      const cachedMembers = clientMembersCache.get(wsId);
      const foundMember = cachedMembers?.find((m) => m.user.id === senderId);
      if (foundMember?.user?.fullName) return foundMember.user.fullName;

      const cachedPeers = clientChatCache.getPeers(wsId);
      const foundPeer = cachedPeers?.find((p) => p.id === senderId);
      if (foundPeer?.fullName) return foundPeer.fullName;
    }

    if (channelDetailsRef.current) {
      const member = channelDetailsRef.current.members.find((m) => m.id === senderId);
      if (member?.fullName) return member.fullName;
      if (channelDetailsRef.current.creator?.id === senderId) {
        return channelDetailsRef.current.creator.fullName;
      }
    }

    if (
      activeConvRef.current?.type === "direct" &&
      activeConvRef.current.nexconnTargetId === senderId
    ) {
      return activeConvRef.current.name;
    }

    return "Team Member";
  }, []);

  const resolveSenderAvatar = useCallback((senderId: string) => {
    if (!senderId) return null;
    const peer = directPeersRef.current.find((p) => p.id === senderId);
    if (peer?.avatarUrl) return peer.avatarUrl;

    const wsId = activeWorkspaceIdRef.current;
    if (wsId) {
      const cachedMembers = clientMembersCache.get(wsId);
      const foundMember = cachedMembers?.find((m) => m.user.id === senderId);
      if (foundMember?.user?.avatarUrl) return foundMember.user.avatarUrl;
    }

    if (channelDetailsRef.current) {
      const member = channelDetailsRef.current.members.find((m) => m.id === senderId);
      if (member?.avatarUrl) return member.avatarUrl;
      if (channelDetailsRef.current.creator?.id === senderId) {
        return channelDetailsRef.current.creator.avatarUrl;
      }
    }
    return null;
  }, []);

  const updateWorkspaceSummary = useCallback(
    (
      wsId: string,
      convKey: string,
      updater: (prev: ConversationSummary | undefined) => ConversationSummary
    ) => {
      setSummariesByWorkspace((prev) => {
        const wsSummaries = prev[wsId] || {};
        const nextEntry = updater(wsSummaries[convKey]);
        return {
          ...prev,
          [wsId]: {
            ...wsSummaries,
            [convKey]: nextEntry,
          },
        };
      });
    },
    []
  );

  /**
   * Broadcasts & persists a real-time Seen receipt ONLY when the user is actively viewing
   * the conversation on a visible tab (respects mobile list vs chat view!).
   */
  const emitReadReceipt = useCallback(
    (type: "channel" | "direct", targetId: string, latestTimestamp: number) => {
      const myId = currentUserIdRef.current;
      const wsId = activeWorkspaceIdRef.current;
      if (!myId || !wsId || wsId === "personal-fallback" || !latestTimestamp) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (!pathnameRef.current?.startsWith("/chat")) return;
      if (!isConversationVisibleRef.current) return;

      const canonicalKey = getCanonicalReceiptKey(type, targetId, myId);
      if (!canonicalKey) return;

      const receiptCacheKey = `${wsId}:${canonicalKey}`;
      const prevSent = lastSentReceiptRef.current.get(receiptCacheKey) || 0;
      if (latestTimestamp <= prevSent) return;
      lastSentReceiptRef.current.set(receiptCacheKey, latestTimestamp);

      const entry: ReadCursorEntry = {
        readerUserId: myId,
        readerName: currentUserNameRef.current,
        lastReadTimestamp: latestTimestamp,
        updatedAt: Date.now(),
      };

      setReadCursors((prev) => ({
        ...prev,
        [canonicalKey]: {
          ...(prev[canonicalKey] || {}),
          [myId]: entry,
        },
      }));

      const rt = realtimeChannelRef.current;
      if (rt) {
        rt.send({
          type: "broadcast",
          event: "read_receipt",
          payload: {
            canonicalKey,
            ...entry,
          },
        }).catch(() => {});
      }

      fetch("/api/chat/read-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: wsId,
          convKey: canonicalKey,
          readerName: entry.readerName,
          lastReadTimestamp: latestTimestamp,
        }),
      }).catch(() => {});
    },
    []
  );

  /**
   * Broadcasts a delivery acknowledgement whenever this device receives a live message
   * belonging to the active workspace.
   */
  const emitDeliveryAck = useCallback(
    (type: "channel" | "direct", targetId: string, timestamp: number) => {
      const myId = currentUserIdRef.current;
      const rt = realtimeChannelRef.current;
      if (!myId || !rt || !timestamp) return;
      const canonicalKey = getCanonicalReceiptKey(type, targetId, myId);
      if (!canonicalKey) return;

      rt.send({
        type: "broadcast",
        event: "delivery_ack",
        payload: {
          canonicalKey,
          receiverUserId: myId,
          deliveredTimestamp: timestamp,
        },
      }).catch(() => {});
    },
    []
  );

  // Re-hydrate any "Team Member" placeholder names once peers/members finish loading
  useEffect(() => {
    if (directPeers.length === 0 && !channelDetails) return;

    setRawMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (!m.isMe && m.senderName === "Team Member") {
          const resolved = resolveSenderName(m.senderId);
          if (resolved !== "Team Member") {
            changed = true;
            return {
              ...m,
              senderName: resolved,
              senderAvatar: m.senderAvatar || resolveSenderAvatar(m.senderId),
            };
          }
        }
        return m;
      });
      return changed ? next : prev;
    });

    setConversationsStore((prev) => {
      let anyChanged = false;
      const updated: Record<string, ChatMessageItem[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        let listChanged = false;
        const nextList = list.map((m) => {
          if (!m.isMe && m.senderName === "Team Member") {
            const resolved = resolveSenderName(m.senderId);
            if (resolved !== "Team Member") {
              listChanged = true;
              anyChanged = true;
              return {
                ...m,
                senderName: resolved,
                senderAvatar: m.senderAvatar || resolveSenderAvatar(m.senderId),
              };
            }
          }
          return m;
        });
        updated[key] = listChanged ? nextList : list;
      }
      return anyChanged ? updated : prev;
    });

    const activeWsId = activeWorkspaceIdRef.current;
    if (activeWsId) {
      setSummariesByWorkspace((prev) => {
        const wsMap = prev[activeWsId];
        if (!wsMap) return prev;
        let changed = false;
        const nextWs: Record<string, ConversationSummary> = {};
        for (const [key, sum] of Object.entries(wsMap)) {
          if (sum.lastSenderId && sum.lastSenderName === "Team Member") {
            const resolved = resolveSenderName(sum.lastSenderId);
            if (resolved !== "Team Member") {
              changed = true;
              nextWs[key] = { ...sum, lastSenderName: resolved };
              continue;
            }
          }
          nextWs[key] = sum;
        }
        return changed ? { ...prev, [activeWsId]: nextWs } : prev;
      });
    }
  }, [directPeers, channelDetails, resolveSenderName, resolveSenderAvatar]);

  // Helper to apply channels list & cleanly select #general whenever switching workspaces
  const applyChannels = useCallback((wsId: string, list: ChatChannelItem[]) => {
    setChannels(list);
    const current = activeConvRef.current;
    const belongsToWorkspace =
      current &&
      ((current.type === "channel" && list.some((c) => c.id === current.id)) ||
        (current.type === "direct" &&
          directPeersRef.current.some((p) => p.id === current.id)));

    if ((!current || !belongsToWorkspace) && list.length > 0) {
      const defaultChan = list.find((c) => c.isDefault) || list[0];
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
    } else if (list.length === 0) {
      setActiveConversation(null);
    }
  }, []);

  // 0. Cleanly reset active conversation immediately when switching workspaces
  // (prevents race condition where an Org A DM stays open when switching to Personal Workspace or Org B!)
  useEffect(() => {
    const wsId = activeWorkspace?.id;
    if (!wsId || wsId === "personal-fallback") return;

    const cachedChannels = clientChatCache.getChannels(wsId) || [];
    const cachedPeers = clientChatCache.getPeers(wsId) || [];

    directPeersRef.current = cachedPeers;
    channelsRef.current = cachedChannels;
    setDirectPeers(cachedPeers);
    setChannels(cachedChannels);
    setChannelDetails(null);
    setRawMessages([]);

    if (cachedChannels.length > 0) {
      const defaultChan = cachedChannels.find((c) => c.isDefault) || cachedChannels[0];
      setActiveConversation({
        type: "channel",
        id: defaultChan.id,
        name: defaultChan.name,
        nexconnTargetId: defaultChan.nexconnChannelId,
        description: defaultChan.description,
        isPrivate: defaultChan.type === "PRIVATE",
      });
    } else {
      setActiveConversation(null);
    }
  }, [activeWorkspace?.id]);

  // 1. Subscribe to unified /api/bootstrap payloads
  useEffect(() => {
    return subscribeBootstrap((payload) => {
      const wsId = payload.activeWorkspace?.id;
      if (!wsId || wsId !== activeWorkspaceIdRef.current) return;
      if (payload.directPeers) {
        directPeersRef.current = payload.directPeers;
        setDirectPeers(payload.directPeers);
      }
      if (payload.channels) {
        channelsRef.current = payload.channels;
        applyChannels(wsId, payload.channels);
      }
    });
  }, [applyChannels]);

  // 2. Refresh Channels and Direct Peers
  const refreshChannels = useCallback(
    async (force = false) => {
      const wsId = activeWorkspace?.id;
      if (!wsId || wsId === "personal-fallback") return;

      const cached = clientChatCache.getChannels(wsId);
      if (cached) {
        channelsRef.current = cached;
        applyChannels(wsId, cached);
        if (!force && clientChatCache.isChannelsFresh(wsId)) {
          return;
        }
      }

      const res = await getWorkspaceChannels(wsId);
      if (res.channels && activeWorkspaceIdRef.current === wsId) {
        clientChatCache.setChannels(wsId, res.channels);
        channelsRef.current = res.channels;
        applyChannels(wsId, res.channels);
      }
    },
    [activeWorkspace?.id, applyChannels]
  );

  const refreshDirectPeers = useCallback(
    async (force = false) => {
      const wsId = activeWorkspace?.id;
      if (!wsId || wsId === "personal-fallback") return;

      const cached = clientChatCache.getPeers(wsId);
      if (cached) {
        directPeersRef.current = cached;
        setDirectPeers(cached);
        if (!force && clientChatCache.isPeersFresh(wsId)) {
          return;
        }
      }

      const res = await getWorkspaceDirectMessagePeers(wsId);
      if (res.peers && activeWorkspaceIdRef.current === wsId) {
        clientChatCache.setPeers(wsId, res.peers);
        directPeersRef.current = res.peers;
        setDirectPeers(res.peers);
      }
    },
    [activeWorkspace?.id]
  );

  // Sync sidebar previews & server unread counts strictly scoped to the active workspace
  const syncConversationSummaries = useCallback(async () => {
    const activeWsId = activeWorkspaceIdRef.current;
    if (!activeWsId || activeWsId === "personal-fallback") return;

    try {
      const { BaseChannel } = await import("@nexconn/chat");
      const query = BaseChannel.createChannelsQuery({ pageSize: 50 });
      const res = await query.loadNextPage();
      if (!res || !res.isOk || !res.data) return;

      const chanList = extractPageItems(res.data);
      if (chanList.length === 0) return;

      const currentActive = activeConvRef.current;
      const currentActiveKey = currentActive
        ? `${currentActive.type}:${currentActive.nexconnTargetId}`
        : null;

      setSummariesByWorkspace((prev) => {
        const nextByWs = { ...prev };
        for (const ch of chanList) {
          const isGroup = ch.channelType === 3;
          const isDirect = ch.channelType === 1;
          if (!isGroup && !isDirect) continue;

          const latest = ch.latestMessage;
          const parsedLatest = latest ? parseIncomingContent(latest) : null;
          const msgWsId = latest
            ? extractMessageWorkspaceId(latest, parsedLatest?.fileInfo?.url)
            : null;

          // Determine which workspace owns this conversation summary
          let targetWsId = activeWsId;
          if (isGroup) {
            const belongsHere = channelsRef.current.some(
              (c) => c.nexconnChannelId === ch.channelId
            );
            if (!belongsHere) continue;
          } else if (isDirect) {
            if (msgWsId) {
              targetWsId = msgWsId;
            } else {
              // Untagged legacy DM only attaches if peer is in active workspace
              const peerInActive = directPeersRef.current.some(
                (p) => p.id === ch.channelId
              );
              if (!peerInActive) continue;
            }
          }

          const convKey = isGroup ? `channel:${ch.channelId}` : `direct:${ch.channelId}`;
          const wsMap = { ...(nextByWs[targetWsId] || {}) };
          const existing = wsMap[convKey];

          const latestTimestamp = latest?.sentTime || ch.operationTime || 0;
          if (
            existing?.lastMessageTimestamp &&
            existing.lastMessageTimestamp > latestTimestamp
          ) {
            continue;
          }

          const latestSenderId = latest?.senderUserId || "";
          const latestSenderName = latestSenderId
            ? resolveSenderName(latestSenderId)
            : undefined;
          const latestText =
            parsedLatest?.summaryText || existing?.lastMessageText || "";
          const latestTime = latestTimestamp
            ? new Date(latestTimestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : existing?.lastMessageTime;

          const isViewingThis =
            targetWsId === activeWsId &&
            currentActiveKey === convKey &&
            pathnameRef.current?.startsWith("/chat") &&
            isConversationVisibleRef.current;

          wsMap[convKey] = {
            ...(existing || { unreadCount: 0 }),
            lastMessageText: latestText,
            lastMessageTime: latestTime,
            lastMessageTimestamp: latestTimestamp || existing?.lastMessageTimestamp,
            lastSenderId: latestSenderId || existing?.lastSenderId,
            lastSenderName: latestSenderName || existing?.lastSenderName,
            unreadCount: isViewingThis
              ? 0
              : Math.max(existing?.unreadCount || 0, ch.unreadCount || 0),
          };
          nextByWs[targetWsId] = wsMap;
        }
        return nextByWs;
      });
    } catch {}
  }, [resolveSenderName]);

  // 3. Persistent Socket Connection
  const connectNexconn = useCallback(
    async (forceReconnect = false) => {
      const wsId = activeWorkspace?.id;
      const userId = currentUser?.id;

      if (isAuthPage || !userId || !wsId || wsId === "personal-fallback") return;

      if (!forceReconnect && connectedUserIdRef.current === userId && isReady) {
        return;
      }

      if (isConnectingRef.current) return;
      isConnectingRef.current = true;

      try {
        setIsConnecting(true);
        setConnectionError(null);
        setConnectionStatus("CONNECTING");

        const cachedToken = !forceReconnect ? clientChatCache.getToken(wsId) : null;

        const tokenPromise =
          cachedToken && cachedToken.userId === userId
            ? Promise.resolve(cachedToken)
            : fetch("/api/chat/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId: wsId }),
              }).then(async (r) => {
                const data = await r.json();
                if (!r.ok || !data.token) {
                  throw new Error(data.error || "Failed to obtain chat token.");
                }
                clientChatCache.setToken(wsId, {
                  token: data.token,
                  userId: data.userId,
                  appKey: data.appKey,
                });
                return data as { token: string; userId: string; appKey?: string };
              });

        const [sdk, tokenData] = await Promise.all([
          import("@nexconn/chat"),
          tokenPromise,
        ]);

        const {
          NCEngine,
          ConnectionStatusHandler,
          MessageHandler,
          ChannelHandler,
          AreaCode,
          LogLevel,
        } = sdk;

        const appKey = tokenData.appKey || process.env.NEXT_PUBLIC_NEXCONN_APP_KEY;
        if (!appKey) {
          throw new Error("NEXT_PUBLIC_NEXCONN_APP_KEY is not configured.");
        }

        if (connectedUserIdRef.current && connectedUserIdRef.current !== tokenData.userId) {
          try {
            NCEngine.disconnect();
          } catch {}
        }

        try {
          NCEngine.initialize({
            appKey,
            logLevel: LogLevel.WARN,
            areaCode: AreaCode.SG,
          });
        } catch {}

        NCEngine.addConnectionStatusHandler(
          "spark-connection-handler",
          new ConnectionStatusHandler({
            onConnectionStatusChanged({ status }: { status: any }) {
              const code = Number(status);
              let statusStr = "DISCONNECTED";
              if (code === 0 || status === "CONNECTED") {
                statusStr = "CONNECTED";
              } else if (code === 1 || status === "CONNECTING") {
                statusStr = "CONNECTING";
              } else if (code === 3 || status === "SUSPENDED") {
                statusStr = "SUSPENDED";
              } else {
                statusStr = "DISCONNECTED";
              }
              setConnectionStatus(statusStr);
              if (statusStr === "CONNECTED") {
                setIsReady(true);
                setConnectionError(null);
              }
            },
          })
        );

        try {
          NCEngine.addChannelHandler(
            "spark-typing-handler",
            new ChannelHandler({
              onTypingStatusChanged(event: any) {
                const channelType = event.channelIdentifier?.channelType;
                const channelId = event.channelIdentifier?.channelId;
                for (const status of event.userTypingStatus || []) {
                  if (status.userId === currentUserIdRef.current) continue;
                  const typingKey =
                    channelType === 1
                      ? `direct:${status.userId}`
                      : `channel:${channelId}`;

                  setTypingStatus((prev) => ({ ...prev, [typingKey]: true }));
                  setTimeout(() => {
                    setTypingStatus((prev) => ({ ...prev, [typingKey]: false }));
                  }, 3500);
                }
              },
            })
          );
        } catch {}

        // Global Incoming Message Handler with STRICT channelType AND multi-organization workspace isolation
        NCEngine.addMessageHandler(
          "spark-global-message-handler",
          new MessageHandler({
            onMessageReceived(event) {
              const incomingList = event.messages || [];
              if (incomingList.length === 0) return;

              const myId = currentUserIdRef.current;
              const activeWsId = activeWorkspaceIdRef.current;
              const currentActive = activeConvRef.current;
              const currentActiveKey = currentActive
                ? `${currentActive.type}:${currentActive.nexconnTargetId}`
                : null;
              const onChatRoute = Boolean(pathnameRef.current?.startsWith("/chat"));

              for (const msg of incomingList) {
                const channelType = msg.channelIdentifier?.channelType;
                const channelId = msg.channelIdentifier?.channelId;
                const senderUserId = msg.senderUserId;
                const isMe = senderUserId === myId;

                let convKey: string | null = null;
                let targetId: string | null = null;
                let convType: "channel" | "direct" = "channel";

                if (channelType === 3) {
                  convType = "channel";
                  targetId = channelId;
                  convKey = `channel:${channelId}`;
                } else if (channelType === 1) {
                  convType = "direct";
                  targetId = isMe ? channelId : senderUserId;
                  convKey = `direct:${targetId}`;
                } else {
                  const matchChan = channelsRef.current.find(
                    (c) => c.nexconnChannelId === channelId
                  );
                  if (matchChan) {
                    convType = "channel";
                    targetId = channelId;
                    convKey = `channel:${channelId}`;
                  } else {
                    convType = "direct";
                    targetId = isMe ? channelId : senderUserId;
                    convKey = `direct:${targetId}`;
                  }
                }

                if (!convKey || !targetId) continue;

                const parsed = parseIncomingContent(msg);
                const taggedWsId = extractMessageWorkspaceId(msg, parsed.fileInfo?.url);
                const msgWsId = taggedWsId || activeWsId || "__global__";
                const belongsToActiveWorkspace =
                  !activeWsId || !taggedWsId || taggedWsId === activeWsId;

                const senderName = isMe
                  ? "You"
                  : convType === "direct" &&
                    belongsToActiveWorkspace &&
                    currentActive?.nexconnTargetId === targetId
                  ? currentActive.name
                  : resolveSenderName(senderUserId);

                const timestamp = msg.sentTime || Date.now();
                const time = new Date(timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const formattedMsg: ChatMessageItem = {
                  id:
                    msg.messageId ||
                    `msg_${timestamp}_${Math.random().toString(36).substring(2, 9)}`,
                  senderId: senderUserId,
                  senderName,
                  senderAvatar: resolveSenderAvatar(senderUserId),
                  text: parsed.text,
                  time,
                  timestamp,
                  isMe,
                  messageType: msg.messageType || "RC:TxtMsg",
                  channelType: channelType || (convType === "channel" ? 3 : 1),
                  status: isMe ? "sent" : "delivered",
                  fileInfo: parsed.fileInfo,
                  replyTo: parsed.replyTo,
                  isHandover: parsed.isHandover,
                  handoverData: parsed.handoverData,
                };

                const storeKey = `${msgWsId}:${convKey}`;
                setConversationsStore((prev) => {
                  const existing = prev[storeKey] || [];
                  const merged = mergeMessages(existing, [formattedMsg]);
                  return { ...prev, [storeKey]: merged };
                });

                const isCurrentlyViewing =
                  belongsToActiveWorkspace &&
                  currentActiveKey === convKey &&
                  onChatRoute &&
                  isConversationVisibleRef.current &&
                  (typeof document === "undefined" ||
                    document.visibilityState === "visible");

                updateWorkspaceSummary(msgWsId, convKey, (prevSummary) => {
                  const base = prevSummary || { unreadCount: 0 };
                  const newUnread =
                    isCurrentlyViewing || isMe ? 0 : base.unreadCount + 1;
                  const shouldUpdatePreview =
                    !base.lastMessageTimestamp ||
                    timestamp >= base.lastMessageTimestamp;

                  return {
                    ...base,
                    ...(shouldUpdatePreview
                      ? {
                          lastMessageText: parsed.summaryText,
                          lastMessageTime: time,
                          lastMessageTimestamp: timestamp,
                          lastSenderId: senderUserId,
                          lastSenderName: senderName,
                        }
                      : {}),
                    unreadCount: newUnread,
                  };
                });

                if (belongsToActiveWorkspace && currentActiveKey === convKey) {
                  setRawMessages((prev) => mergeMessages(prev, [formattedMsg]));
                }

                // Real-time Delivery Ack & Read Receipt strictly for active workspace messages
                if (!isMe && belongsToActiveWorkspace) {
                  emitDeliveryAck(convType, targetId, timestamp);
                  if (isCurrentlyViewing) {
                    emitReadReceipt(convType, targetId, timestamp);
                  } else {
                    // Trigger real-time notification in header bell menu
                    try {
                      addNotificationRef.current?.({
                        id: `notif_chat_${formattedMsg.id}`,
                        userId: myId || undefined,
                        workspaceId: msgWsId,
                        title: convType === "direct" ? `Message from ${senderName}` : `#${channelId || "channel"}`,
                        message: parsed.summaryText || "Sent a message",
                        timestamp: new Date(timestamp).toISOString(),
                        read: false,
                        type: convType === "direct" ? "CHAT_DM" : "CHAT_CHANNEL",
                        link: "/chat",
                      });
                    } catch {}
                  }
                }
              }
            },
          })
        );

        setCurrentUserId(tokenData.userId);
        currentUserIdRef.current = tokenData.userId;

        const connectResult = await NCEngine.connect({ token: tokenData.token });
        if (connectResult && !connectResult.isOk) {
          throw new Error(connectResult.msg || "Failed to connect to Nexconn.");
        }

        connectedUserIdRef.current = tokenData.userId;
        setIsReady(true);
        setConnectionStatus("CONNECTED");

        syncConversationSummaries();
      } catch (err: any) {
        console.error("[Nexconn Client Connection Error]:", err?.message || err);
        if (wsId) {
          clientChatCache.setToken(wsId, null as any);
        }
        setConnectionError(err.message || "Connection failed.");
        setConnectionStatus("DISCONNECTED");
        setIsReady(false);
      } finally {
        isConnectingRef.current = false;
        setIsConnecting(false);
      }
    },
    [
      activeWorkspace?.id,
      currentUser?.id,
      isAuthPage,
      isReady,
      resolveSenderName,
      resolveSenderAvatar,
      syncConversationSummaries,
      updateWorkspaceSummary,
      emitDeliveryAck,
      emitReadReceipt,
    ]
  );

  // Re-sync sidebar summaries when switching workspaces while already connected
  useEffect(() => {
    if (isReady && activeWorkspace?.id && activeWorkspace.id !== "personal-fallback") {
      syncConversationSummaries();
    }
  }, [isReady, activeWorkspace?.id, syncConversationSummaries]);

  // 4. Reset & disconnect cleanly if user signs out
  useEffect(() => {
    if (!currentUser?.id && connectedUserIdRef.current) {
      import("@nexconn/chat").then(({ NCEngine }) => {
        try {
          NCEngine.disconnect();
          NCEngine.removeConnectionStatusHandler("spark-connection-handler");
          NCEngine.removeMessageHandler("spark-global-message-handler");
          NCEngine.removeChannelHandler("spark-typing-handler");
        } catch {}
      });
      connectedUserIdRef.current = null;
      loadedHistoryKeysRef.current.clear();
      channelDetailsCacheRef.current.clear();
      lastSentReceiptRef.current.clear();
      setIsReady(false);
      setConnectionStatus("DISCONNECTED");
      setCurrentUserId(null);
      setChannels([]);
      setDirectPeers([]);
      setActiveConversation(null);
      setRawMessages([]);
      setConversationsStore({});
      setSummariesByWorkspace({});
      setTypingStatus({});
      setOnlineUserIds({});
      setReadCursors({});
      setDeliveredCursors({});
      setChannelDetails(null);
    }
  }, [currentUser?.id]);

  // 4b. Live Workspace Presence + Real-Time Read Receipts & Delivery Acks (strictly per workspace)
  useEffect(() => {
    const userId = currentUser?.id;
    const wsId = activeWorkspace?.id;

    if (isAuthPage || !userId || !wsId || wsId === "personal-fallback") {
      setOnlineUserIds({});
      setReadCursors({});
      setDeliveredCursors({});
      realtimeChannelRef.current = null;
      return;
    }

    // Clear previous workspace's cursors immediately before loading new workspace's cursors
    setReadCursors({});
    setDeliveredCursors({});

    fetch(`/api/chat/read-receipts?workspaceId=${encodeURIComponent(wsId)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.receipts && activeWorkspaceIdRef.current === wsId) {
          setReadCursors((prev) => {
            const merged = { ...prev };
            for (const [k, readers] of Object.entries(
              data.receipts as Record<string, Record<string, ReadCursorEntry>>
            )) {
              merged[k] = { ...(merged[k] || {}), ...readers };
            }
            return merged;
          });
        }
      })
      .catch(() => {});

    const supabase = createClient();
    const channel = supabase.channel(`spark_presence_${wsId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    });
    realtimeChannelRef.current = channel;

    const syncOnlineMap = () => {
      const state = channel.presenceState();
      const nextMap: Record<string, boolean> = {};
      for (const [key, presences] of Object.entries(state)) {
        if (Array.isArray(presences) && presences.length > 0) {
          nextMap[key] = true;
        }
      }
      setOnlineUserIds(nextMap);
    };

    channel
      .on("presence", { event: "sync" }, syncOnlineMap)
      .on("presence", { event: "join" }, syncOnlineMap)
      .on("presence", { event: "leave" }, syncOnlineMap)
      .on("broadcast", { event: "read_receipt" }, ({ payload }: { payload: any }) => {
        if (!payload?.canonicalKey || !payload?.readerUserId || !payload?.lastReadTimestamp) {
          return;
        }
        const canonicalKey = String(payload.canonicalKey);
        const readerId = String(payload.readerUserId);
        const ts = Number(payload.lastReadTimestamp);

        setReadCursors((prev) => {
          const existingConv = prev[canonicalKey] || {};
          const existingReader = existingConv[readerId];
          if (existingReader && existingReader.lastReadTimestamp >= ts) {
            return prev;
          }
          return {
            ...prev,
            [canonicalKey]: {
              ...existingConv,
              [readerId]: {
                readerUserId: readerId,
                readerName: String(payload.readerName || resolveSenderName(readerId)),
                lastReadTimestamp: ts,
                updatedAt: Date.now(),
              },
            },
          };
        });
      })
      .on("broadcast", { event: "delivery_ack" }, ({ payload }: { payload: any }) => {
        if (!payload?.canonicalKey || !payload?.deliveredTimestamp) return;
        const canonicalKey = String(payload.canonicalKey);
        const ts = Number(payload.deliveredTimestamp);
        setDeliveredCursors((prev) => {
          if ((prev[canonicalKey] || 0) >= ts) return prev;
          return { ...prev, [canonicalKey]: ts };
        });
      })
      .on("broadcast", { event: "handover_ack" }, ({ payload }: { payload: any }) => {
        if (!payload?.messageId || !payload?.ack) return;
        const msgId = String(payload.messageId);
        const ack = payload.ack as HandoverSignOff;
        setHandoverAcks((prev) => {
          const list = prev[msgId] || [];
          if (list.some((a) => a.userId === ack.userId)) return prev;
          return { ...prev, [msgId]: [...list, ack] };
        });
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          try {
            await channel.track({ userId, onlineAt: Date.now() });
          } catch {}
        }
      });

    const handlePageHide = () => {
      try {
        channel.untrack();
      } catch {}
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      if (realtimeChannelRef.current === channel) {
        realtimeChannelRef.current = null;
      }
      try {
        channel.untrack();
      } catch {}
      supabase.removeChannel(channel);
    };
  }, [isAuthPage, currentUser?.id, activeWorkspace?.id, resolveSenderName]);

  // 4c. Emit Seen receipt whenever conversation is actually visible to the user
  useEffect(() => {
    const triggerReadReceipt = () => {
      const active = activeConvRef.current;
      const wsId = activeWorkspaceIdRef.current;
      if (!active || !wsId || !pathnameRef.current?.startsWith("/chat")) return;
      if (!isConversationVisibleRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const latestIncoming = [...rawMessages]
        .reverse()
        .find((m) => !m.isMe && m.timestamp > 0);
      if (latestIncoming) {
        emitReadReceipt(active.type, active.nexconnTargetId, latestIncoming.timestamp);
      }

      const convKey = `${active.type}:${active.nexconnTargetId}`;
      updateWorkspaceSummary(wsId, convKey, (prev) => ({
        ...(prev || { unreadCount: 0 }),
        unreadCount: 0,
      }));
    };

    triggerReadReceipt();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        triggerReadReceipt();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [
    activeConversation,
    rawMessages,
    pathname,
    isConversationVisible,
    emitReadReceipt,
    updateWorkspaceSummary,
  ]);

  // 5. Load channels, peers, and establish persistent connection
  useEffect(() => {
    if (
      isAuthPage ||
      !currentUser?.id ||
      !activeWorkspace?.id ||
      activeWorkspace.id === "personal-fallback"
    ) {
      return;
    }

    refreshChannels(false);
    refreshDirectPeers(false);
    connectNexconn(false);
  }, [
    isAuthPage,
    currentUser?.id,
    activeWorkspace?.id,
    refreshChannels,
    refreshDirectPeers,
    connectNexconn,
  ]);

  // 6. Load message history strictly scoped to (activeWorkspace, activeConversation)
  useEffect(() => {
    const wsId = activeWorkspace?.id;
    if (!activeConversation || !wsId || wsId === "personal-fallback") {
      setRawMessages([]);
      setChannelDetails(null);
      return;
    }

    const convKey = `${activeConversation.type}:${activeConversation.nexconnTargetId}`;
    const storeKey = getStoreKey(wsId, activeConversation.type, activeConversation.nexconnTargetId);

    if (pathnameRef.current?.startsWith("/chat") && isConversationVisibleRef.current) {
      updateWorkspaceSummary(wsId, convKey, (prev) => ({
        ...(prev || { unreadCount: 0 }),
        unreadCount: 0,
      }));
    }

    setReplyingTo(null);

    if (activeConversation.type === "channel" && activeConversation.id) {
      getChannelHandoverAcknowledgments(wsId, activeConversation.id)
        .then((res) => {
          if (res.acknowledgments) {
            setHandoverAcks((prev) => ({
              ...prev,
              ...res.acknowledgments,
            }));
          }
        })
        .catch(() => {});
    }

    const cached = conversationsStoreRef.current[storeKey];
    if (cached && cached.length > 0) {
      setRawMessages(cached);
    } else {
      setRawMessages([]);
    }

    let isCancelled = false;

    async function loadHistory() {
      if (!isReady || !wsId) return;

      const alreadyLoaded = loadedHistoryKeysRef.current.has(storeKey);
      if (!alreadyLoaded && (!cached || cached.length === 0)) {
        setIsLoadingMessages(true);
      }

      try {
        const {
          BaseChannel,
          GroupChannel,
          DirectChannel,
          GroupChannelIdentifier,
          DirectChannelIdentifier,
        } = await import("@nexconn/chat");

        if (pathnameRef.current?.startsWith("/chat") && isConversationVisibleRef.current) {
          try {
            const chInstance =
              activeConversation?.type === "channel"
                ? new GroupChannel(activeConversation.nexconnTargetId)
                : new DirectChannel(activeConversation!.nexconnTargetId);
            chInstance.clearUnreadCount().catch(() => {});
          } catch {}
        }

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
          loadedHistoryKeysRef.current.add(storeKey);

          const rawList = extractPageItems(result.data);
          const myId = currentUserIdRef.current;

          const formatted: ChatMessageItem[] = [];
          for (const msg of rawList) {
            const parsed = parseIncomingContent(msg);

            // Multi-organization DM isolation: filter out DMs explicitly belonging to a DIFFERENT workspace
            if (activeConversation?.type === "direct") {
              const taggedWsId = extractMessageWorkspaceId(msg, parsed.fileInfo?.url);
              if (taggedWsId && taggedWsId !== wsId) {
                continue;
              }
            }

            const isMe = msg.senderUserId === myId;
            const timestamp = msg.sentTime || Date.now();
            formatted.push({
              id: msg.messageId || `msg_${timestamp}_${Math.random()}`,
              senderId: msg.senderUserId,
              senderName: isMe
                ? "You"
                : activeConversation?.type === "direct"
                ? activeConversation.name
                : resolveSenderName(msg.senderUserId),
              senderAvatar: resolveSenderAvatar(msg.senderUserId),
              text: parsed.text,
              time: new Date(timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              timestamp,
              isMe,
              messageType: msg.messageType || "RC:TxtMsg",
              channelType: activeConversation?.type === "channel" ? 3 : 1,
              status: "sent",
              fileInfo: parsed.fileInfo,
              replyTo: parsed.replyTo,
              isHandover: parsed.isHandover,
              handoverData: parsed.handoverData,
            });
          }

          setConversationsStore((prev) => {
            const existing = prev[storeKey] || [];
            const merged = mergeMessages(formatted, existing);
            return { ...prev, [storeKey]: merged };
          });

          setRawMessages((prev) => mergeMessages(formatted, prev));

          if (formatted.length > 0) {
            const sorted = [...formatted].sort((a, b) => a.timestamp - b.timestamp);
            const latest = sorted[sorted.length - 1];
            updateWorkspaceSummary(wsId, convKey, (existingSummary) => {
              if (
                existingSummary?.lastMessageTimestamp &&
                existingSummary.lastMessageTimestamp > latest.timestamp
              ) {
                return existingSummary;
              }
              return {
                ...(existingSummary || { unreadCount: 0 }),
                lastMessageText: latest.fileInfo
                  ? getMediaSummaryLabel(latest.fileInfo.type, latest.text)
                  : latest.text,
                lastMessageTime: latest.time,
                lastMessageTimestamp: latest.timestamp,
                lastSenderId: latest.senderId,
                lastSenderName: latest.senderName,
                unreadCount:
                  pathnameRef.current?.startsWith("/chat") &&
                  isConversationVisibleRef.current
                    ? 0
                    : existingSummary?.unreadCount || 0,
              };
            });
          }
        }
      } catch (err) {
        console.error("Failed to load message history:", err);
      } finally {
        if (!isCancelled) setIsLoadingMessages(false);
      }
    }

    loadHistory();

    if (activeConversation.type === "channel") {
      const cachedDetails = channelDetailsCacheRef.current.get(activeConversation.id);
      if (cachedDetails) {
        setChannelDetails(cachedDetails);
      } else {
        getChannelDetails(wsId, activeConversation.id).then((res) => {
          if (!isCancelled && res.channel) {
            const details = res.channel as unknown as ChannelDetailsData;
            channelDetailsCacheRef.current.set(activeConversation.id, details);
            setChannelDetails(details);
          }
        });
      }
    } else {
      setChannelDetails(null);
    }

    return () => {
      isCancelled = true;
    };
  }, [
    activeConversation,
    activeWorkspace?.id,
    isReady,
    getStoreKey,
    resolveSenderName,
    resolveSenderAvatar,
    updateWorkspaceSummary,
  ]);

  // 7. Send Typing status (throttled)
  const sendTyping = useCallback(async () => {
    const active = activeConvRef.current;
    if (!active || active.type !== "direct") return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;

    try {
      const { DirectChannel } = await import("@nexconn/chat");
      const channel = new DirectChannel(active.nexconnTargetId);
      await channel.sendTypingStatus("RC:TxtMsg");
    } catch {}
  }, []);

  // 8. Send Text Message (tagged with workspaceId for strict multi-org isolation)
  const sendMessage = useCallback(
    async (
      text: string,
      replyToParam?: MessageReplyInfo,
      handoverDataParam?: HandoverReportData
    ): Promise<boolean> => {
      const active = activeConversation;
      const wsId = activeWorkspace?.id;
      if (!active || !wsId || wsId === "personal-fallback" || !text.trim()) return false;

      const myId = currentUserIdRef.current;
      const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const trimmedText = text.trim();
      const convKey = `${active.type}:${active.nexconnTargetId}`;
      const storeKey = getStoreKey(wsId, active.type, active.nexconnTargetId);
      const now = Date.now();
      const timeStr = new Date(now).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const effectiveReplyTo = replyToParam || replyingTo;
      const effectiveHandover = handoverDataParam;

      let payloadText = trimmedText;
      if (effectiveReplyTo || effectiveHandover) {
        payloadText = encodeRichMessage({
          v: 1,
          text: trimmedText,
          replyTo: effectiveReplyTo || undefined,
          handover: effectiveHandover || undefined,
        });
      }

      setReplyingTo(null);

      const optimisticMsg: ChatMessageItem = {
        id: optimisticId,
        senderId: myId || "me",
        senderName: "You",
        text: trimmedText,
        time: timeStr,
        timestamp: now,
        isMe: true,
        messageType: "RC:TxtMsg",
        channelType: active.type === "channel" ? 3 : 1,
        status: "sending",
        replyTo: effectiveReplyTo || undefined,
        isHandover: Boolean(effectiveHandover),
        handoverData: effectiveHandover || undefined,
        acknowledgments: [],
      };

      setRawMessages((prev) => [...prev, optimisticMsg]);
      setConversationsStore((prev) => ({
        ...prev,
        [storeKey]: [...(prev[storeKey] || []), optimisticMsg],
      }));

      const summaryLabel = effectiveHandover
        ? getHandoverSummaryLabel(effectiveHandover.shiftPeriod)
        : effectiveReplyTo
        ? `↩️ Replying to @${effectiveReplyTo.senderName}: ${trimmedText}`
        : trimmedText;

      updateWorkspaceSummary(wsId, convKey, (prev) => ({
        ...(prev || { unreadCount: 0 }),
        lastMessageText: summaryLabel,
        lastMessageTime: timeStr,
        lastMessageTimestamp: now,
        lastSenderId: myId || "me",
        lastSenderName: "You",
      }));

      try {
        const {
          GroupChannel,
          DirectChannel,
          SendTextMessageParams,
        } = await import("@nexconn/chat");

        const params = new SendTextMessageParams({
          text: payloadText,
          extra: JSON.stringify({ workspaceId: wsId }),
        });
        let sentResult: any = null;

        if (active.type === "channel") {
          const channel = new GroupChannel(active.nexconnTargetId);
          let res = await channel.sendMessage(params);
          if (res && !res.isOk && (res.code === 22406 || res.msg?.includes("22406"))) {
            try {
              await channel.join();
              res = await channel.sendMessage(params);
            } catch {}
          }
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send message to channel.");
          }
          sentResult = res;
        } else {
          const channel = new DirectChannel(active.nexconnTargetId);
          const res = await channel.sendMessage(params);
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send direct message.");
          }
          sentResult = res;

          getOrCreateDirectConversation(wsId, active.nexconnTargetId).catch(() => {});
          recordChatNotification({
            recipientUserId: active.nexconnTargetId,
            senderName: currentUser.name,
            workspaceId: wsId,
            conversationType: "direct",
            messageText: trimmedText,
          }).catch(() => {});
        }

        const realId = sentResult?.data?.messageId || optimisticId;
        const realTime = sentResult?.data?.sentTime || now;

        const updateMsg = (m: ChatMessageItem): ChatMessageItem =>
          m.id === optimisticId
            ? { ...m, id: realId, timestamp: realTime, status: "sent" }
            : m;

        setRawMessages((prev) => prev.map(updateMsg));
        setConversationsStore((prev) => ({
          ...prev,
          [storeKey]: (prev[storeKey] || []).map(updateMsg),
        }));

        return true;
      } catch (err: any) {
        console.error("Failed to send message:", err);
        setRawMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: "error" } : m))
        );
        return false;
      }
    },
    [
      activeConversation,
      activeWorkspace?.id,
      currentUser?.name,
      getStoreKey,
      replyingTo,
      updateWorkspaceSummary,
    ]
  );

  // 9. Send Secure Encrypted Media (bound to exact workspace AND conversation participant/channel!)
  const sendMedia = useCallback(
    async (
      file: File,
      caption?: string
    ): Promise<{ success: boolean; error?: string }> => {
      const active = activeConversation;
      const wsId = activeWorkspace?.id;
      if (!active || !file || !wsId || wsId === "personal-fallback") {
        return { success: false, error: "Select a conversation before sending media." };
      }

      const myId = currentUserIdRef.current;
      const optimisticId = `opt_media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const convKey = `${active.type}:${active.nexconnTargetId}`;
      const storeKey = getStoreKey(wsId, active.type, active.nexconnTargetId);
      const now = Date.now();
      const timeStr = new Date(now).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const kind = getMediaKindFromMime(file.type);
      const localPreviewUrl = URL.createObjectURL(file);
      const trimmedCaption = (caption || "").trim();

      const optimisticMsg: ChatMessageItem = {
        id: optimisticId,
        senderId: myId || "me",
        senderName: "You",
        text: trimmedCaption,
        time: timeStr,
        timestamp: now,
        isMe: true,
        messageType: "SPARK:SecureMedia",
        channelType: active.type === "channel" ? 3 : 1,
        status: "sending",
        fileInfo: {
          name: file.name,
          url: localPreviewUrl,
          size: file.size,
          mimeType: file.type,
          type: kind,
          encrypted: true,
        },
      };

      setRawMessages((prev) => [...prev, optimisticMsg]);
      setConversationsStore((prev) => ({
        ...prev,
        [storeKey]: [...(prev[storeKey] || []), optimisticMsg],
      }));

      try {
        const formData = new FormData();
        formData.append("workspaceId", wsId);
        formData.append("conversationType", active.type);
        formData.append("conversationTargetId", active.id);
        formData.append("file", file);

        const uploadRes = await fetch("/api/chat/media", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok || !uploadData.success || !uploadData.media) {
          throw new Error(uploadData.error || "Secure media upload failed.");
        }

        const envelope: SparkMediaEnvelope = {
          ...uploadData.media,
          ...(trimmedCaption ? { caption: trimmedCaption } : {}),
        };

        const {
          GroupChannel,
          DirectChannel,
          SendTextMessageParams,
        } = await import("@nexconn/chat");

        const encodedPayload = encodeMediaMessage(envelope);
        const params = new SendTextMessageParams({
          text: encodedPayload,
          extra: JSON.stringify({ workspaceId: wsId }),
        });

        let sentResult: any = null;
        if (active.type === "channel") {
          const channel = new GroupChannel(active.nexconnTargetId);
          let res = await channel.sendMessage(params);
          if (res && !res.isOk && (res.code === 22406 || res.msg?.includes("22406"))) {
            try {
              await channel.join();
              res = await channel.sendMessage(params);
            } catch {}
          }
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send media to channel.");
          }
          sentResult = res;
        } else {
          const channel = new DirectChannel(active.nexconnTargetId);
          const res = await channel.sendMessage(params);
          if (res && !res.isOk) {
            throw new Error(res.msg || "Failed to send direct media.");
          }
          sentResult = res;

          getOrCreateDirectConversation(wsId, active.nexconnTargetId).catch(() => {});
          recordChatNotification({
            recipientUserId: active.nexconnTargetId,
            senderName: currentUser.name,
            workspaceId: wsId,
            conversationType: "direct",
            messageText: caption?.trim() || "Sent an encrypted attachment",
          }).catch(() => {});
        }

        const realId = sentResult?.data?.messageId || optimisticId;
        const realTime = sentResult?.data?.sentTime || now;

        const updateMsg = (m: ChatMessageItem): ChatMessageItem =>
          m.id === optimisticId
            ? {
                ...m,
                id: realId,
                timestamp: realTime,
                status: "sent",
                fileInfo: {
                  name: envelope.name,
                  url: envelope.url,
                  size: envelope.size,
                  mimeType: envelope.mimeType,
                  type: envelope.kind,
                  encrypted: true,
                },
              }
            : m;

        setRawMessages((prev) => prev.map(updateMsg));
        setConversationsStore((prev) => ({
          ...prev,
          [storeKey]: (prev[storeKey] || []).map(updateMsg),
        }));

        updateWorkspaceSummary(wsId, convKey, (prev) => ({
          ...(prev || { unreadCount: 0 }),
          lastMessageText: getMediaSummaryLabel(envelope.kind, trimmedCaption),
          lastMessageTime: timeStr,
          lastMessageTimestamp: realTime,
          lastSenderId: myId || "me",
          lastSenderName: "You",
        }));

        URL.revokeObjectURL(localPreviewUrl);
        return { success: true };
      } catch (err: any) {
        console.error("Failed to send encrypted media:", err);
        setRawMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: "error" } : m))
        );
        return {
          success: false,
          error: err?.message || "Failed to send media.",
        };
      }
    },
    [activeConversation, activeWorkspace?.id, currentUser?.name, getStoreKey, updateWorkspaceSummary]
  );

  // 10. Acknowledge Shift Handover
  const acknowledgeHandover = useCallback(
    async (messageId: string, shiftPeriod: string, handoverAuthorId?: string): Promise<boolean> => {
      const wsId = activeWorkspace?.id;
      const active = activeConvRef.current;
      if (!wsId || !active || active.type !== "channel" || !messageId) return false;

      const res = await acknowledgeShiftHandover(
        wsId,
        active.id,
        messageId,
        shiftPeriod,
        handoverAuthorId
      );

      if (res.success && res.acknowledgment) {
        const newAck = res.acknowledgment;
        setHandoverAcks((prev) => {
          const list = prev[messageId] || [];
          if (list.some((a) => a.userId === newAck.userId)) return prev;
          return { ...prev, [messageId]: [...list, newAck] };
        });

        if (realtimeChannelRef.current) {
          try {
            realtimeChannelRef.current.send({
              type: "broadcast",
              event: "handover_ack",
              payload: { messageId, ack: newAck },
            });
          } catch {}
        }
        return true;
      }
      return false;
    },
    [activeWorkspace?.id]
  );

  // 11. Send Structured Shift Handover Report
  const sendHandoverReport = useCallback(
    async (data: HandoverReportData): Promise<boolean> => {
      const active = activeConvRef.current;
      const wsId = activeWorkspace?.id;
      if (!active || active.type !== "channel" || !wsId) return false;

      const summaryText = `📋 Shift Handover Report: ${data.shiftPeriod}`;
      const sent = await sendMessage(summaryText, undefined, data);

      if (sent) {
        notifyNewShiftHandover(
          wsId,
          active.id,
          active.name || "Channel",
          data.shiftPeriod
        ).catch(() => {});
      }
      return sent;
    },
    [activeWorkspace?.id, sendMessage]
  );

  // Auto-reconnect on network restoration
  useEffect(() => {
    const handleOnline = () => {
      if (activeWorkspace?.id && currentUser?.id && connectionStatus !== "CONNECTED") {
        connectNexconn(true);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [activeWorkspace?.id, currentUser?.id, connectionStatus, connectNexconn]);

  // Dynamically enrich active conversation messages with live Pending / Sent / Delivered / Seen receipts
  const messages = useMemo<ChatMessageItem[]>(() => {
    if (!activeConversation) return rawMessages;
    const myId = currentUserId || currentUser?.id || null;
    const canonicalKey = getCanonicalReceiptKey(
      activeConversation.type,
      activeConversation.nexconnTargetId,
      myId
    );
    const readersObj = canonicalKey ? readCursors[canonicalKey] || {} : {};
    const deliveredUpTo = canonicalKey ? deliveredCursors[canonicalKey] || 0 : 0;

    const isDirectPeerOnline =
      activeConversation.type === "direct" &&
      Boolean(onlineUserIds[activeConversation.nexconnTargetId]);

    const hasOtherOnlineChannelMember =
      activeConversation.type === "channel" &&
      Object.keys(onlineUserIds).some((uid) => uid !== myId);

    const otherReaders = Object.values(readersObj).filter(
      (r) => r.readerUserId !== myId
    );

    return rawMessages.map((msg) => {
      const acksForMsg = handoverAcks[msg.id] || msg.acknowledgments || [];

      if (!msg.isMe || msg.status === "sending" || msg.status === "error") {
        return {
          ...msg,
          acknowledgments: acksForMsg,
        };
      }

      const seenBy: MessageSeenEntry[] = [];
      for (const r of otherReaders) {
        if (r.lastReadTimestamp >= msg.timestamp) {
          seenBy.push({
            userId: r.readerUserId,
            name: r.readerName || resolveSenderName(r.readerUserId),
          });
        }
      }

      if (seenBy.length > 0) {
        return { ...msg, status: "read", seenBy, acknowledgments: acksForMsg };
      }

      if (
        deliveredUpTo >= msg.timestamp ||
        isDirectPeerOnline ||
        hasOtherOnlineChannelMember
      ) {
        return { ...msg, status: "delivered", seenBy: [], acknowledgments: acksForMsg };
      }

      return { ...msg, status: "sent", seenBy: [], acknowledgments: acksForMsg };
    });
  }, [
    activeConversation,
    rawMessages,
    currentUserId,
    currentUser?.id,
    readCursors,
    deliveredCursors,
    onlineUserIds,
    resolveSenderName,
    handoverAcks,
  ]);

  const summaries = useMemo<Record<string, ConversationSummary>>(() => {
    if (!activeWorkspace?.id) return {};
    return summariesByWorkspace[activeWorkspace.id] || {};
  }, [activeWorkspace?.id, summariesByWorkspace]);

  const activeKey = getActiveConvKey();
  const isOtherTyping = activeKey ? Boolean(typingStatus[activeKey]) : false;

  const totalUnreadCount = useMemo(() => {
    let total = 0;
    for (const c of channels) {
      total += summaries[`channel:${c.nexconnChannelId}`]?.unreadCount || 0;
    }
    for (const p of directPeers) {
      total += summaries[`direct:${p.id}`]?.unreadCount || 0;
    }
    return total;
  }, [channels, directPeers, summaries]);

  const forceRefreshChannels = useCallback(() => refreshChannels(true), [refreshChannels]);
  const forceRefreshDirectPeers = useCallback(
    () => refreshDirectPeers(true),
    [refreshDirectPeers]
  );
  const forceReconnect = useCallback(() => connectNexconn(true), [connectNexconn]);

  const contextValue = useMemo<NexconnChatContextValue>(
    () => ({
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
      replyingTo,
      setReplyingTo,
      handoverAcks,
      acknowledgeHandover,
      sendHandoverReport,
      refreshChannels: forceRefreshChannels,
      refreshDirectPeers: forceRefreshDirectPeers,
      reconnect: forceReconnect,
      summaries,
      sendTyping,
      isOtherTyping,
      totalUnreadCount,
      onlineUserIds,
      setIsConversationVisible,
    }),
    [
      isReady,
      isConnecting,
      connectionStatus,
      connectionError,
      currentUserId,
      channels,
      directPeers,
      activeConversation,
      messages,
      isLoadingMessages,
      channelDetails,
      sendMessage,
      sendMedia,
      replyingTo,
      handoverAcks,
      acknowledgeHandover,
      sendHandoverReport,
      forceRefreshChannels,
      forceRefreshDirectPeers,
      forceReconnect,
      summaries,
      sendTyping,
      isOtherTyping,
      totalUnreadCount,
      onlineUserIds,
    ]
  );

  return (
    <NexconnChatContext.Provider value={contextValue}>
      {children}
    </NexconnChatContext.Provider>
  );
}
