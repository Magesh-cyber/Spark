import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import { prisma } from "@/lib/prisma";
import {
  MAX_CHAT_MEDIA_BYTES,
  isAllowedMimeType,
  storeEncryptedChatMedia,
} from "@/lib/chat-media-crypto";
import type { SparkMediaEnvelope } from "@/lib/chat-media-envelope";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to upload media." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const workspaceId = String(formData.get("workspaceId") || "").trim();
    const rawConvType = String(formData.get("conversationType") || "").trim();
    const conversationTargetId = String(formData.get("conversationTargetId") || "").trim();
    const file = formData.get("file");

    const conversationType =
      rawConvType === "channel" || rawConvType === "direct" ? rawConvType : undefined;

    if (!workspaceId || workspaceId === "personal-fallback") {
      return NextResponse.json(
        { error: "Valid workspaceId is required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No media file provided." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Cannot send an empty file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_CHAT_MEDIA_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 15 MB maximum upload limit." },
        { status: 413 }
      );
    }

    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 }
      );
    }

    // 1. Strict multi-tenant workspace membership verification
    const access = await verifyWorkspaceAccess(workspaceId);

    // 2. Strict conversation-level authorization before accepting upload
    if (conversationType === "channel" && conversationTargetId) {
      const channel = await prisma.workspaceChatChannel.findUnique({
        where: { id: conversationTargetId },
        include: { members: { where: { userId: user.id } } },
      });
      if (!channel || channel.workspaceId !== access.workspace.id) {
        return NextResponse.json(
          { error: "Target channel does not belong to this workspace." },
          { status: 403 }
        );
      }
      if (
        channel.type === "PRIVATE" &&
        access.member.role !== "OWNER" &&
        access.member.role !== "ADMIN" &&
        channel.members.length === 0
      ) {
        return NextResponse.json(
          { error: "You are not a member of this private channel." },
          { status: 403 }
        );
      }
    } else if (conversationType === "direct" && conversationTargetId) {
      const peerMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: access.workspace.id,
            userId: conversationTargetId,
          },
        },
      });
      if (!peerMember || peerMember.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Recipient is not an active member of this workspace." },
          { status: 403 }
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { meta, signedUrl } = await storeEncryptedChatMedia({
      workspaceId: access.workspace.id,
      uploaderId: user.id,
      conversationType,
      conversationTargetId: conversationTargetId || undefined,
      originalName: file.name || "attachment",
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    const envelope: SparkMediaEnvelope = {
      v: 1,
      mediaId: meta.mediaId,
      url: signedUrl,
      name: meta.originalName,
      mimeType: meta.mimeType,
      size: meta.size,
      kind: meta.kind,
      encrypted: true,
    };

    return NextResponse.json({
      success: true,
      media: envelope,
    });
  } catch (err: any) {
    if (err instanceof WorkspaceAccessError) {
      const status =
        err.reason === "UNAUTHENTICATED"
          ? 401
          : err.reason === "WORKSPACE_NOT_FOUND"
          ? 404
          : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[Secure Media Upload Error]:", err?.stack || err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Failed to encrypt and upload media." },
      { status: 500 }
    );
  }
}
