"use client";

import React from "react";
import Link from "next/link";
import { Plus, Building2, User, Settings, ArrowRight, Users, ShieldCheck } from "lucide-react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/lib/workspace-context";

export default function WorkspacesDirectoryPage() {
  const { workspaces, activeWorkspace, setActiveWorkspace, isLoadingWorkspaces } =
    useWorkspace();

  const personalWorkspaces = workspaces.filter(
    (w) => w.type === "personal" || w.type === "PERSONAL"
  );
  const orgWorkspaces = workspaces.filter(
    (w) => w.type === "organization" || w.type === "ORGANIZATION"
  );

  return (
    <ShellLayout>
      <div className="max-w-5xl mx-auto py-8 px-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Workspaces
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your personal workspace and organizations you collaborate in.
            </p>
          </div>
          <Link href="/workspaces/create">
            <Button variant="primary" leftIcon={<Plus className="h-4 w-4" />}>
              Create Organization
            </Button>
          </Link>
        </div>

        {/* Personal Workspace Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Personal Workspace
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personalWorkspaces.map((ws) => {
              const isActive = activeWorkspace.id === ws.id;
              return (
                <div
                  key={ws.id}
                  className={`rounded-xl border p-5 transition-all bg-white shadow-subtle ${
                    isActive
                      ? "border-blue-500 ring-2 ring-blue-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {ws.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          /workspaces/{ws.slug}
                        </p>
                      </div>
                    </div>
                    {isActive ? (
                      <Badge variant="info" size="sm">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="default" size="sm">
                        Personal
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                    {ws.description || "Your private workspace for personal tasks and notes."}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 capitalize">
                      Role: {ws.role}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveWorkspace(ws)}
                        >
                          Switch
                        </Button>
                      )}
                      <Link href={`/workspaces/${ws.slug}`}>
                        <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3 w-3" />}>
                          Open
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Organizations Section */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Organizations ({orgWorkspaces.length})
              </h2>
            </div>
          </div>

          {orgWorkspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center bg-slate-50/50 space-y-3">
              <Building2 className="h-8 w-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">
                No organizations yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Create an organization workspace to collaborate with your team, assign tasks, and share projects.
              </p>
              <Link href="/workspaces/create" className="inline-block pt-1">
                <Button variant="primary" size="sm">
                  Create First Organization
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgWorkspaces.map((ws) => {
                const isActive = activeWorkspace.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`rounded-xl border p-5 transition-all bg-white shadow-subtle ${
                      isActive
                        ? "border-blue-500 ring-2 ring-blue-500/20"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-semibold text-sm border border-blue-100">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">
                            {ws.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            /workspaces/{ws.slug}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isActive && (
                          <Badge variant="info" size="sm">
                            Active
                          </Badge>
                        )}
                        <Badge variant="outline" size="sm">
                          {ws.role}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                      {ws.description || "Shared team workspace on SPARK."}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        <span>{ws.memberCount ?? 1} members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveWorkspace(ws)}
                          >
                            Switch
                          </Button>
                        )}
                        <Link href={`/workspaces/${ws.slug}/settings`}>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </Link>
                        <Link href={`/workspaces/${ws.slug}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            rightIcon={<ArrowRight className="h-3 w-3" />}
                          >
                            Open
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ShellLayout>
  );
}
