"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";
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

  // Prevent open redirect vulnerabilities: Ensure returnTo is a safe relative internal route
  const returnTo = getSafeRedirectUrl(rawReturnTo, "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    // Validate with Zod
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setGeneralError(
            "Your email has not been verified yet. Please check your inbox or request a new verification link."
          );
        } else if (error.message.toLowerCase().includes("invalid login credentials")) {
          setGeneralError("Invalid email or password. Please verify your credentials and try again.");
        } else {
          setGeneralError(error.message);
        }
        return;
      }

      if (data.session) {
        // Clear any leftover state from a previous account on this browser
        clearAllClientCaches();
        clearBootstrapMemory();
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("spark_active_workspace_id");
            localStorage.removeItem("spark_cached_workspaces");
            localStorage.removeItem("spark_cached_user");
          } catch {}
        }

        // Prefetch target route + chat bundle and preload ALL workspace/chat/team data in one round-trip
        router.prefetch(returnTo);
        router.prefetch("/chat");

        // Wait up to 1.4s for bootstrap so dashboard & chat open instantaneously without delaying login
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
    <div className="rounded-[10px] border border-slate-200 bg-white p-6 shadow-subtle">
      {messageParam && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{messageParam}</span>
        </div>
      )}

      {generalError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <span>{generalError}</span>
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
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
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

      <div className="mt-5 border-t border-slate-100 pt-4 text-center">
        <p className="text-xs text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/signup"
            className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
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
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand & Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Sign in to SPARK
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            Enter your credentials to access your workspace.
          </p>
        </div>

        <Suspense fallback={<div className="h-64 rounded-[10px] bg-white border border-slate-200 animate-pulse" />}>
          <LoginForm />
        </Suspense>

        {/* System & Security Notice */}
        <p className="text-center text-[11px] text-slate-400">
          Protected by enterprise-grade security and SOC2 compliance.
        </p>
      </div>
    </div>
  );
}
