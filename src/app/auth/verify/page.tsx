"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  verifySignupOtp,
  resendSignupOtp,
  syncVerifiedUser,
} from "@/lib/actions/auth-verify";
import { clearBootstrapMemory } from "@/lib/bootstrap-client";
import { clearAllClientCaches } from "@/lib/client-caches";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState(emailParam);
  // 4-Digit OTP Boxes
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);

  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
      if (typeof window !== "undefined") {
        try {
          const cached = sessionStorage.getItem(`spark_dev_otp_${emailParam.trim().toLowerCase()}`);
          if (cached) {
            setDevOtpHint(cached);
          }
        } catch {}
      }
    }
  }, [emailParam]);

  // Focus the first empty digit box on load
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown countdown timer for Resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    setVerifyError("");
    const cleaned = value.replace(/[^0-9]/g, "");

    // Handle full code paste (e.g. user pastes 4 digits into any box)
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 4).split("");
      const nextDigits = [...digits];
      for (let i = 0; i < 4; i++) {
        nextDigits[i] = pasteDigits[i] || "";
      }
      setDigits(nextDigits);
      const targetIndex = Math.min(pasteDigits.length, 3);
      inputRefs.current[targetIndex]?.focus();

      if (pasteDigits.length === 4) {
        verifyCode(nextDigits.join(""));
      }
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleaned;
    setDigits(nextDigits);

    // Auto-advance to next box if filled
    if (cleaned && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 4 digits are filled
    const fullCode = nextDigits.join("");
    if (fullCode.length === 4) {
      verifyCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim().replace(/[^0-9]/g, "");
    if (!pasted) return;

    const pasteDigits = pasted.slice(0, 4).split("");
    const nextDigits = [...digits];
    for (let i = 0; i < 4; i++) {
      nextDigits[i] = pasteDigits[i] || "";
    }
    setDigits(nextDigits);
    const targetIndex = Math.min(pasteDigits.length, 3);
    inputRefs.current[targetIndex]?.focus();

    if (pasteDigits.length === 4) {
      verifyCode(nextDigits.join(""));
    }
  };

  const verifyCode = async (tokenCode: string) => {
    const code = tokenCode.trim();
    if (code.length < 4 || !email.trim()) return;

    setIsVerifying(true);
    setVerifyError("");

    try {
      const res = await verifySignupOtp({
        email: email.trim(),
        otp: code,
      });

      if (!res.success) {
        setVerifyError(
          res.error ||
            "The 4-digit verification code is invalid or has expired. Please check your email or click Resend."
        );
        setIsVerifying(false);
        return;
      }

      // Automatically authenticate session in Supabase client
      const supabase = createClient();
      if (res.password) {
        await supabase.auth.signInWithPassword({
          email: res.email || email.trim(),
          password: res.password,
        });
      }

      setVerifySuccess(true);
      clearAllClientCaches();
      clearBootstrapMemory();

      // Synchronize database profile
      await syncVerifiedUser(email.trim()).catch(() => {});

      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(`spark_dev_otp_${email.trim().toLowerCase()}`);
        } catch {}
      }

      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1000);
    } catch {
      setVerifyError("An unexpected error occurred during verification. Please try again.");
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCode(digits.join(""));
  };

  const handleResend = async () => {
    if (!email || isResending || resendCooldown > 0) return;

    setIsResending(true);
    setResendStatus("idle");
    setStatusMessage("");

    try {
      const res = await resendSignupOtp(email.trim());

      if (!res.success) {
        setResendStatus("error");
        setStatusMessage(res.error || "Failed to resend verification code.");
      } else {
        setResendStatus("success");
        setStatusMessage("A fresh 4-digit verification code has been dispatched to your email.");
        setResendCooldown(45);
        setDigits(["", "", "", ""]);
        inputRefs.current[0]?.focus();

        if (res.devOtp) {
          setDevOtpHint(res.devOtp);
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(`spark_dev_otp_${email.trim().toLowerCase()}`, res.devOtp);
            } catch {}
          }
        }
      }
    } catch {
      setResendStatus("error");
      setStatusMessage("Failed to send verification code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const autofillDevOtp = () => {
    if (devOtpHint && devOtpHint.length === 4) {
      const split = devOtpHint.split("");
      setDigits(split);
      verifyCode(devOtpHint);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <div className="rounded-[16px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 sm:p-7 shadow-elevated space-y-6">
      {/* Top Banner */}
      {errorParam ? (
        <div className="rounded-[10px] border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            <p className="font-semibold">Verification link expired or invalid</p>
            <p className="mt-0.5">
              The code may have expired. Please enter the latest 4-digit code sent to your email or request a new one below.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3.5 rounded-[10px] border border-[var(--spark-accent)]/25 bg-[var(--spark-highlight)]/55 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--spark-highlight)] text-[var(--spark-accent)] mt-0.5">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="text-xs text-[var(--spark-text-secondary)]">
            <p className="font-semibold text-[var(--spark-text-primary)]">
              4-Digit Verification Code Sent
            </p>
            <p className="mt-0.5 leading-relaxed">
              We sent a 4-digit verification code to{" "}
              <span className="font-semibold text-[var(--spark-text-primary)]">
                {email || "your registered email"}
              </span>
              . Enter the code below to activate your account.
            </p>
          </div>
        </div>
      )}

      {/* Dev OTP Helper if in local dev */}
      {devOtpHint && !verifySuccess && (
        <div className="flex items-center justify-between rounded-[8px] border border-violet-500/30 bg-violet-500/10 px-3.5 py-2 text-xs text-violet-700 dark:text-violet-300">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            Verification Code: <strong className="font-mono text-sm tracking-widest">{devOtpHint}</strong>
          </span>
          <button
            type="button"
            onClick={autofillDevOtp}
            className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 underline hover:opacity-80"
          >
            Auto-fill
          </button>
        </div>
      )}

      {verifySuccess ? (
        <div className="rounded-[12px] border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2 animate-in fade-in zoom-in-95">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-1">
            <Check className="h-6 w-6 stroke-[3]" />
          </div>
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Account Verified Successfully!
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Launching your workspace now...
          </p>
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-5">
          {/* 4-Digit Code Input Grid */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-[var(--spark-text-primary)] text-center">
              Enter 4-Digit Verification Code
            </label>
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  disabled={isVerifying}
                  className="h-14 w-12 sm:h-15 sm:w-14 rounded-[12px] border-2 border-[var(--spark-border)] bg-[var(--spark-canvas)] text-center text-2xl font-mono font-bold text-[var(--spark-text-primary)] shadow-2xs focus:border-[var(--spark-accent)] focus:ring-2 focus:ring-[var(--spark-accent)]/20 outline-none transition-all duration-150 disabled:opacity-60"
                  autoComplete="one-time-code"
                />
              ))}
            </div>
          </div>

          {verifyError && (
            <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{verifyError}</span>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full h-10 text-xs font-semibold"
            isLoading={isVerifying}
            disabled={!isComplete || isVerifying}
            leftIcon={<ShieldCheck className="h-4 w-4" />}
          >
            Verify &amp; Activate Account
          </Button>
        </form>
      )}

      {/* Resend Section */}
      <div className="border-t border-[var(--spark-border)] pt-4 space-y-3 text-center">
        <p className="text-xs text-[var(--spark-text-secondary)]">
          Didn&apos;t receive the code? Check your spam folder or request a new one.
        </p>

        {resendStatus === "success" && (
          <div className="rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {resendStatus === "error" && (
          <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={isResending || resendCooldown > 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${isResending ? "animate-spin" : ""}`} />
          {resendCooldown > 0
            ? `Resend Code in ${resendCooldown}s`
            : "Resend 4-Digit Code"}
        </button>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-[var(--spark-border)] pt-4 flex items-center justify-between text-xs">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 font-medium text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Sign In</span>
        </Link>
        <Link
          href="/auth/signup"
          className="font-medium text-[var(--spark-accent)] hover:text-[var(--spark-accent-hover)]"
        >
          Register with different email
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[var(--spark-canvas)] px-4 py-12 transition-colors duration-150">
      <div className="fixed top-4 right-4">
        <ThemeToggle variant="icon" />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--spark-text-primary)]">
            Verify your email
          </h1>
          <p className="text-xs text-[var(--spark-text-secondary)] font-normal">
            One-time 4-digit verification code is required only upon registration.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="h-64 rounded-[12px] bg-[var(--spark-surface)] border border-[var(--spark-border)] animate-pulse" />
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
