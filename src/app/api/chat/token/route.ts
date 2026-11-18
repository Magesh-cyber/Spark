import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import { issueNexconnChatToken, syncNexconnGroupChannel } from "@/lib/nexconn/server";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to generate chat token." },
        { status: 401 }
      );
    }

    let body: { workspaceId?: string } = {};
    try {
      body = await req.json();
    } catch {
      // Body may be empty or invalid JSON
    }

    const workspaceId = body.workspaceId;
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required to issue a workspace-scoped chat token." },
        { status: 400 }
      );
    }

    if (workspaceId === "personal-fallback") {
      return NextResponse.json(
        {
          error: "Workspace context is still loading. Chat token request deferred.",
          reason: "WORKSPACE_NOT_INITIALIZED",
        },
        { status: 400 }
      );
    }

    // Run workspace authorization, user profile lookup, and accessible channels query in parallel
    const [access, profile] = await Promise.all([
      verifyWorkspaceAccess(workspaceId),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true, avatarUrl: true, email: true },
      }),
    ]);

    const displayName = profile?.fullName || user.email?.split("@")[0] || "SPARK User";

    // Issue token via Nexconn Server API (served from cache in <1ms if already minted)
    const nexconnResult = await issueNexconnChatToken({
      userId: user.id,
      name: displayName,
      avatarUrl: profile?.avatarUrl || null,
    });

    // Synchronize user into workspace channels asynchronously (non-blocking for instant response)
    prisma.workspaceChatChannel
      .findMany({
        where: {
          workspaceId: access.workspace.id,
          OR: [
            { type: "PUBLIC" },
            { members: { some: { userId: user.id } } },
          ],
        },
        select: { nexconnChannelId: true, name: true },
      })
      .then((channels) =>
        Promise.all(
          channels.map((ch) =>
            syncNexconnGroupChannel(ch.nexconnChannelId, ch.name, [user.id])
          )
        )
      )
      .catch(() => {
        // Non-blocking background sync
      });

    return NextResponse.json({
      success: true,
      token: nexconnResult.token,
      userId: user.id,
      workspaceId: access.workspace.id,
      appKey: process.env.NEXT_PUBLIC_NEXCONN_APP_KEY,
    });
  } catch (err: any) {
    if (err instanceof WorkspaceAccessError) {
      let statusCode = 403;
      if (err.reason === "UNAUTHENTICATED") statusCode = 401;
      else if (err.reason === "WORKSPACE_NOT_FOUND") statusCode = 404;

      return NextResponse.json(
        { error: err.message, reason: err.reason },
        { status: statusCode }
      );
    }

    console.error("[Chat Token API Error]:", err?.message || err);

    return NextResponse.json(
      {
        error: err.message || "Failed to generate chat access token.",
        category: "NEXCONN_SERVER_API_ERROR",
      },
      { status: 500 }
    );
  }
}
