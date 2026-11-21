"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";
import { autoConfirmUserEmail } from "@/lib/actions/auth-verify";
import { getSafeRedirectUrl } from "@/lib/utils";
import {
  prefetchWorkspaceBootstrap,
  clearBootstrapMemory,
} from "@/lib/bootstrap-client";
import { clearAllClientCaches } from "@/lib/client-caches";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const messageParam = searchParams.get("message");
  const rawReturnTo = searchParams.get("returnTo");

  const returnTo = getSafeRedirectUrl(rawReturnTo, "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");
    setUnconfirmedEmail(null);

    const validationResult = loginSchema.safeParse({
      email,
      password,
      rememberMe,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
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
      let { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error && error.message.toLowerCase().includes("email not confirmed")) {
        // Auto-confirm the email and retry sign-in immediately
        await autoConfirmUserEmail(email.trim());
        const retry = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setGeneralError(
            "Invalid email or password. Please verify your credentials and try again."
          );
        } else {
          setGeneralError(error.message);
        }
        return;
      }

      if (data.session) {
        clearAllClientCaches();
        clearBootstrapMemory();
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("spark_active_workspace_id");
            localStorage.removeItem("spark_cached_workspaces");
            localStorage.removeItem("spark_cached_user");
          } catch {}
        }

        router.prefetch(returnTo);
        router.prefetch("/chat");

        await Promise.race([
          prefetchWorkspaceBootstrap(undefined, { force: true }),
          new Promise((resolve) => setTimeout(resolve, 1400)),
        ]);

        router.push(returnTo);
      }
    } catch {
      setGeneralError("An unexpected error occurred while signing in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 shadow-subtle transition-colors duration-150">
      {messageParam && (
        <div className="mb-4 rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
          <span>{messageParam}</span>
        </div>
      )}

      {generalError && (
        <div className="mb-4 rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
          {unconfirmedEmail && (
            <div className="pt-1">
              <Link
                href={`/auth/verify?email=${encodeURIComponent(unconfirmedEmail)}`}
                className="inline-flex items-center gap-1 font-semibold text-violet-600 dark:text-violet-400 hover:underline"
              >
                Enter 4-digit verification code &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Work Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          error={errors.email}
          required
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            error={errors.password}
            required
          />
        </div>

        <div className="flex items-center justify-between text-xs pt-1">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={setRememberMe}
            label="Remember me"
          />
          <Link
            href="/auth/forgot-password"
            className="font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </div>
      </form>

      <div className="mt-5 border-t border-[var(--spark-border)] pt-4 text-center">
        <p className="text-xs text-[var(--spark-text-secondary)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
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
            Sign in to SPARK
          </h1>
          <p className="text-xs text-[var(--spark-text-secondary)] font-normal">
            Enter your credentials to access your workspace.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-64 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] animate-pulse" />
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-[11px] text-[var(--spark-text-muted)]">
          Protected by enterprise-grade security and SOC2 compliance.
        </p>
      </div>
    </div>
  );
}
