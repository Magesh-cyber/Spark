"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Settings,
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

  // General settings state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isUpdatingGeneral, setIsUpdatingGeneral] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Policy settings state
  const [defaultRole, setDefaultRole] = useState("MEMBER");
  const [allowInvitations, setAllowInvitations] = useState(true);
  const [allowGuests, setAllowGuests] = useState(false);
  const [isUpdatingPolicy, setIsUpdatingPolicy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Ownership transfer state
  const [newOwnerId, setNewOwnerId] = useState("");
  const [transferConfirm, setTransferConfirm] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  // Deletion state
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

        // Fetch members for ownership transfer dropdown
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
        <div className="max-w-4xl mx-auto py-12 px-6 text-center text-slate-500 text-xs">
          Loading settings...
        </div>
      </ShellLayout>
    );
  }

  if (!workspace) {
    return (
      <ShellLayout>
        <div className="max-w-md mx-auto py-16 px-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-base font-semibold text-slate-900">
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

  // General details submit
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

  // Policy settings submit
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

  // Ownership transfer submit
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

  // Workspace deletion submit
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
      <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
        <div>
          <Link
            href={`/workspaces/${workspace.slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to {workspace.name}</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Workspace Settings
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Configure workspace profile, membership policies, and administrative options.
              </p>
            </div>
            <Badge variant="outline" size="md">
              {callerRole} Access
            </Badge>
          </div>
        </div>

        {/* General Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-subtle space-y-5">
          <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
            General Information
          </h2>

          <form onSubmit={handleSaveGeneral} className="space-y-4">
            {generalMessage && (
              <div
                className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
                  generalMessage.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {generalMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-subtle space-y-5">
            <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Membership & Invitation Policies
            </h2>

            <form onSubmit={handleSavePolicy} className="space-y-4">
              {policyMessage && (
                <div
                  className={`rounded-lg border p-3 text-xs flex items-center gap-2 ${
                    policyMessage.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{policyMessage.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Default Role for New Members
                </label>
                <select
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value="MEMBER">Member (Standard collaborative access)</option>
                  <option value="MANAGER">Manager (Can invite & manage team resources)</option>
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
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-subtle space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Transfer Workspace Ownership
              </h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Transfer primary ownership of this organization to another active member. You will be demoted to an Admin.
            </p>

            <form onSubmit={handleTransfer} className="space-y-4 pt-2">
              {transferError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {transferError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select New Owner
                </label>
                <select
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
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
          <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-subtle space-y-4">
            <div className="flex items-center gap-2 border-b border-red-200/80 pb-3">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <h2 className="text-sm font-semibold text-red-900">
                Danger Zone: Delete Workspace
              </h2>
            </div>

            <p className="text-xs text-red-700 leading-relaxed">
              Once deleted, all projects, tasks, chat messages, invitations, and membership data belonging to <span className="font-semibold text-slate-900">{workspace.name}</span> will be permanently erased.
            </p>

            <form onSubmit={handleDelete} className="space-y-4 pt-2">
              {deleteError && (
                <div className="rounded-lg border border-red-200 bg-white p-3 text-xs text-red-700">
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
