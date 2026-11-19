import { DirectMessagePeerItem } from "@/lib/actions/chat-direct";

export type ConversationType = "channel" | "direct";

export interface ActiveConversation {
  type: ConversationType;
  id: string; // Database ID (WorkspaceChatChannel.id or User.id for direct)
  name: string;
  nexconnTargetId: string; // nexconnChannelId for group, peerUserId for direct
  description?: string | null;
  isPrivate?: boolean;
  peer?: DirectMessagePeerItem;
}

export interface MessageSeenEntry {
  userId: string;
  name: string;
}

export interface MessageReplyInfo {
  messageId: string;
  senderName: string;
  senderId?: string;
  text: string;
}

export interface HandoverReportData {
  shiftPeriod: string;
  completed: string;
  inProgress: string;
  blockers: string;
  nextSteps: string;
}

export interface HandoverSignOff {
  id?: string;
  messageId?: string;
  shiftPeriod?: string;
  userId: string;
  userName: string;
  createdAt?: string;
  timestamp: number;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  time: string;
  timestamp: number;
  isMe: boolean;
  messageType: string;
  status?: "sending" | "sent" | "delivered" | "read" | "error";
  seenBy?: MessageSeenEntry[];
  channelType?: number; // 1 = Direct, 3 = Group
  fileInfo?: {
    name: string;
    url: string;
    size?: number;
    mimeType?: string;
    type: "image" | "video" | "audio" | "file";
    encrypted?: boolean;
  };
  replyTo?: MessageReplyInfo;
  isHandover?: boolean;
  handoverData?: HandoverReportData;
  acknowledgments?: HandoverSignOff[];
}

export interface ConversationSummary {
  lastMessageText?: string;
  lastMessageTime?: string;
  lastMessageTimestamp?: number;
  lastSenderId?: string;
  lastSenderName?: string;
  unreadCount: number;
  isTyping?: boolean;
}

export interface ChannelDetailsData {
  id: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "PRIVATE";
  joinCode?: string | null;
  isDefault: boolean;
  creator: { id: string; fullName: string; avatarUrl: string | null };
  members: Array<{ id: string; fullName: string; avatarUrl: string | null; email: string }>;
  pinnedArtifacts: Array<{ id: string; title: string; url: string; pinnedBy: string; createdAt: string }>;
  createdAt: string;
}
