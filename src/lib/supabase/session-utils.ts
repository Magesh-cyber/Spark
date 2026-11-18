/**
 * Session and JWT utilities for low-latency cookie inspection and token validation.
 * Extracts and decodes JWT tokens locally to eliminate redundant WAN roundtrips to Supabase Auth.
 */

export interface DecodedAuthToken {
  sub: string;
  email?: string;
  role?: string;
  exp: number;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

/**
 * Extracts raw access token from single or chunked Supabase SSR cookies.
 */
export function extractTokenFromCookieValue(rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;

  let decoded = rawValue.trim();

  // Handle URL encoding if present
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep decoded as-is if URI decoding fails
  }

  // Handle Supabase base64 prefix
  if (decoded.startsWith("base64-")) {
    try {
      const base64Str = decoded.slice(7);
      decoded = Buffer.from(base64Str, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  // Handle JSON array: [access_token, refresh_token, ...]
  // or JSON object: { access_token: "...", ... }
  try {
    const parsed = JSON.parse(decoded);
    if (typeof parsed === "string") {
      if (parsed.startsWith("eyJ")) return parsed;
      return null;
    }
    if (Array.isArray(parsed) && typeof parsed[0] === "string" && parsed[0].startsWith("eyJ")) {
      return parsed[0];
    }
    if (parsed && typeof parsed.access_token === "string" && parsed.access_token.startsWith("eyJ")) {
      return parsed.access_token;
    }
  } catch {
    // If not JSON, check if it's already a raw JWT string
    if (decoded.startsWith("eyJ")) {
      return decoded;
    }
  }

  return null;
}

/**
 * Resolves full auth token from any cookie getter that provides getAll().
 */
export function getAuthTokenFromCookies(
  cookieJar: { getAll: () => Array<{ name: string; value: string }> }
): string | null {
  const allCookies = cookieJar.getAll();
  const authCookies = allCookies.filter((c) => c.name.includes("-auth-token"));

  if (authCookies.length === 0) {
    return null;
  }

  // 1. Try single exact cookie first (e.g. sb-projectref-auth-token)
  const single = authCookies.find((c) => c.name.endsWith("-auth-token"));
  if (single && single.value) {
    const token = extractTokenFromCookieValue(single.value);
    if (token) return token;
  }

  // 2. Try chunked cookies (e.g. sb-projectref-auth-token.0, .1, etc.)
  const chunked = authCookies
    .filter((c) => /\-auth-token\.\d+$/.test(c.name))
    .sort((a, b) => {
      const aIdx = parseInt(a.name.split(".").pop() || "0", 10);
      const bIdx = parseInt(b.name.split(".").pop() || "0", 10);
      return aIdx - bIdx;
    });

  if (chunked.length > 0) {
    const combinedValue = chunked.map((c) => c.value).join("");
    const token = extractTokenFromCookieValue(combinedValue);
    if (token) return token;
  }

  return null;
}

/**
 * Safely parses the payload of a JWT without verifying the signature.
 * Used for checking expiration and claims locally without network roundtrips.
 */
export function parseJwtPayload(token: string): DecodedAuthToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    const payload = JSON.parse(jsonPayload);

    if (payload && typeof payload.sub === "string" && typeof payload.exp === "number") {
      return payload as DecodedAuthToken;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Checks whether a token is present and remains valid for at least minRemainingSeconds.
 */
export function isTokenValid(token: string | null, minRemainingSeconds: number = 60): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  if (!payload) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds > minRemainingSeconds;
}

