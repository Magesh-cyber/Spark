import "server-only";
import crypto from "crypto";

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
      return "https://api.sg-light-api.com";
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

  // Official Postman specification: SHA-1 hex hash of (AppSecret + Nonce + Timestamp)
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
 * Issues or retrieves a chat access token for an authenticated SPARK user
 * by communicating with the official Nexconn Server API.
 */
export async function issueNexconnChatToken(
  params: NexconnIssueTokenParams
): Promise<NexconnTokenResponse> {
  const primaryBaseUrl = getNexconnApiBaseUrl();
  const headers = generateNexconnHeaders();

  // URL-encoded parameters per official Postman collection
  const bodyParams = new URLSearchParams({
    userId: params.userId,
    name: params.name,
    portraitUri: params.avatarUrl || "https://spark.workplace/default-avatar.png",
  });

  const candidateEndpoints = [
    `${primaryBaseUrl}/user/getToken.json`,
    "https://api.sg-light-api.com/user/getToken.json",
    "https://api-b.sg-light-api.com/user/getToken.json",
    "https://api.sg-b-light-api.com/user/getToken.json",
    "https://api.us-light-api.com/user/getToken.json",
    "https://api.rong-api.com/user/getToken.json",
  ];

  // Deduplicate endpoints
  const uniqueEndpoints = [...new Set(candidateEndpoints)];

  let lastError: Error | null = null;
  let lastErrorCode: number | null = null;

  for (const endpoint of uniqueEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: bodyParams.toString(),
        cache: "no-store",
      });

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        // Non-JSON response
      }

      if (response.ok && data.code === 200 && data.token) {
        return {
          code: 200,
          userId: data.userId || params.userId,
          token: data.token,
        };
      }

      if (data.code) {
        lastErrorCode = data.code;
        lastError = new Error(
          data.errorMessage || data.msg || `Nexconn Server Error (Code: ${data.code})`
        );
      } else {
        lastError = new Error(`Server returned HTTP ${response.status}: ${text.substring(0, 100)}`);
      }
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw new Error(
    `Failed to issue Nexconn access token: ${lastError?.message || "Unknown error"}${
      lastErrorCode ? ` [Code: ${lastErrorCode}]` : ""
    }`
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
