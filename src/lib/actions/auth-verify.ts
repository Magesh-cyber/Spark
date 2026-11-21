"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { validateEmailLegitimacy } from "@/lib/email-checker";
import { sendSignupOtpEmail } from "@/lib/email";

export interface RequestSignupOtpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface VerifySignupOtpInput {
  email: string;
  otp: string;
}

/**
 * Validates email legitimacy, verifies domain MX routing, generates a 4-digit OTP,
 * and sends it to the recipient's email upon signup attempt.
 */
export async function requestSignupOtp(
  input: RequestSignupOtpInput
): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    const { fullName, email, password } = input;

    // 1. Check Legit & Valid Email via RFC syntax & DNS MX records
    const validation = await validateEmailLegitimacy(email);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || "Please enter a valid email address.",
      };
    }

    const cleanEmail = validation.normalizedEmail || email.trim().toLowerCase();

    // 2. Check if user already exists in public.users or auth.users
    const existingPrismaUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });

    if (existingPrismaUser) {
      return {
        success: false,
        error: "An account with this email address already exists. Please sign in.",
      };
    }

    // 3. Generate a 4-digit numeric OTP code (e.g. 1000 - 9999)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 4. Ensure table exists & store pending signup record in Postgres
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.email_verification_otps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        otp VARCHAR(10) NOT NULL,
        attempts INTEGER DEFAULT 0,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_email_verification_otps_email ON public.email_verification_otps(email);
    `);

    // Delete existing pending OTPs for this email to avoid duplicates
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.email_verification_otps WHERE email = $1`,
      cleanEmail
    );

    // Insert fresh 4-digit OTP record
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.email_verification_otps (email, full_name, password_hash, otp, attempts, expires_at)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      cleanEmail,
      fullName.trim(),
      password,
      otp,
      expiresAt
    );

    // 5. Dispatch 4-digit OTP via email service (SMTP / Nodemailer / console fallback)
    const emailResult = await sendSignupOtpEmail({
      email: cleanEmail,
      fullName: fullName.trim(),
      otp,
    });

    return {
      success: true,
      devOtp: emailResult.devOtp,
    };
  } catch (err: any) {
    console.error("requestSignupOtp error:", err);
    return {
      success: false,
      error: "An error occurred while sending verification code. Please try again.",
    };
  }
}

/**
 * Resends a fresh 4-digit verification code to the registered email.
 */
export async function resendSignupOtp(
  email: string
): Promise<{ success: boolean; error?: string; devOtp?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const validation = await validateEmailLegitimacy(cleanEmail);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error || "Please enter a valid email address.",
      };
    }

    const records = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.email_verification_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      cleanEmail
    );

    if (!records || records.length === 0) {
      return {
        success: false,
        error: "No pending registration found for this email. Please register again.",
      };
    }

    const record = records[0];
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.$executeRawUnsafe(
      `UPDATE public.email_verification_otps
       SET otp = $1, attempts = 0, expires_at = $2, created_at = now()
       WHERE id = $3`,
      newOtp,
      newExpiresAt,
      record.id
    );

    const emailResult = await sendSignupOtpEmail({
      email: cleanEmail,
      fullName: record.full_name,
      otp: newOtp,
    });

    return {
      success: true,
      devOtp: emailResult.devOtp,
    };
  } catch (err: any) {
    console.error("resendSignupOtp error:", err);
    return {
      success: false,
      error: "Failed to resend verification code. Please try again.",
    };
  }
}

/**
 * Verifies the 4-digit OTP entered by the user, creates/confirms the account in Supabase
 * and provisions the user record in prisma.user.
 */
export async function verifySignupOtp(
  input: VerifySignupOtpInput
): Promise<{ success: boolean; error?: string; email?: string; password?: string }> {
  try {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanOtp = input.otp.trim();

    if (!cleanEmail || !cleanOtp || cleanOtp.length !== 4) {
      return {
        success: false,
        error: "Please enter the complete 4-digit verification code.",
      };
    }

    // Query pending OTP record from database
    const records = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.email_verification_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      cleanEmail
    );

    if (!records || records.length === 0) {
      return {
        success: false,
        error: "No pending verification found. Please request a new code or sign up again.",
      };
    }

    const record = records[0];

    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      return {
        success: false,
        error: "This verification code has expired. Please request a new 4-digit code.",
      };
    }

    // Check attempts limit
    if (record.attempts >= 5) {
      return {
        success: false,
        error: "Too many incorrect attempts. Please request a new 4-digit code.",
      };
    }

    // Check code match
    if (record.otp !== cleanOtp) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.email_verification_otps SET attempts = attempts + 1 WHERE id = $1`,
        record.id
      );
      return {
        success: false,
        error: "Invalid 4-digit verification code. Please check your email and try again.",
      };
    }

    // OTP is valid! Provision user in Supabase Auth & Prisma DB
    const supabase = createClient();

    // 1. Sign up user via Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: record.password_hash,
      options: {
        data: {
          full_name: record.full_name,
        },
      },
    });

    let userId = signUpData?.user?.id;

    // If user already existed in auth.users or had partial signup
    if (!userId) {
      const existingAuth = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM auth.users WHERE email = $1 LIMIT 1`,
        cleanEmail
      );
      if (existingAuth.length > 0) {
        userId = existingAuth[0].id;
      }
    }

    if (!userId && signUpError) {
      console.error("Supabase auth signUp error during verify:", signUpError);
      return {
        success: false,
        error: signUpError.message || "Could not finalize account creation.",
      };
    }

    // 2. Mark email as confirmed in auth.users so login works instantly
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
        JSON.stringify(record.full_name),
        userId
      );

      // 3. Provision or update profile in public.users (Prisma)
      await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: cleanEmail,
          fullName: record.full_name,
        },
        update: {
          email: cleanEmail,
          fullName: record.full_name,
        },
      });
    }

    // 4. Delete the used OTP record
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.email_verification_otps WHERE email = $1`,
      cleanEmail
    );

    return {
      success: true,
      email: cleanEmail,
      password: record.password_hash,
    };
  } catch (err: any) {
    console.error("verifySignupOtp error:", err);
    return {
      success: false,
      error: "An unexpected error occurred during verification. Please try again.",
    };
  }
}

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
