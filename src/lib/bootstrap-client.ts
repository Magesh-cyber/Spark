"use client";

import type { BootstrapPayload } from "@/app/api/bootstrap/route";
import {
  clientDashboardCache,
  clientMembersCache,
  clientChatCache,
} from "./client-caches";

type BootstrapListener = (payload: BootstrapPayload) => void;

const listeners = new Set<BootstrapListener>();
const inFlightByKey = new Map<string, Promise<BootstrapPayload | null>>();
let lastPayload: BootstrapPayload | null = null;
let lastFetchedAt = 0;

export function subscribeBootstrap(listener: BootstrapListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLastBootstrapPayload(): BootstrapPayload | null {
  return lastPayload;
}

export function clearBootstrapMemory(): void {
  lastPayload = null;
  lastFetchedAt = 0;
  inFlightByKey.clear();
}

function hydrateAllCaches(payload: BootstrapPayload, preloadOnly = false): void {
  const wsId = payload.activeWorkspace?.id;
  if (!wsId) return;

  // Hydrate all module caches simultaneously for 0ms page switches
  if (payload.dashboard) {
    clientDashboardCache.set(wsId, payload.dashboard);
  }
  if (payload.members) {
    clientMembersCache.set(wsId, payload.members);
  }
  if (payload.channels) {
    clientChatCache.setChannels(wsId, payload.channels);
  }
  if (payload.directPeers) {
    clientChatCache.setPeers(wsId, payload.directPeers);
  }
  if (payload.chatToken) {
    clientChatCache.setToken(wsId, payload.chatToken);
  }

  // If preloadOnly (e.g., hovering over another workspace in switcher), do not change active workspace
  if (preloadOnly) {
    return;
  }

  lastPayload = payload;
  lastFetchedAt = Date.now();

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("spark_cached_user", JSON.stringify(payload.user));
      localStorage.setItem("spark_cached_workspaces", JSON.stringify(payload.workspaces));
      localStorage.setItem("spark_active_workspace_id", wsId);
      document.cookie = `spark_active_workspace_id=${wsId}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}
  }

  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch {}
  });
}

/**
 * Fetches the full user + workspace + dashboard + team + chat + token bundle
 * in ONE single server round-trip and hydrates every client cache immediately.
 * Safe to call right during login, app mount, or workspace switching.
 */
export async function prefetchWorkspaceBootstrap(
  workspaceId?: string,
  options?: { force?: boolean; preloadOnly?: boolean }
): Promise<BootstrapPayload | null> {
  const preloadOnly = Boolean(options?.preloadOnly);
  const key = `${workspaceId || "__default__"}${preloadOnly ? ":preload" : ""}`;

  // Return recent cached payload if fresh (< 8s) and matching workspace
  if (
    !options?.force &&
    !preloadOnly &&
    lastPayload &&
    Date.now() - lastFetchedAt < 8000 &&
    (!workspaceId || lastPayload.activeWorkspace.id === workspaceId)
  ) {
    return lastPayload;
  }

  // For hover preload, skip if dashboard & channels for that workspace are already fresh
  if (
    preloadOnly &&
    workspaceId &&
    clientDashboardCache.isFresh(workspaceId) &&
    clientChatCache.isChannelsFresh(workspaceId)
  ) {
    return null;
  }

  // Deduplicate concurrent requests for the same workspace
  const existing = inFlightByKey.get(key);
  if (existing) {
    return existing;
  }

  const url = workspaceId
    ? `/api/bootstrap?workspaceId=${encodeURIComponent(workspaceId)}`
    : "/api/bootstrap";

  const promise = (async (): Promise<BootstrapPayload | null> => {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        return null;
      }

      const data: BootstrapPayload = await res.json();
      if (data && data.activeWorkspace?.id) {
        hydrateAllCaches(data, preloadOnly);
        return data;
      }
      return null;
    } catch (err) {
      console.error("[Bootstrap Prefetch Error]:", err);
      return null;
    } finally {
      inFlightByKey.delete(key);
    }
  })();

  inFlightByKey.set(key, promise);
  return promise;
}
