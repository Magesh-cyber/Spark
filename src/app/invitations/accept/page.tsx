"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getInvitationDetails,
  acceptWorkspaceInvitation,
} from "@/lib/actions/workspace-invitations";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const { currentUser, refreshWorkspaces } = useWorkspace();

  const [invitationData, setInvitationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) {
        setError("Missing invitation token.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const res = await getInvitationDetails(token);
      if (!res.success || !res.invitation) {
        setError(res.error || "Invalid or expired invitation.");
      } else {
        setInvitationData(res.invitation);
      }
      setIsLoading(false);
    }
    load();
  }, [token]);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);

    const res = await acceptWorkspaceInvitation(token);
    if (res.success && res.workspaceSlug) {
      setSuccess(true);
      await refreshWorkspaces();
      setTimeout(() => {
        router.push(`/workspaces/${res.workspaceSlug}`);
      }, 1200);
    } else {
      setError(res.error || "Failed to accept invitation.");
      setIsAccepting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-[var(--spark-text-secondary)] text-xs">
        Verifying invitation credentials...
      </div>
    );
  }

  if (error && !invitationData) {
    return (
      <div className="rounded-[12px] border border-rose-500/30 bg-[var(--spark-surface)] p-6 shadow-subtle text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
          Invalid Invitation
        </h2>
        <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed max-w-sm mx-auto">
          {error}
        </p>
        <Link href="/auth/login">
          <Button variant="outline" size="sm">
            Return to Sign In
          </Button>
        </Link>
      </div>
    );
  }

  const isEmailMatching =
    currentUser.email &&
    currentUser.email.toLowerCase() === invitationData?.email.toLowerCase();

  const isUserAuthenticated = Boolean(currentUser.email);

  return (
    <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 shadow-subtle space-y-6">
      {success ? (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="h-12 w-12 text-[#10B981] mx-auto animate-in zoom-in-75 duration-300" />
          <h2 className="text-lg font-bold text-[var(--spark-text-primary)]">
            Welcome to {invitationData.workspace.name}!
          </h2>
          <p className="text-xs text-[var(--spark-text-secondary)]">
            Invitation accepted. Redirecting you to the workspace...
          </p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--spark-highlight)] text-[var(--spark-accent)] mx-auto border border-[var(--spark-accent)]/25">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-[var(--spark-text-primary)]">
              Join {invitationData.workspace.name}
            </h2>
            <p className="text-xs text-[var(--spark-text-secondary)]">
              {invitationData.inviter?.fullName || "A team member"} has invited you to collaborate
              as{" "}
              <span className="font-semibold text-[var(--spark-text-primary)]">
                {invitationData.role}
              </span>
              .
            </p>
          </div>

          <div className="rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] p-3.5 text-xs text-[var(--spark-text-secondary)] space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[var(--spark-text-muted)]">Invited Email:</span>
              <span className="font-medium text-[var(--spark-text-primary)]">
                {invitationData.email}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--spark-text-muted)]">Assigned Role:</span>
              <span className="font-medium text-[var(--spark-text-primary)]">
                {invitationData.role}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--spark-text-muted)]">Expires:</span>
              <span className="font-medium text-[var(--spark-text-primary)]">
                {new Date(invitationData.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isUserAuthenticated ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-[8px] border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Please sign in with{" "}
                <span className="font-semibold">{invitationData.email}</span> to accept this
                invitation.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/auth/login?returnTo=${encodeURIComponent(
                    `/invitations/accept?token=${token}`
                  )}`}
                  className="w-full"
                >
                  <Button variant="outline" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link
                  href={`/auth/signup?email=${encodeURIComponent(invitationData.email)}`}
                  className="w-full"
                >
                  <Button variant="primary" className="w-full">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
          ) : !isEmailMatching ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                <p className="font-semibold">Email Mismatch</p>
                <p className="leading-relaxed">
                  You are currently signed in as{" "}
                  <span className="font-semibold">{currentUser.email}</span>, but this invitation
                  was sent to <span className="font-semibold">{invitationData.email}</span>.
                </p>
              </div>
              <p className="text-[11px] text-[var(--spark-text-secondary)] text-center">
                Please sign out and sign in with the invited email address.
              </p>
            </div>
          ) : (
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={handleAccept}
                isLoading={isAccepting}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Accept Invitation &amp; Join
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AcceptInvitationPage() {
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
            Workspace Invitation
          </h1>
        </div>

        <Suspense
          fallback={
            <div className="rounded-[12px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 text-center text-xs text-[var(--spark-text-muted)]">
              Loading invitation...
            </div>
          }
        >
          <AcceptInvitationContent />
        </Suspense>
      </div>
    </div>
  );
}
