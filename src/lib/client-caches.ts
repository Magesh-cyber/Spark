"use client";

import type { WorkspaceDashboardData } from "@/lib/actions/dashboard";
import type { WorkspaceMemberItem } from "@/lib/types";
import type { ChatChannelItem } from "@/lib/actions/chat-channels";
import type { DirectMessagePeerItem } from "@/lib/actions/chat-direct";

interface TimedEntry<T> {
  data: T;
  updatedAt: number;
}

const dashboardMap = new Map<string, TimedEntry<WorkspaceDashboardData>>();
const membersMap = new Map<string, TimedEntry<WorkspaceMemberItem[]>>();
const channelsMap = new Map<string, TimedEntry<ChatChannelItem[]>>();
const peersMap = new Map<string, TimedEntry<DirectMessagePeerItem[]>>();
const nexconnTokenMap = new Map<
  string,
  TimedEntry<{ token: string; userId: string; appKey?: string }>
>();

// Data fetched within this window is considered fresh and skips redundant immediate refetches
export const FRESH_WINDOW_MS = 15_000;

function readSession<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function readLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
}

export const clientDashboardCache = {
  get(workspaceId: string): WorkspaceDashboardData | null {
    if (!workspaceId || workspaceId === "personal-fallback") return null;
    const mem = dashboardMap.get(workspaceId);
    if (mem) return mem.data;
    const stored = readSession<WorkspaceDashboardData>(`spark_dashboard_${workspaceId}`);
    if (stored) {
      dashboardMap.set(workspaceId, { data: stored, updatedAt: 0 });
      return stored;
    }
    return null;
  },
  isFresh(workspaceId: string): boolean {
    const mem = dashboardMap.get(workspaceId);
    return Boolean(mem && Date.now() - mem.updatedAt < FRESH_WINDOW_MS);
  },
  set(workspaceId: string, data: WorkspaceDashboardData): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !data) return;
    dashboardMap.set(workspaceId, { data, updatedAt: Date.now() });
    writeSession(`spark_dashboard_${workspaceId}`, data);
  },
  has(workspaceId: string): boolean {
    return this.get(workspaceId) !== null;
  },
};

export const clientMembersCache = {
  get(workspaceId: string): WorkspaceMemberItem[] | null {
    if (!workspaceId || workspaceId === "personal-fallback") return null;
    const mem = membersMap.get(workspaceId);
    if (mem) return mem.data;
    const stored = readSession<WorkspaceMemberItem[]>(`spark_members_${workspaceId}`);
    if (stored) {
      membersMap.set(workspaceId, { data: stored, updatedAt: 0 });
      return stored;
    }
    return null;
  },
  isFresh(workspaceId: string): boolean {
    const mem = membersMap.get(workspaceId);
    return Boolean(mem && Date.now() - mem.updatedAt < FRESH_WINDOW_MS);
  },
  set(workspaceId: string, members: WorkspaceMemberItem[]): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !members) return;
    membersMap.set(workspaceId, { data: members, updatedAt: Date.now() });
    writeSession(`spark_members_${workspaceId}`, members);
  },
  has(workspaceId: string): boolean {
    return this.get(workspaceId) !== null;
  },
};

export const clientChatCache = {
  getChannels(workspaceId: string): ChatChannelItem[] | null {
    if (!workspaceId || workspaceId === "personal-fallback") return null;
    const mem = channelsMap.get(workspaceId);
    if (mem) return mem.data;
    const stored = readSession<ChatChannelItem[]>(`spark_channels_${workspaceId}`);
    if (stored) {
      channelsMap.set(workspaceId, { data: stored, updatedAt: 0 });
      return stored;
    }
    return null;
  },
  isChannelsFresh(workspaceId: string): boolean {
    const mem = channelsMap.get(workspaceId);
    return Boolean(mem && Date.now() - mem.updatedAt < FRESH_WINDOW_MS);
  },
  setChannels(workspaceId: string, channels: ChatChannelItem[]): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !channels) return;
    channelsMap.set(workspaceId, { data: channels, updatedAt: Date.now() });
    writeSession(`spark_channels_${workspaceId}`, channels);
  },

  getPeers(workspaceId: string): DirectMessagePeerItem[] | null {
    if (!workspaceId || workspaceId === "personal-fallback") return null;
    const mem = peersMap.get(workspaceId);
    if (mem) return mem.data;
    const stored = readSession<DirectMessagePeerItem[]>(`spark_peers_${workspaceId}`);
    if (stored) {
      peersMap.set(workspaceId, { data: stored, updatedAt: 0 });
      return stored;
    }
    return null;
  },
  isPeersFresh(workspaceId: string): boolean {
    const mem = peersMap.get(workspaceId);
    return Boolean(mem && Date.now() - mem.updatedAt < FRESH_WINDOW_MS);
  },
  setPeers(workspaceId: string, peers: DirectMessagePeerItem[]): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !peers) return;
    peersMap.set(workspaceId, { data: peers, updatedAt: Date.now() });
    writeSession(`spark_peers_${workspaceId}`, peers);
  },

  getToken(workspaceId: string): { token: string; userId: string; appKey?: string } | null {
    if (!workspaceId || workspaceId === "personal-fallback") return null;
    const mem = nexconnTokenMap.get(workspaceId);
    // Keep pre-fetched token in memory for 30 minutes
    if (mem && Date.now() - mem.updatedAt < 30 * 60 * 1000) {
      return mem.data;
    }
    return null;
  },
  setToken(
    workspaceId: string,
    tokenData: { token: string; userId: string; appKey?: string }
  ): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !tokenData?.token) return;
    nexconnTokenMap.set(workspaceId, { data: tokenData, updatedAt: Date.now() });
  },

  getMessages(workspaceId: string, convKey: string): any[] | null {
    if (!workspaceId || workspaceId === "personal-fallback" || !convKey) return null;
    return readLocal<any[]>(`spark_msgs_${workspaceId}_${convKey}`);
  },
  setMessages(workspaceId: string, convKey: string, messages: any[]): void {
    if (!workspaceId || workspaceId === "personal-fallback" || !convKey || !messages) return;
    writeLocal(`spark_msgs_${workspaceId}_${convKey}`, messages);
  },
};

/**
 * Clears all client-side caches on sign out to prevent cross-account data bleed.
 */
export function clearAllClientCaches(): void {
  dashboardMap.clear();
  membersMap.clear();
  channelsMap.clear();
  peersMap.clear();
  nexconnTokenMap.clear();

  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("spark_")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));

      const localKeysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("spark_msgs_")) {
          localKeysToRemove.push(key);
        }
      }
      localKeysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }
}
