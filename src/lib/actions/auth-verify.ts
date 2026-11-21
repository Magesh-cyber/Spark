"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Ensures a verified Supabase user has a corresponding row in prisma.user
 * immediately after OTP or link verification.
 */
export async function syncVerifiedUser(email: string) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthenticated" };
    }

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "SPARK User";

    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email || email,
        fullName,
      },
      update: {
        email: user.email || email,
        fullName,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("syncVerifiedUser error:", err);
    return { success: false, error: err?.message };
  }
}
