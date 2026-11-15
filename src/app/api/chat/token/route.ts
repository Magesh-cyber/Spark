import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";
import { issueNexconnChatToken } from "@/lib/nexconn/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Verify workspace access and active membership status
    const access = await verifyWorkspaceAccess(workspaceId);

    // Retrieve caller's profile for display synchronization
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, avatarUrl: true, email: true },
    });

    const displayName = profile?.fullName || user.email?.split("@")[0] || "SPARK User";

    // Issue token via Nexconn Server API
    const nexconnResult = await issueNexconnChatToken({
      userId: user.id,
      name: displayName,
      avatarUrl: profile?.avatarUrl || null,
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

