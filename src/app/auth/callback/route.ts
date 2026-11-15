import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSafeRedirectUrl } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const rawNext = requestUrl.searchParams.get("next");

  // Prevent open redirect vulnerabilities: Ensure next is a safe relative internal route
  const next = getSafeRedirectUrl(rawNext, "/");

  if (code) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const user = data.user;
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "SPARK User";

      // Duplicate-safe server-side profile synchronization
      try {
        await prisma.user.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email || "",
            fullName: fullName,
          },
          update: {
            email: user.email || "",
            fullName: fullName,
          },
        });
      } catch (dbErr) {
        console.error("Profile sync in callback encountered non-fatal error:", dbErr);
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // If code exchange fails or is missing, redirect to verify error page
  return NextResponse.redirect(
    new URL(`/auth/verify?error=invalid_or_expired_token`, requestUrl.origin)
  );
}

