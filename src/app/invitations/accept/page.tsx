"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { SparkLogo } from "@/components/brand/SparkLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getInvitationDetails,
  acceptWorkspaceInvitation,
} from "@/lib/actions/workspace-invitations";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const { currentUser, refreshWorkspaces, setActiveWorkspace } = useWorkspace();

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
      <div className="text-center py-12 text-slate-500 text-xs">
        Verifying invitation credentials...
      </div>
    );
  }

  if (error && !invitationData) {
    return (
      <div className="rounded-xl border border-red-200 bg-white p-6 shadow-subtle text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-base font-semibold text-slate-900">
          Invalid Invitation
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-subtle space-y-6">
      {success ? (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto animate-in zoom-in-75 duration-300" />
          <h2 className="text-lg font-bold text-slate-900">
            Welcome to {invitationData.workspace.name}!
          </h2>
          <p className="text-xs text-slate-500">
            Invitation accepted. Redirecting you to the workspace...
          </p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mx-auto border border-blue-100">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              Join {invitationData.workspace.name}
            </h2>
            <p className="text-xs text-slate-500">
              {invitationData.inviter?.fullName || "A team member"} has invited you to collaborate as{" "}
              <span className="font-semibold text-slate-800">{invitationData.role}</span>.
            </p>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Invited Email:</span>
              <span className="font-medium text-slate-900">{invitationData.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Assigned Role:</span>
              <span className="font-medium text-slate-900">{invitationData.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Expires:</span>
              <span className="font-medium text-slate-700">
                {new Date(invitationData.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!isUserAuthenticated ? (
            <div className="space-y-3 pt-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                Please sign in with <span className="font-semibold">{invitationData.email}</span> to accept this invitation.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/auth/login?returnTo=${encodeURIComponent(`/invitations/accept?token=${token}`)}`}
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
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold">Email Mismatch</p>
                <p className="leading-relaxed">
                  You are currently signed in as <span className="font-semibold">{currentUser.email}</span>, but this invitation was sent to <span className="font-semibold">{invitationData.email}</span>.
                </p>
              </div>
              <p className="text-[11px] text-slate-500 text-center">
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
                Accept Invitation & Join
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
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex justify-center">
            <SparkLogo size="lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Workspace Invitation
          </h1>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-400">
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

