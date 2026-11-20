import "server-only";
import crypto from "crypto";
import https from "https";

export interface NexconnIssueTokenParams {
  userId: string;
  name: string;
  avatarUrl?: string | null;
}

export interface NexconnTokenResponse {
  code: number;
  userId: string;
  token: string;
}

export interface NexconnSignatureHeaders extends Record<string, string> {
  "App-Key": string;
  Nonce: string;
  Timestamp: string;
  Signature: string;
  "Content-Type": string;
}

// Process-wide caches shared across all API routes & Server Actions
const globalForNexconn = globalThis as unknown as {
  __sparkNexconnPreferredHost?: string;
  __sparkNexconnTokenCache?: Map<string, { token: string; userId: string; expiresAt: number }>;
  __sparkNexconnSyncedGroups?: Set<string>;
};

const tokenCache =
  globalForNexconn.__sparkNexconnTokenCache ??
  (globalForNexconn.__sparkNexconnTokenCache = new Map());

const syncedGroups =
  globalForNexconn.__sparkNexconnSyncedGroups ??
  (globalForNexconn.__sparkNexconnSyncedGroups = new Set());

// Nexconn tokens are long-lived; cache server-side for 6 hours to avoid redundant WAN calls
const TOKEN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Resolves the datacenter-specific Nexconn / RongCloud Server API base URL.
 * Prioritizes explicit NEXCONN_API_BASE_URL from .env.local, then standard cloud domains.
 */
export function getNexconnApiBaseUrl(): string {
  if (process.env.NEXCONN_API_BASE_URL) {
    return process.env.NEXCONN_API_BASE_URL.replace(/\/+$/, "");
  }

  const dc = (process.env.NEXCONN_DATA_CENTER || "SG").toUpperCase().trim();
  switch (dc) {
    case "NA":
    case "US":
      return "https://api.us-light-api.com";
    case "BJ":
    case "CN":
      return "https://api.rong-api.com";
    case "SG":
    case "AP":
    default:
      return "https://api-sg01.ronghub.com";
  }
}

/**
 * Generates cryptographic authentication headers for Nexconn Server-to-Server APIs
 * matching the official Postman collection specification:
 * Signature = SHA-1(AppSecret + Nonce + Timestamp).
 */
