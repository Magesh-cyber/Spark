"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
    // Direct registration does not require OTP verification
    router.replace("/auth/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--spark-canvas)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--spark-accent)] border-t-transparent" />
    </div>
  );
}
