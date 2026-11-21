"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { validateEmailLegitimacy } from "@/lib/email-checker";

export interface RegisterUserSimpleInput {
  fullName: string;
  email: string;
  password: string;
}

/**
 * Simple, direct registration:
 * 1. Checks that email is valid syntax and not disposable/fake.
 * 2. Checks if email already exists in the database.
 * 3. Creates the user in Supabase Auth.
 * 4. Instantly confirms the email (no OTP required).
 * 5. Provisions the profile in prisma.user so the user can immediately enter SPARK.
 */
export async function registerUserSimple(
  input: RegisterUserSimpleInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();

    // 1. Verify email format & validity
    const validation = await validateEmailLegitimacy(cleanEmail);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || "Please enter a valid email address.",
      };
    }

    // 2. Check if email already exists in database
    const existingPrismaUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    if (existingPrismaUser) {
      return {
        success: false,
        error: "An account with this email address already exists. Please sign in instead.",
      };
    }

    // 3. Register user via Supabase Auth
    const supabase = createClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: input.password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    let userId = signUpData?.user?.id;

    if (!userId) {
      const existingAuth = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
        cleanEmail
      );
      if (existingAuth && existingAuth.length > 0) {
        userId = existingAuth[0].id;
      }
    }

    if (!userId && signUpError) {
      return {
        success: false,
        error: signUpError.message || "Could not complete account registration.",
      };
    }

    // 4. Instantly confirm email in auth.users (bypassing any OTP / confirmation barrier)
    if (userId) {
      await prisma.$executeRawUnsafe(
        `UPDATE auth.users
         SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
             raw_user_meta_data = jsonb_set(
               COALESCE(raw_user_meta_data, '{}'::jsonb),
               '{full_name}',
               $1::jsonb
             )
         WHERE id = $2::uuid`,
        JSON.stringify(fullName),
        userId
      );

      // 5. Provision record in public.users (Prisma)
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: cleanEmail,
          fullName,
        },
        update: {
          email: cleanEmail,
          fullName,
        },
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error("registerUserSimple error:", err);
    return {
      success: false,
      error: "An unexpected error occurred during registration. Please try again.",
    };
  }
}

/**
 * Ensures a verified Supabase user has a corresponding row in prisma.user
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


/**
 * Automatically confirms an unverified user email in auth.users so they can log in seamlessly.
 */
export async function autoConfirmUserEmail(email: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    await prisma.$executeRawUnsafe(
      `UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = $1`,
      cleanEmail
    );
    return { success: true };
  } catch (err: any) {
    console.error("autoConfirmUserEmail error:", err);
    return { success: false };
  }
}


/**
 * Stub exports preserved for backwards-compatibility
 */
export async function verifySignupOtp(input: { email: string; otp: string }) {
  await autoConfirmUserEmail(input.email);
  return { success: true };
}

export async function resendSignupOtp(email: string) {
  return { success: true };
}

export async function requestSignupOtp(input: any) {
  return registerUserSimple(input);
}
