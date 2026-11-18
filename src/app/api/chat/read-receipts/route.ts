import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth-cache";
import { verifyWorkspaceAccess, WorkspaceAccessError } from "@/lib/workspace-guard";

export const dynamic = "force-dynamic";

export interface ReadCursorEntry {
  readerUserId: string;
  readerName: string;
  lastReadTimestamp: number;
  updatedAt: number;
}

// Workspace-scoped read receipt cursors:
// workspaceId -> convKey -> readerUserId -> ReadCursorEntry
type WorkspaceReadStore = Map<string, Map<string, Map<string, ReadCursorEntry>>>;

const globalForReceipts = globalThis as unknown as {
  __sparkReadReceiptsStore?: WorkspaceReadStore;
};

const readStore: WorkspaceReadStore =
  globalForReceipts.__sparkReadReceiptsStore ??
  (globalForReceipts.__sparkReadReceiptsStore = new Map());

/**
 * GET /api/chat/read-receipts?workspaceId=<id>
 * Returns all persisted read receipt cursors for the authorized workspace.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const workspaceId = req.nextUrl.searchParams.get("workspaceId") || "";
    if (!workspaceId || workspaceId === "personal-fallback") {
      return NextResponse.json({ receipts: {} });
    }

    const access = await verifyWorkspaceAccess(workspaceId);
    const wsMap = readStore.get(access.workspace.id);

    const receipts: Record<string, Record<string, ReadCursorEntry>> = {};
    if (wsMap) {
      for (const [convKey, readersMap] of wsMap.entries()) {
        receipts[convKey] = {};
        for (const [readerId, entry] of readersMap.entries()) {
          receipts[convKey][readerId] = entry;
        }
      }
    }

    return NextResponse.json({ receipts }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ receipts: {} });
  }
}

/**
 * POST /api/chat/read-receipts
 * Persists a verified read cursor for the caller inside a workspace conversation.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await req.json();
    const workspaceId = String(body.workspaceId || "");
    const convKey = String(body.convKey || "");
    const readerName = String(body.readerName || user.email?.split("@")[0] || "Member");
    const lastReadTimestamp = Number(body.lastReadTimestamp || 0);

    if (!workspaceId || !convKey || !lastReadTimestamp || lastReadTimestamp <= 0) {
      return NextResponse.json({ error: "Invalid read receipt payload." }, { status: 400 });
    }

    const access = await verifyWorkspaceAccess(workspaceId);
    const wsId = access.workspace.id;

    let wsMap = readStore.get(wsId);
    if (!wsMap) {
      wsMap = new Map();
      readStore.set(wsId, wsMap);
    }

    let readersMap = wsMap.get(convKey);
    if (!readersMap) {
      readersMap = new Map();
      wsMap.set(convKey, readersMap);
    }

    const existing = readersMap.get(user.id);
    if (!existing || lastReadTimestamp > existing.lastReadTimestamp) {
      readersMap.set(user.id, {
        readerUserId: user.id,
        readerName,
        lastReadTimestamp,
        updatedAt: Date.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err instanceof WorkspaceAccessError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to record read receipt." }, { status: 500 });
  }
}
