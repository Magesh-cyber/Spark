"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema } from "@/lib/validations/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const hasHash =
        typeof window !== "undefined" && window.location.hash.includes("access_token");
      if (session || hasHash) {
        setHasValidSession(true);
      }
      setSessionChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setHasValidSession(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    const validation = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const fieldName = issue.path[0] as string;
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setGeneralError(error.message);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push(
          "/auth/login?message=Password updated successfully. Please sign in with your new credentials."
        );
      }, 1500);
    } catch {
      setGeneralError(
        "An unexpected error occurred while updating your password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--spark-canvas)] px-4 py-12 transition-colors duration-150">
      <div className="fixed top-4 right-4">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--spark-text-primary)]">
            Create new password
          </h1>
          <p className="text-xs text-[var(--spark-text-secondary)] font-normal">
            Choose a strong password for your SPARK account.
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 shadow-subtle">
          {sessionChecked && !hasValidSession ? (
            <div className="space-y-4">
              <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Recovery link invalid or expired</p>
                  <p className="text-[var(--spark-text-secondary)] leading-relaxed">
                    This password reset link is invalid, has already been used, or has expired. Please request a new recovery link.
                  </p>
                </div>
              </div>
              <div className="pt-2 space-y-2">
                <Link href="/auth/forgot-password">
                  <Button variant="primary" className="w-full">
                    Request New Reset Link
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Return to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-4 text-center space-y-2">
              <CheckCircle2 className="h-6 w-6 text-[#10B981] mx-auto" />
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Password Updated!
              </p>
              <p className="text-[11px] text-[var(--spark-text-secondary)]">
                Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {generalError && (
                <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{generalError}</span>
                </div>
              )}

              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                error={errors.password}
                hint="Must be at least 8 characters with letters & numbers."
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                error={errors.confirmPassword}
                required
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  isLoading={isLoading}
                  leftIcon={<Lock className="h-3.5 w-3.5" />}
                >
                  Set New Password
                </Button>
              </div>

              <div className="border-t border-[var(--spark-border)] pt-3 text-center">
                <Link
                  href="/auth/login"
                  className="text-xs font-medium text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)]"
                >
                  Cancel and return to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
