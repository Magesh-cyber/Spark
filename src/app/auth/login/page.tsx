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

      {/* LEFT SIDE: Brand Header, "Welcome back!" Greeting & Sign-in Card */}
      <div className="w-full lg:w-[480px] xl:w-[520px] 2xl:w-[560px] flex flex-col justify-between px-6 sm:px-10 lg:px-12 xl:px-16 py-8 lg:py-12 z-20 shrink-0">
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

      {/* RIGHT STAGE: Panoramic Curving Highway & Vintage Car Mascot */}
      <div className="hidden lg:flex flex-1 relative h-screen overflow-hidden select-none items-end justify-end">
        {/* Curvilinear Organic Terrain & Perspective Highway */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <svg
            className="h-full w-full object-cover"
            viewBox="0 0 1000 900"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="-4" dy="12" stdDeviation="16" floodColor="#000000" floodOpacity="0.2" />
              </filter>
              <linearGradient id="roadGradBlack" x1="0.8" y1="0.2" x2="0.2" y2="0.9">
                <stop offset="0%" stopColor="#26202B" />
                <stop offset="50%" stopColor="#1C1721" />
                <stop offset="100%" stopColor="#120F16" />
              </linearGradient>
            </defs>

            {/* Soft Warm Sand underlay accent curve */}
            <path
              d="M440 0C600 180 320 380 480 580C620 730 380 850 520 900H1000V0H440Z"
              fill="var(--spark-surface-selected)"
              className="opacity-75 dark:opacity-25"
            />

            {/* Primary Deep Muted Plum Organic Shape */}
            <path
              d="M520 0C680 160 400 360 560 560C700 710 460 830 600 900H1000V0H520Z"
              fill="var(--spark-accent)"
              className="opacity-95 dark:opacity-85"
            />

            {/* SERPENTINE S-HIGHWAY: Deep Black Asphalt with crisp lane markings */}
            {/* Road Bed / Shadow Base */}
            <path
              d="M 935 180 
                 C 780 250, 650 330, 680 400 
                 C 710 470, 810 520, 830 580 
                 C 850 660, 480 780, 140 900 
                 L 600 900 
                 C 820 780, 970 660, 960 580 
                 C 940 500, 840 450, 810 400 
                 C 780 340, 880 250, 985 180 Z"
              fill="#0D0A10"
              filter="url(#roadShadow)"
              className="opacity-90 dark:opacity-60"
            />

            {/* Road Surface (Black Asphalt) */}
            <path
              d="M 940 180 
                 C 785 252, 658 332, 688 400 
                 C 718 468, 818 518, 838 580 
                 C 858 658, 490 782, 160 900 
                 L 580 900 
                 C 800 778, 950 658, 940 580 
                 C 920 502, 822 452, 792 400 
                 C 762 342, 862 252, 975 180 Z"
              fill="url(#roadGradBlack)"
              className="dark:fill-[#0E0B11]"
            />

            {/* Solid Road Curbs (Inner & Outer) */}
            <path
              d="M 940 180 C 785 252, 658 332, 688 400 C 718 468, 818 518, 838 580 C 858 658, 490 782, 160 900"
              stroke="#3D3344"
              strokeWidth="2.5"
              className="opacity-90 dark:opacity-60"
            />
            <path
              d="M 975 180 C 862 252, 762 342, 792 400 C 822 452, 920 502, 940 580 C 950 658, 800 778, 580 900"
              stroke="#3D3344"
              strokeWidth="2.5"
              className="opacity-90 dark:opacity-60"
            />

            {/* Dashed Center Dividing Lane Markings along S-Curve */}
            <path
              d="M 958 180 
                 C 824 252, 710 337, 740 400 
                 C 770 460, 869 510, 889 580 
                 C 904 658, 645 780, 370 900"
              stroke="#FFFFFF"
              strokeWidth="4.5"
              strokeDasharray="24 16"
              strokeLinecap="round"
              className="opacity-95 dark:stroke-[#F4EFE8]/80"
            />
          </svg>
        </div>

        {/* Tire Contact Shadow for physical grounding */}
        <div className="absolute bottom-[35px] right-[40px] xl:right-[80px] 2xl:right-[120px] w-[580px] xl:w-[680px] 2xl:w-[760px] h-[50px] bg-[radial-gradient(ellipse_at_50%_50%,rgba(74,53,79,0.3)_0%,rgba(74,53,79,0)_72%)] dark:bg-[radial-gradient(ellipse_at_50%_50%,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0)_72%)] z-10 pointer-events-none" />

        {/* Mascot Illustration: Transparent retro car riding above highway */}
        <div className="relative z-10 w-full max-w-[620px] lg:max-w-[680px] xl:max-w-[760px] 2xl:max-w-[840px] mr-[10px] xl:mr-[40px] 2xl:mr-[80px] mb-[25px] pointer-events-none">
          <img
            src="/images/welcome_car_transparent.png"
            alt="SPARK Welcome Mascot — Driving vintage car along highway"
            className="w-full h-auto object-contain drop-shadow-[0_15px_30px_rgba(74,53,79,0.22)] dark:drop-shadow-[0_16px_36px_rgba(107,78,113,0.38)] transition-all duration-200"
          />
        </div>
      </div>
    </div>
  );
}