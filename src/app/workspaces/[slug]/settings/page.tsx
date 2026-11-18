"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  Trash2,
  UserCheck,
} from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getWorkspaceBySlug,
  updateWorkspace,
  updateWorkspaceSettings,
  deleteWorkspace,
  transferWorkspaceOwnership,
} from "@/lib/actions/workspaces";
import { getWorkspaceMembers } from "@/lib/actions/workspace-members";
import { WorkspaceMemberItem } from "@/lib/types";

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const { refreshWorkspaces } = useWorkspace();

  const [workspace, setWorkspace] = useState<any>(null);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUpdatingGeneral, setIsUpdatingGeneral] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [defaultRole, setDefaultRole] = useState("MEMBER");
  const [allowInvitations, setAllowInvitations] = useState(true);
  const [allowGuests, setAllowGuests] = useState(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      setIsLoading(true);
      const res = await getWorkspaceBySlug(slug);
      if (res.success && res.workspace) {
        setWorkspace(res.workspace);
        setCallerRole(res.callerRole);
        setName(res.workspace.name);
        setDescription(res.workspace.description || "");
        setAvatarUrl(res.workspace.avatarUrl || "");

        if (res.settings) {
          setDefaultRole(res.settings.defaultMemberRole);
          setAllowInvitations(res.settings.allowMemberInvitations);
          setAllowGuests(res.settings.allowGuestAccess);
        }

        const memRes = await getWorkspaceMembers(res.workspace.id);
        if (memRes.members) {
          setMembers(memRes.members);
        }
      }
      setIsLoading(false);
    }
    loadData();
  }, [slug]);

  if (isLoading) {
    return (
      <ShellLayout>
        <div className="max-w-4xl mx-auto py-12 px-6 text-center text-[var(--spark-text-secondary)] text-xs">
          Loading settings...
        </div>
      </ShellLayout>
    );
  }

  if (!workspace) {
    return (
      <ShellLayout>
        <div className="max-w-md mx-auto py-16 px-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-semibold text-[var(--spark-text-primary)]">
            Workspace Not Found
          </h2>
          <Link href="/workspaces">
            <Button variant="outline" size="sm">
              Return to Workspaces
            </Button>
          </Link>
        </div>
      </ShellLayout>
    );
  }

  const isOwner = callerRole === "OWNER";
  const isPersonal = workspace.type === "PERSONAL" || workspace.type === "personal";

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingGeneral(true);
    setGeneralMessage(null);

    const res = await updateWorkspace(workspace.id, {
      name,
      description,
      avatarUrl: avatarUrl || undefined,
    });

    if (res.success) {
      setGeneralMessage({ type: "success", text: "Workspace updated successfully." });
      await refreshWorkspaces();
    } else {
      setGeneralMessage({ type: "error", text: res.error || "Update failed." });
    }
    setIsUpdatingGeneral(false);
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPolicy(true);
    setPolicyMessage(null);

    const res = await updateWorkspaceSettings(workspace.id, {
      defaultMemberRole: defaultRole as any,
      allowMemberInvitations: allowInvitations,
      allowGuestAccess: allowGuests,
    });

    if (res.success) {
      setPolicyMessage({ type: "success", text: "Security settings saved." });
    } else {
      setPolicyMessage({ type: "error", text: res.error || "Update failed." });
    }
    setIsUpdatingPolicy(false);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransferring(true);
    setTransferError("");

    if (!newOwnerId) {
      setTransferError("Please select a team member.");
      setIsTransferring(false);
      return;
    }

    if (transferConfirm !== "TRANSFER") {
      setTransferError("Please type 'TRANSFER' to confirm.");
      setIsTransferring(false);
      return;
    }

    const res = await transferWorkspaceOwnership(workspace.id, {
      newOwnerId,
      confirmation: "TRANSFER",
    });

    if (res.success) {
      await refreshWorkspaces();
      router.refresh();
      window.location.reload();
    } else {
      setTransferError(res.error || "Failed to transfer ownership.");
    }
    setIsTransferring(false);
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeleting(true);
    setDeleteError("");

    if (deleteConfirm !== workspace.name) {
      setDeleteError(`Please type '${workspace.name}' exactly to confirm deletion.`);
      setIsDeleting(false);
      return;
    }

    const res = await deleteWorkspace(workspace.id);
    if (res.success) {
      await refreshWorkspaces();
      router.push("/workspaces");
    } else {
      setDeleteError(res.error || "Failed to delete workspace.");
    }
    setIsDeleting(false);
  };

  return (
    <ShellLayout>
      <div className="max-w-3xl mx-auto py-4 space-y-6">
        <div>
          <Link
            href={`/workspaces/${workspace.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--spark-text-secondary)] hover:text-[var(--spark-accent)] transition-colors duration-150 mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {workspace.name}</span>
          </Link>
          <div className="flex items-center justify-between border-b border-[var(--spark-border)] pb-5">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--spark-text-primary)]">
                Workspace Settings
              </h1>
              <p className="text-sm text-[var(--spark-text-secondary)] mt-1">
                Configure workspace profile, membership policies, and administrative options.
              </p>
            </div>
            <Badge variant="violet" size="md">
              {callerRole} Access
            </Badge>
          </div>
        </div>

        {/* General Settings */}
        <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 space-y-5">
          <h2 className="text-sm font-semibold text-[var(--spark-text-primary)] border-b border-[var(--spark-border)] pb-3">
            General Information
          </h2>

          <form onSubmit={handleSaveGeneral} className="space-y-4">
            {generalMessage && (
              <div
                className={`rounded-[8px] border p-3 text-xs flex items-center gap-2 ${
                  generalMessage.type === "success"
                    ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                }`}
              >
                {generalMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <span>{generalMessage.text}</span>
              </div>
            )}

            <Input
              label="Workspace Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div>
              <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-3 py-2 text-xs text-[var(--spark-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)] transition-colors duration-150"
              />
            </div>

            <Input
              label="Avatar URL"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />

            <div className="pt-2 flex justify-end">
              <Button
                variant="primary"
                type="submit"
                isLoading={isUpdatingGeneral}
                leftIcon={<Save className="h-3.5 w-3.5" />}
              >
                Save Details
              </Button>
            </div>
          </form>
        </div>

        {/* Security & Membership Policies */}
        {!isPersonal && (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 space-y-5">
            <h2 className="text-sm font-semibold text-[var(--spark-text-primary)] border-b border-[var(--spark-border)] pb-3">
              Membership &amp; Invitation Policies
            </h2>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              {policyMessage && (
                <div
                  className={`rounded-[8px] border p-3 text-xs flex items-center gap-2 ${
                    policyMessage.type === "success"
                      ? "border-[#10B981]/30 bg-[#10B981]/10 text-emerald-700 dark:text-emerald-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                  <span>{policyMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
                  Default Role for New Members
                </label>
                <select
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-3 py-1.5 text-xs text-[var(--spark-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark-accent)]"
                >
                  <option value="MEMBER">Member (Standard collaborative access)</option>
                  <option value="MANAGER">Manager (Can invite &amp; manage team resources)</option>
                  <option value="GUEST">Guest (Restricted shared access)</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <Checkbox
                  label="Allow team managers to invite new members"
                  checked={allowInvitations}
                  onCheckedChange={(checked) => setAllowInvitations(checked)}
                />
                <Checkbox
                  label="Allow guest accounts in workspace"
                  checked={allowGuests}
                  onCheckedChange={(checked) => setAllowGuests(checked)}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  type="submit"
                  isLoading={isUpdatingPolicy}
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                >
                  Save Policies
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Transfer Ownership (Owner only) */}
        {!isPersonal && isOwner && (
          <div className="rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-surface)] p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--spark-border)] pb-3">
              <UserCheck className="h-4 w-4 text-[var(--spark-accent)]" />
              <h2 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                Transfer Workspace Ownership
              </h2>
            </div>
            <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed">
              Transfer primary ownership of this organization to another active member. You will be demoted to an Admin.
            </p>

            <form onSubmit={handleTransfer} className="space-y-4 pt-2">
              {transferError && (
                <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
                  Select New Owner
                </label>
                <select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-3 py-2 text-xs text-[var(--spark-text-primary)]"
                >
                  <option value="">-- Choose active member --</option>
                  {members
                    .filter((m) => m.role !== "OWNER" && m.status === "ACTIVE")
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.fullName} ({m.user.email}) - {m.role}
                      </option>
                    ))}
                </select>
              </div>

              <Input
                label="Type 'TRANSFER' to confirm"
                type="text"
                value={transferConfirm}
                onChange={(e) => setTransferConfirm(e.target.value)}
                placeholder="TRANSFER"
              />

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  type="submit"
                  isLoading={isTransferring}
                  disabled={transferConfirm !== "TRANSFER" || !newOwnerId}
                >
                  Transfer Ownership
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Danger Zone: Delete Workspace */}
        {!isPersonal && isOwner && (
          <div className="rounded-[10px] border border-rose-500/35 bg-rose-500/6 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-rose-500/25 pb-3">
              <ShieldAlert className="h-4 w-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Danger Zone: Delete Workspace
              </h2>
            </div>

            <p className="text-xs text-[var(--spark-text-secondary)] leading-relaxed">
              Once deleted, all projects, tasks, chat messages, invitations, and membership data belonging to{" "}
              <span className="font-semibold text-[var(--spark-text-primary)]">
                {workspace.name}
              </span>{" "}
              will be permanently erased.
            </p>

            <form onSubmit={handleDelete} className="space-y-4 pt-2">
              {deleteError && (
                <div className="rounded-[8px] border border-rose-500/30 bg-[var(--spark-surface)] p-3 text-xs text-rose-600 dark:text-rose-400">
                  {deleteError}
                </div>
              )}

              <Input
                label={`Type '${workspace.name}' to confirm deletion`}
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={workspace.name}
              />

              <div className="flex justify-end pt-1">
                <Button
                  variant="destructive"
                  type="submit"
                  isLoading={isDeleting}
                  disabled={deleteConfirm !== workspace.name}
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Permanently Delete Workspace
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ShellLayout>
  );
}
