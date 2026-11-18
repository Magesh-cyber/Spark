import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getAuthTokenFromCookies,
  parseJwtPayload,
} from "./session-utils";
import type { User } from "@supabase/supabase-js";

interface CachedUserEntry {
  user: User;
  expiresAt: number;
}

// Persist across webpack bundles / API routes / Server Actions in the Node process
const globalForAuthCache = globalThis as unknown as {
  __sparkAuthTokenCache?: Map<string, CachedUserEntry>;
};

const tokenCache =
  globalForAuthCache.__sparkAuthTokenCache ??
  (globalForAuthCache.__sparkAuthTokenCache = new Map<string, CachedUserEntry>());

// Cache verified JWT -> User for up to 2 minutes (always strictly bounded by JWT exp)
const MAX_CACHE_TTL_MS = 120 * 1000;

/**
 * Resolves the authenticated user from the current request cookies.
 * Uses a shared process-wide token cache to eliminate redundant 680ms WAN roundtrips to Supabase Auth.
 * Wrapped with React cache() to deduplicate within the same render/action request lifecycle.
 */
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const cookieStore = cookies();
  const rawToken = getAuthTokenFromCookies(cookieStore);

  if (!rawToken) {
    return null;
  }

  const now = Date.now();

  // Check shared in-memory cache for existing verified session
  const cached = tokenCache.get(rawToken);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  // Check token payload expiration locally
  const payload = parseJwtPayload(rawToken);
  if (payload) {
    const tokenExpMs = payload.exp * 1000;
    if (tokenExpMs <= now) {
      tokenCache.delete(rawToken);
      return null;
    }
  }

  // Verify via Supabase Auth
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      tokenCache.delete(rawToken);
      return null;
    }

    let ttlMs = MAX_CACHE_TTL_MS;
    if (payload?.exp) {
      const remainingMs = payload.exp * 1000 - now;
      ttlMs = Math.min(MAX_CACHE_TTL_MS, remainingMs);
    }

    tokenCache.set(rawToken, {
      user,
      expiresAt: now + ttlMs,
    });

    if (tokenCache.size > 300) {
      for (const [key, entry] of tokenCache.entries()) {
        if (entry.expiresAt <= now) {
          tokenCache.delete(key);
        }
      }
    }

    return user;
  } catch (err) {
    console.error("Error verifying authenticated user in auth-cache:", err);
    return null;
  }
});
