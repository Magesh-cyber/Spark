"use server";

import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess } from "@/lib/workspace-guard";
import type { ChatMessageItem, MessageReplyInfo, HandoverReportData } from "@/components/chat/types";

export interface PersistedMessagePayload {
  id: string;
  workspaceId: string;
  conversationType: "channel" | "direct";
  conversationTargetId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  messageType?: string;
  channelType?: number;
  fileInfo?: any;
  replyTo?: MessageReplyInfo;
  isHandover?: boolean;
  handoverData?: HandoverReportData;
  timestamp: number;
}

export async function getCanonicalConversationTarget(
  type: "channel" | "direct",
  targetId: string,
  userId: string
): Promise<string> {
  if (type === "channel") return targetId;
  const [a, b] = [userId, targetId].sort();
  return `${a}:${b}`;
}

/**
 * Persists a chat message (text, media, or handover report) to PostgreSQL.
 * For 1-on-1 direct conversations, target is deterministically sorted so both
 * participants query the exact same conversation history.
 */
export async function persistChatMessage(
  payload: PersistedMessagePayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(payload.workspaceId);
    const canonicalTarget = await getCanonicalConversationTarget(
      payload.conversationType,
      payload.conversationTargetId,
      access.user.id
    );

    await prisma.$executeRawUnsafe(
      `INSERT INTO "chat_messages" (
        "id", "workspace_id", "conversation_type", "conversation_target_id",
        "sender_id", "sender_name", "sender_avatar", "text", "message_type",
        "channel_type", "file_info", "reply_to", "is_handover", "handover_data",
        "timestamp"
      ) VALUES (
        $1, $2::uuid, $3, $4,
        $5::uuid, $6, $7, $8, $9,
        $10, $11::jsonb, $12::jsonb, $13, $14::jsonb,
        $15
      )
      ON CONFLICT ("id") DO UPDATE SET
        "text" = EXCLUDED."text",
        "file_info" = EXCLUDED."file_info",
        "reply_to" = EXCLUDED."reply_to",
        "is_handover" = EXCLUDED."is_handover",
        "handover_data" = EXCLUDED."handover_data"`,
      payload.id,
      access.workspace.id,
      payload.conversationType,
      canonicalTarget,
      access.user.id,
      payload.senderName || access.user.email?.split("@")[0] || "User",
      payload.senderAvatar || null,
      payload.text || "",
      payload.messageType || "RC:TxtMsg",
      payload.channelType || (payload.conversationType === "channel" ? 3 : 1),
      payload.fileInfo ? JSON.stringify(payload.fileInfo) : null,
      payload.replyTo ? JSON.stringify(payload.replyTo) : null,
      Boolean(payload.isHandover),
      payload.handoverData ? JSON.stringify(payload.handoverData) : null,
      BigInt(payload.timestamp || Date.now())
    );

    // If direct message, update lastMessageAt in chatDirectConversation
    if (payload.conversationType === "direct") {
      const [user1Id, user2Id] = [access.user.id, payload.conversationTargetId].sort();
      prisma.chatDirectConversation
        .upsert({
          where: {
            workspaceId_user1Id_user2Id: {
              workspaceId: access.workspace.id,
              user1Id,
              user2Id,
            },
          },
          create: {
            workspaceId: access.workspace.id,
            user1Id,
            user2Id,
            lastMessageAt: new Date(),
          },
          update: {
            lastMessageAt: new Date(),
          },
        })
        .catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    console.error("[persistChatMessage Error]:", err?.message || err);
    return { success: false, error: err?.message || "Failed to persist message." };
  }
}

/**
 * Loads persisted message history from PostgreSQL for a channel or direct conversation.
 */
export async function getPersistedMessages(
  workspaceId: string,
  conversationType: "channel" | "direct",
  conversationTargetId: string,
  limit: number = 100
): Promise<{ success: boolean; messages: ChatMessageItem[]; error?: string }> {
  try {
    const access = await verifyWorkspaceAccess(workspaceId);
    const canonicalTarget = await getCanonicalConversationTarget(
      conversationType,
      conversationTargetId,
      access.user.id
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "workspace_id", "conversation_type", "conversation_target_id",
              "sender_id", "sender_name", "sender_avatar", "text", "message_type",
              "channel_type", "file_info", "reply_to", "is_handover", "handover_data",
              "timestamp"
       FROM "chat_messages"
       WHERE "workspace_id" = $1::uuid
         AND "conversation_type" = $2
         AND "conversation_target_id" = $3
       ORDER BY "timestamp" ASC
       LIMIT $4`,
      access.workspace.id,
      conversationType,
      canonicalTarget,
      limit
    );

    const currentUserId = access.user.id;
    const messages: ChatMessageItem[] = (rows || []).map((r) => {
      const isMe = r.sender_id === currentUserId;
      const ts = Number(r.timestamp);
      return {
        id: r.id,
        senderId: r.sender_id,
        senderName: isMe ? "You" : r.sender_name,
        senderAvatar: isMe ? undefined : r.sender_avatar || undefined,
        text: r.text,
        time: new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: ts,
        isMe,
        messageType: r.message_type,
        channelType: r.channel_type,
        status: "sent",
        fileInfo: r.file_info || undefined,
        replyTo: r.reply_to || undefined,
        isHandover: Boolean(r.is_handover),
        handoverData: r.handover_data || undefined,
      };
    });

    return { success: true, messages };
  } catch (err: any) {
    console.error("[getPersistedMessages Error]:", err?.message || err);
    return { success: false, messages: [], error: err?.message || "Failed to load messages." };
  }
}
