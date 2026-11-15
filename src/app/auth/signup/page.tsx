"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/auth";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError("");

    // Validate inputs using Zod
    const validationResult = signupSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
      agreeTerms,
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
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes("rate limit")) {
          setGeneralError(
            "Email rate limit exceeded. Supabase default email service is capped at 3–4 emails/hour. You can disable 'Confirm email' in your Supabase Dashboard (Authentication → Providers → Email) for instant registration."
          );
        } else {
          setGeneralError(error.message);
        }
        return;
      }

      // Check if user is already registered or requires email verification
      if (data.user) {
        // If session exists immediately (email confirmation disabled in Supabase project)
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          // Normal case: Email confirmation required
          router.push(`/auth/verify?email=${encodeURIComponent(email.trim())}`);
        }
      }
    } catch {
      setGeneralError("An unexpected error occurred during signup. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Create your SPARK workspace
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            Start collaborating with your team in minutes.
          </p>
        </div>

        <div className="rounded-[10px] border border-slate-200 bg-white p-6 shadow-subtle">
          {generalError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Full Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              error={errors.fullName}
              required
            />

            <Input
              label="Work Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              error={errors.email}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              error={errors.password}
              hint="Must be at least 8 characters with letters & numbers."
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your password"
              error={errors.confirmPassword}
              required
            />

            <div className="pt-1">
              <Checkbox
                checked={agreeTerms}
                onCheckedChange={setAgreeTerms}
                label={
                  <span className="text-xs text-slate-600">
                    I agree to the{" "}
                    <a href="#" className="text-blue-600 hover:underline">
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a href="#" className="text-blue-600 hover:underline">
                      Privacy Policy
                    </a>
                  </span>
                }
                hint={errors.agreeTerms}
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
