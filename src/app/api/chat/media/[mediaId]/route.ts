import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import { prisma } from "@/lib/prisma";
import {
  verifyMediaSignature,
  readDecryptedChatMedia,
} from "@/lib/chat-media-crypto";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: { mediaId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const mediaId = context.params?.mediaId || "";
    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    const sig = req.nextUrl.searchParams.get("sig");
    const forceDownload = req.nextUrl.searchParams.get("download") === "1";

    if (!mediaId || !workspaceId) {
      return NextResponse.json({ error: "Invalid media request." }, { status: 400 });
    }

    // 1. Verify HMAC-SHA256 tamper-proof signature
    if (!verifyMediaSignature(mediaId, workspaceId, sig)) {
      return NextResponse.json({ error: "Invalid media signature." }, { status: 403 });
    }

    // 2. Verify active workspace membership (prevents cross-organization & revoked access)
    const access = await verifyWorkspaceAccess(workspaceId);

    // 3. Decrypt AES-256-GCM media payload and verify GCM auth tag integrity
    const decrypted = await readDecryptedChatMedia(access.workspace.id, mediaId);
    if (!decrypted) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    const { meta, buffer } = decrypted;

    // 4. Strict Conversation-Level Access Control (Direct Message participants & Private Channel members)
    if (meta.conversationType === "direct" && meta.conversationTargetId) {
      const isParticipant =
        user.id === meta.uploaderId || user.id === meta.conversationTargetId;
      if (!isParticipant) {
        return NextResponse.json(
          { error: "Access denied. Only participants of this direct conversation can view this media." },
          { status: 403 }
        );
      }
    } else if (meta.conversationType === "channel" && meta.conversationTargetId) {
      const channel = await prisma.workspaceChatChannel.findUnique({
        where: { id: meta.conversationTargetId },
        include: { members: { where: { userId: user.id } } },
      });
      if (!channel || channel.workspaceId !== access.workspace.id) {
        return NextResponse.json(
          { error: "Channel not found in this workspace." },
          { status: 404 }
        );
      }
      if (
        channel.type === "PRIVATE" &&
        access.member.role !== "OWNER" &&
        access.member.role !== "ADMIN" &&
        channel.members.length === 0
      ) {
        return NextResponse.json(
          { error: "Access denied. You are not a member of this private channel." },
          { status: 403 }
        );
      }
    }

    const totalLength = buffer.length;
    const disposition =
      forceDownload || meta.kind === "file"
        ? `attachment; filename="${meta.originalName.replace(/"/g, "")}"`
        : `inline; filename="${meta.originalName.replace(/"/g, "")}"`;

    // Support HTTP Range requests for smooth HTML5 video & audio playback on mobile/desktop
    const rangeHeader = req.headers.get("range");
    if (rangeHeader && (meta.kind === "video" || meta.kind === "audio")) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2]
          ? Math.min(parseInt(match[2], 10), totalLength - 1)
          : totalLength - 1;
        if (start < totalLength && start <= end) {
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(new Uint8Array(chunk), {
            status: 206,
            headers: {
              "Content-Type": meta.mimeType,
              "Content-Length": String(chunk.length),
              "Content-Range": `bytes ${start}-${end}/${totalLength}`,
              "Accept-Ranges": "bytes",
              "Content-Disposition": disposition,
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "private, max-age=3600",
            },
          });
        }
      }
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": meta.mimeType,
        "Content-Length": String(totalLength),
        "Accept-Ranges": "bytes",
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
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
    console.error("[Secure Media Download Error]:", err?.message || err);
    return NextResponse.json({ error: "Failed to serve media." }, { status: 500 });
  }
}
