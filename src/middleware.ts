import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Refresh Supabase session
  const { response, user } = await updateSession(request);

  // 2. Define route classifications
  const isAuthPage =
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/signup") ||
    pathname.startsWith("/auth/forgot-password") ||
    pathname.startsWith("/auth/reset-password") ||
    pathname.startsWith("/auth/verify");

  const isAuthCallback = pathname.startsWith("/auth/callback");

  // Protected routes require an active Supabase user session
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/workspaces") ||
    pathname.startsWith("/tasks") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/chat") ||
    pathname.startsWith("/meet") ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/teams") ||
    pathname.startsWith("/calendar") ||
    pathname.startsWith("/insights");

  // 3. Unauthenticated access to protected routes -> redirect to login with safe returnTo
  if (isProtectedRoute && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("returnTo", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated users attempting to access login or signup -> redirect to home
  if (isAuthPage && !isAuthCallback && user) {
    // Only redirect away from login/signup if session is valid
    if (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/signup")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

