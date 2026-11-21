"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema, type ProfileUpdateInput } from "@/lib/validations/auth";
import { revalidatePath } from "next/cache";

export async function getCurrentUserProfile() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthenticated", user: null, profile: null };
  }

  // Canonical account ID is strictly user.id (UUID)
  try {
    let profile = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      // Auto-sync fallback
      const fullName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "SPARK User";

      profile = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email || "",
          fullName,
        },
      });
    }

    return {
      error: null,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    };
  } catch (dbErr) {
    console.error("Error fetching user profile from database:", dbErr);
    // Graceful fallback to auth user metadata if database is unavailable
    return {
      error: null,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      profile: {
        id: user.id,
        email: user.email || "",
        fullName: user.user_metadata?.full_name || user.email?.split("@")[0] || "SPARK User",
        avatarUrl: user.user_metadata?.avatar_url || null,
        createdAt: user.created_at,
        updatedAt: user.created_at,
      },
    };
  }
}

export async function updateUserProfile(input: ProfileUpdateInput) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthenticated" };
  }

  const validation = profileUpdateSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || "Invalid input data.",
    };
  }

  const { fullName, avatarUrl } = validation.data;

  try {
    // 1. Update public.users in database (Server-side ownership enforced: where id = user.id)
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email || "",
        fullName,
        avatarUrl: avatarUrl || null,
      },
      update: {
        fullName,
        avatarUrl: avatarUrl || null,
      },
    });

    // 2. Synchronize user_metadata in Supabase Auth (exclude large base64 data URLs to prevent HTTP 431)
    const isExternalUrl = avatarUrl && !avatarUrl.startsWith("data:") && avatarUrl.length < 500;
    await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        ...(isExternalUrl ? { avatar_url: avatarUrl } : {}),
      },
    });

    revalidatePath("/settings");
    revalidatePath("/");

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Profile update failed:", err);
    return { success: false, error: err.message || "Failed to update profile." };
  }
}

export async function changeUserPassword(newPassword: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthenticated" };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