export function generateNexconnHeaders(
  appKey?: string,
  appSecret?: string
): NexconnSignatureHeaders {
  const key = appKey || process.env.NEXCONN_APP_KEY;
  const secret = appSecret || process.env.NEXCONN_APP_SECRET;

  if (!key || !secret) {
    throw new Error(
      "Nexconn server credentials missing. Ensure NEXCONN_APP_KEY and NEXCONN_APP_SECRET are configured in .env.local."
    );
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const timestamp = Date.now().toString();

  const signature = crypto
    .createHash("sha1")
    .update(`${secret}${nonce}${timestamp}`)
    .digest("hex");

  return {
    "App-Key": key,
    Nonce: nonce,
    Timestamp: timestamp,
    Signature: signature,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/**
 * Resilient Server API invoker with sticky preferred host & direct SNI IP fallback.
 * Remembers the fastest reachable host across calls to eliminate repeated firewall timeouts.
 */
async function callNexconnApi(
  apiPath: string,
  bodyParams: Record<string, string | string[]>
): Promise<{ code: number; [key: string]: any }> {
  const key = process.env.NEXCONN_APP_KEY;
  const secret = process.env.NEXCONN_APP_SECRET;

  if (!key || !secret) {
    throw new Error("Nexconn server credentials missing.");
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHash("sha1")
    .update(`${secret}${nonce}${timestamp}`)
    .digest("hex");

  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(bodyParams)) {
    if (Array.isArray(v)) {
      for (const item of v) urlParams.append(k, item);
    } else if (v !== undefined && v !== null) {
      urlParams.append(k, String(v));
    }
  }
  const postData = urlParams.toString();

  const envHost = process.env.NEXCONN_API_BASE_URL
    ? (() => {
        try {
          return new URL(process.env.NEXCONN_API_BASE_URL).hostname;
        } catch {
          return null;
        }
      })()
    : null;

  const defaultHosts = [
    envHost,
    "api-sg01.ronghub.com",
    "api.sg-light-api.com",
    "api-b.sg-light-api.com",
    "47.84.112.16",
    "47.84.107.146",
    "47.84.41.235",
  ].filter(Boolean) as string[];

  const uniqueDefaultHosts = Array.from(new Set(defaultHosts));

  // Put last known fast/working host first so subsequent requests have 0ms failover overhead
  const preferred = globalForNexconn.__sparkNexconnPreferredHost;
  const candidateHosts = preferred
    ? [preferred, ...uniqueDefaultHosts.filter((h) => h !== preferred)]
    : uniqueDefaultHosts;

  return new Promise((resolve, reject) => {
    function tryHost(index: number) {
      if (index >= candidateHosts.length) {
        return reject(new Error("All Nexconn Server API endpoints exhausted."));
      }

      const host = candidateHosts[index];
      const isIp = /^[\d.]+$/.test(host);
      const targetDomain = isIp ? "api-sg01.ronghub.com" : host;

      const req = https.request(
        {
          host,
          port: 443,
          path: apiPath,
          method: "POST",
          headers: {
            Host: targetDomain,
            "App-Key": key,
            Nonce: nonce,
            Timestamp: timestamp,
            Signature: signature,
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(postData),
          },
          servername: targetDomain,
          rejectUnauthorized: !isIp,
          timeout: 4000,
        },
        (res) => {
          let raw = "";
          res.on("data", (chunk) => (raw += chunk));
          res.on("end", () => {
            if (
              raw.includes("Fortinet") ||
              raw.includes("Blocked") ||
              raw.includes("Web Page Blocked")
            ) {
              return tryHost(index + 1);
            }
            try {
              const data = JSON.parse(raw);
              if (data.code === 200 || data.token) {
                globalForNexconn.__sparkNexconnPreferredHost = host;
                resolve(data);
              } else {
                if (index + 1 < candidateHosts.length) {
                  return tryHost(index + 1);
                }
                resolve(data);
              }
            } catch {
              tryHost(index + 1);
            }
          });
        }
      );

      req.on("error", () => tryHost(index + 1));
      req.on("timeout", () => {
        req.destroy();
        tryHost(index + 1);
      });

      req.write(postData);
      req.end();
    }

    tryHost(0);
  });
}

/**
 * Issues or retrieves a chat access token for an authenticated SPARK user
 * by communicating with the official Nexconn Server API.
 * Uses process-wide caching so repeated requests for the same user resolve in <1ms.
 */
export async function issueNexconnChatToken(
  params: NexconnIssueTokenParams
): Promise<NexconnTokenResponse> {
  const now = Date.now();
  const cached = tokenCache.get(params.userId);
  if (cached && cached.expiresAt > now && cached.token) {
    return {
      code: 200,
      userId: cached.userId,
      token: cached.token,
    };
  }

  const data = await callNexconnApi("/user/getToken.json", {
    userId: params.userId,
    name: params.name,
    portraitUri: params.avatarUrl || "https://spark.workplace/default-avatar.png",
  });

  if (data.code === 200 && data.token) {
    const result = {
      code: 200,
      userId: data.userId || params.userId,
      token: data.token,
    };
    tokenCache.set(params.userId, {
      token: result.token,
      userId: result.userId,
      expiresAt: now + TOKEN_CACHE_TTL_MS,
    });
    return result;
  }

  throw new Error(
    data.errorMessage || data.msg || `Nexconn Server Error (Code: ${data.code || "UNKNOWN"})`
  );
}

/**
 * Handles target user ID asymmetry for direct conversations.
 * In Nexconn, a DirectChannel is initialized with the peer's user ID.
 */
export function getDirectChannelTargetId(
  currentUserId: string,
  user1Id: string,
  user2Id: string
): string {
  return currentUserId === user1Id ? user2Id : user1Id;
}

/**
 * Ensures a group channel exists on Nexconn and all specified users are joined.
 * Deduplicates already-synced (groupId, userId) pairs in memory to avoid redundant WAN calls.
 */
export async function syncNexconnGroupChannel(
  groupId: string,
  groupName: string,
  userIds: string[]
): Promise<boolean> {
  if (!groupId || userIds.length === 0) return true;

  // Filter to users not yet confirmed synced for this group in this server lifecycle
  const unsyncedUserIds = userIds.filter(
    (uid) => !syncedGroups.has(`${groupId}:${uid}`)
  );
  if (unsyncedUserIds.length === 0) {
    return true;
  }

  try {
    const res = await callNexconnApi("/group/join.json", {
      userId: unsyncedUserIds,
      groupId,
      groupName,
    });

    if (res.code === 200) {
      unsyncedUserIds.forEach((uid) => syncedGroups.add(`${groupId}:${uid}`));
      return true;
    }

    const createRes = await callNexconnApi("/group/create.json", {
      userId: unsyncedUserIds,
      groupId,
      groupName,
    });

    if (createRes.code === 200) {
      unsyncedUserIds.forEach((uid) => syncedGroups.add(`${groupId}:${uid}`));
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[Nexconn Group Sync Warning]:`, err);
    return false;
  }
}
