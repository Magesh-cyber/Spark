import { ChatChannelItem } from "@/lib/actions/chat-channels";
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
  fileInfo?: {
    name: string;
    url: string;
    size?: number;
    type: "image" | "file";
  };
}

export interface ChannelDetailsData {
  id: string;
  name: string;
  description: string | null;
  type: "PUBLIC" | "PRIVATE";
  isDefault: boolean;
  creator: { id: string; fullName: string; avatarUrl: string | null };
  members: Array<{ id: string; fullName: string; avatarUrl: string | null; email: string }>;
  pinnedArtifacts: Array<{ id: string; title: string; url: string; pinnedBy: string; createdAt: string }>;
  createdAt: string;
}

