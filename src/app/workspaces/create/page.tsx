"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createOrganizationWorkspace } from "@/lib/actions/workspaces";
import { useWorkspace } from "@/lib/workspace-context";

export default function CreateWorkspacePage() {
  const router = useRouter();
  const { refreshWorkspaces, setActiveWorkspace } = useWorkspace();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-slugify name if not manually modified
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManual) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleSlugChange = (val: string) => {
    setIsSlugManual(true);
    setSlug(val.toLowerCase().trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter an organization name.");
      return;
    }
    if (!slug.trim()) {
      setError("Please provide a URL slug for your workspace.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await createOrganizationWorkspace({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      if (!res.success || !res.workspace) {
        setError(res.error || "Failed to create workspace.");
        return;
      }

      // Refresh workspaces in context and switch to newly created workspace
      await refreshWorkspaces();
      setActiveWorkspace(res.workspace as any);

      router.push(`/workspaces/${res.workspace.slug}`);
    } catch {
      setError("An unexpected error occurred while creating your workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ShellLayout>
      <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
        <div>
          <Link
            href="/workspaces"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Workspaces</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create an Organization
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set up a shared workspace for your company, department, or project team.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-subtle">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50/70 p-3.5 text-xs text-red-700 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <Input
              label="Organization Name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Acme Technologies"
              required
            />

            <div>
              <Input
                label="Workspace URL Slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-technologies"
                hint="Your team will access this workspace at /workspaces/{slug}"
                required
              />
              {slug && (
                <p className="mt-1 text-xs text-slate-400 font-mono">
                  URL: /workspaces/{slug}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe the purpose of this workspace..."
                rows={3}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <Input
              label="Avatar URL (Optional)"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <Link href="/workspaces">
                <Button variant="ghost" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                variant="primary"
                type="submit"
                isLoading={isLoading}
                leftIcon={<Building2 className="h-4 w-4" />}
              >
                Create Workspace
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ShellLayout>
  );
}

