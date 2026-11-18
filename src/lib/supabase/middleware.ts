import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthTokenFromCookies,
  parseJwtPayload,
} from "./session-utils";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-middleware-prefetch") === "1";

  const rawToken = getAuthTokenFromCookies(request.cookies);

  // 1. If no auth cookie exists, user is definitely unauthenticated.
  // Return immediately without making a 680ms remote HTTP network call.
  if (!rawToken) {
    return { response, user: null };
  }

  // 2. Fast-Path: Decode the JWT payload locally.
  const payload = parseJwtPayload(rawToken);

  if (payload) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const secondsRemaining = payload.exp - nowSeconds;

    // A. For prefetch requests: NEVER block on remote WAN network calls.
    // If the token is still valid, consider authenticated.
    if (isPrefetch) {
      if (secondsRemaining > 0) {
        return {
          response,
          user: {
            id: payload.sub,
            email: payload.email,
            user_metadata: payload.user_metadata,
            app_metadata: payload.app_metadata,
          },
        };
      } else {
        return { response, user: null };
      }
    }

    // B. For normal navigations: If the token has more than 120s remaining,
    // session is valid and active. Skip blocking WAN roundtrips to Singapore.
    if (secondsRemaining > 120) {
      return {
        response,
        user: {
          id: payload.sub,
          email: payload.email,
          user_metadata: payload.user_metadata,
          app_metadata: payload.app_metadata,
        },
      };
    }
  }

  // 3. Fallback: If token is near expiration (<120s) or missing payload,
  // invoke Supabase Auth to refresh access token and update response cookies.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { response, user: null };
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { response, user };
  } catch (err) {
    console.error("Error refreshing Supabase session in middleware:", err);
    return { response, user: null };
  }
}
