"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, ShieldCheck, Globe } from "lucide-react";
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
    <div className="space-y-4">
      {messageParam && (
        <div className="rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
          <span>{messageParam}</span>
        </div>
      )}

      {generalError && (
        <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{generalError}</span>
          </div>
          {unconfirmedEmail && (
            <div className="pt-1">
              <Link
                href={`/auth/verify?email=${encodeURIComponent(unconfirmedEmail)}`}
                className="inline-flex items-center gap-1 font-semibold text-[var(--spark-accent)] hover:underline"
              >
                Enter 4-digit verification code &rarr;
              </Link>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Enter your email address"
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

        <div className="flex items-center justify-between text-xs pt-0.5">
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

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            className="w-full h-10 text-sm font-semibold rounded-[8px]"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </div>
      </form>

      <div className="pt-3 border-t border-[var(--spark-border)] flex items-center justify-between text-xs">
        <p className="text-[var(--spark-text-secondary)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] hover:underline"
          >
            Contact us.
          </Link>
        </p>

        <div className="inline-flex items-center gap-1 text-[11px] text-[var(--spark-text-muted)] border border-[var(--spark-border)] rounded-[6px] px-2 py-0.5 bg-[var(--spark-surface-subtle)]/50">
          <Globe className="h-3 w-3" />
          <span>US</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row relative overflow-hidden bg-[var(--spark-canvas)] transition-colors duration-150">
      {/* Top Controls: Floating Theme Toggle */}
      <div className="absolute top-5 right-5 z-30">
        <ThemeToggle variant="icon" />
      </div>

      {/* LEFT SIDE: Brand Header, "Welcome back!" Greeting & Sign-in Card (Vanta-inspired) */}
      <div className="flex-1 flex flex-col justify-between px-6 sm:px-12 lg:px-16 xl:px-24 py-8 lg:py-12 z-20">
        {/* Brand Header */}
        <div className="flex items-center">
          <SparkLogo size="md" href="/" variant="wordmark" />
        </div>

        {/* Main Content Area */}
        <div className="my-auto py-8 sm:py-12 max-w-[440px] w-full">
          {/* Editorial Greeting */}
          <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-serif font-medium tracking-tight text-[var(--spark-text-primary)] mb-6 sm:mb-8 select-none">
            Welcome back!
          </h1>

          {/* Elevated Sign-in Card */}
          <div className="rounded-[16px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 sm:p-8 shadow-card transition-colors duration-150">
            <h2 className="text-lg font-bold text-[var(--spark-text-primary)] mb-5">
              Sign into SPARK
            </h2>

            <Suspense
              fallback={
                <div className="h-64 rounded-[10px] bg-[var(--spark-surface-subtle)] animate-pulse" />
              }
            >
              <LoginForm />
            </Suspense>
          </div>
        </div>

        {/* Bottom Security / Copyright Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--spark-text-muted)] pt-6 border-t border-[var(--spark-border)]/50">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--spark-accent)]" />
            <span>Protected by enterprise-grade security & SOC2 compliance.</span>
          </div>
          <div className="flex items-center gap-3">
            <span>© 2026 SPARK Workplace</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Curvilinear Organic Shape Backdrop + Retro Car Mascot ("Hi!") */}
      <div className="hidden lg:flex relative lg:w-[46%] xl:w-[48%] h-screen overflow-hidden select-none items-end justify-end">
        {/* Organic Curved Fluid Shape in SPARK's Deep Muted Plum & Warm Sand Theme */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            className="h-full w-full object-cover"
            viewBox="0 0 700 900"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Soft Warm Sand underlay accent curve */}
            <path
              d="M260 0C380 180 140 380 280 580C390 730 200 850 320 900H700V0H260Z"
              fill="var(--spark-surface-selected)"
              className="opacity-70 dark:opacity-20"
            />
            {/* Primary Deep Muted Plum Organic Shape */}
            <path
              d="M320 0C440 160 200 360 340 560C450 710 260 830 380 900H700V0H320Z"
              fill="var(--spark-accent)"
              className="opacity-90 dark:opacity-85"
            />
          </svg>
        </div>

        {/* Floating Playful "Hi!" Speech Bubble */}
        <div className="absolute bottom-[440px] right-[240px] z-20 rounded-full bg-white dark:bg-[#1A161E] border border-[#E6DFD5] dark:border-[#2E2633] px-3.5 py-1.5 shadow-lg flex items-center gap-1.5 text-xs font-bold text-[#4A354F] dark:text-[#C79FD0] animate-bounce">
          <span>👋</span>
          <span>Hi!</span>
        </div>

        {/* Mascot Illustration: Man leaning out of retro car saying Hi */}
        <div className="relative z-10 w-full max-w-[560px] xl:max-w-[620px] mr-[-20px] mb-[-10px] pointer-events-none">
          <img
            src="/images/welcome_car_man.jpg"
            alt="SPARK Welcome Mascot — Man waving hello from car"
            className="w-full h-auto object-contain mix-blend-multiply dark:mix-blend-normal dark:rounded-[20px] dark:opacity-90 transition-opacity duration-200"
          />
        </div>
      </div>
    </div>
  );
}