"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState(emailParam);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsResending(true);
    setResendStatus("idle");
    setStatusMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setResendStatus("error");
        setStatusMessage(error.message);
      } else {
        setResendStatus("success");
        setStatusMessage("A new verification link has been sent to your email address.");
      }
    } catch {
      setResendStatus("error");
      setStatusMessage("An unexpected error occurred while sending the email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-slate-200 bg-white p-6 shadow-subtle space-y-5">
      {errorParam ? (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-3.5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed">
            <p className="font-semibold">Verification link invalid or expired</p>
            <p className="mt-0.5">
              The verification link you clicked may have expired. Please request a new link below.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Mail className="h-5 w-5" />
          </div>
          <div className="text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Verification Link Sent</p>
            <p className="mt-0.5 text-slate-600">
              {email ? (
                <>
                  Sent to <span className="font-medium text-slate-900">{email}</span>. Click the link in your email to activate your account.
                </>
              ) : (
                "Click the link sent to your work email to activate your account."
              )}
            </p>
          </div>
        </div>
      )}

      {/* Resend Verification Form */}
      <div className="border-t border-slate-100 pt-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-800">
          Didn&apos;t receive an email?
        </h3>
        <p className="text-xs text-slate-500 font-normal leading-relaxed">
          Check your spam folder or enter your email to dispatch a fresh verification link.
        </p>

        <form onSubmit={handleResend} className="space-y-3">
          <Input
            label="Work Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            required
          />

          {resendStatus === "success" && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {resendStatus === "error" && (
            <div className="rounded-md border border-red-200 bg-red-50/80 p-2.5 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="outline"
            className="w-full"
            isLoading={isResending}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Resend Verification Link
          </Button>
        </form>
      </div>

      <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign In</span>
        </Link>
        <Link
          href="/auth/signup"
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          Use another email
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Check your email
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            We sent a verification link to confirm your SPARK account.
          </p>
        </div>

        <Suspense fallback={<div className="h-64 rounded-[10px] bg-white border border-slate-200 animate-pulse" />}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
