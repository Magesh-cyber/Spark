"use client";

import React, { useState, useEffect } from "react";
import { ShellLayout } from "@/components/layout/ShellLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/lib/workspace-context";
import { useTheme } from "@/lib/theme-context";
import { updateUserProfile, changeUserPassword } from "@/lib/actions/profile";
import { AlertCircle, CheckCircle2, Lock, Save, Moon, Sun } from "lucide-react";

export default function SettingsPage() {
  const { currentUser, setCurrentUser, activeWorkspace } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(currentUser.name);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || "");
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);

  // Profile save state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    setName(currentUser.name);
    setAvatarUrl(currentUser.avatarUrl || "");
  }, [currentUser]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(false);
    setProfileError("");

    try {
      const res = await updateUserProfile({
        fullName: name,
        avatarUrl: avatarUrl.trim() || undefined,
      });

      if (!res.success) {
        setProfileError(res.error || "Failed to update profile.");
      } else {
        setProfileSuccess(true);
        setCurrentUser({
          ...currentUser,
          name: name.trim(),
          avatarUrl: avatarUrl.trim() || undefined,
        });
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch {
      setProfileError("An unexpected error occurred while saving profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsSavingPassword(true);

    try {
      const res = await changeUserPassword(newPassword);
      if (!res.success) {
        setPasswordError(res.error || "Failed to update password.");
      } else {
        setPasswordSuccess(true);
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch {
      setPasswordError("An unexpected error occurred while changing password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <ShellLayout>
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Account & Workspace Settings"
          description="Manage your verified profile, security credentials, appearance, and active workspace configuration."
        />

        {/* Appearance / Theme Preference Card */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance &amp; Theme</CardTitle>
            <CardDescription>
              Switch between SPARK Light Mode and Dark Mode. Your preference is persisted automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center gap-3 rounded-[10px] border p-3.5 text-left transition-all duration-150 ${
                  theme === "light"
                    ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] ring-1 ring-[var(--spark-accent)]"
                    : "border-[var(--spark-border)] bg-[var(--spark-canvas)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#FFFFFF] border border-[#E6E2F0] text-[#6D28D9]">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--spark-text-primary)]">
                    Light Mode
                  </p>
                  <p className="text-[11px] text-[var(--spark-text-secondary)]">
                    Cool Violet-Tint White &amp; Royal Violet
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-3 rounded-[10px] border p-3.5 text-left transition-all duration-150 ${
                  theme === "dark"
                    ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] ring-1 ring-[var(--spark-accent)]"
                    : "border-[var(--spark-border)] bg-[var(--spark-canvas)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#161321] border border-[#282338] text-[#8B5CF6]">
                  <Moon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[var(--spark-text-primary)]">
                    Dark Mode
                  </p>
                  <p className="text-[11px] text-[var(--spark-text-secondary)]">
                    Deep Obsidian-Plum &amp; Luminous Violet
                  </p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details Form */}
        <form onSubmit={handleProfileSave}>
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>
                Your canonical SPARK user identity across all joined workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileError && (
                <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Avatar name={name} src={avatarUrl} size="xl" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--spark-text-primary)]">
                    Profile Avatar
                  </p>
                  <p className="text-[11px] text-[var(--spark-text-secondary)]">
                    Generated from your initials or custom image URL.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                />
                <Input
                  label="Email Address (Verified)"
                  type="email"
                  value={currentUser.email || "Loading..."}
                  disabled
                  hint="Managed through Supabase Auth."
                />
              </div>

              <Input
                label="Avatar Image URL (Optional)"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                hint="Direct link to a public image (HTTPS)."
              />

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSavingProfile}
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                >
                  Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Security & Password Form */}
        <form onSubmit={handlePasswordChange}>
          <Card>
            <CardHeader>
              <CardTitle>Security &amp; Password</CardTitle>
              <CardDescription>
                Update your account password. We recommend using a unique password of at least 8 characters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {passwordError && (
                <div className="rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-[8px] border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0" />
                  <span>Password changed successfully!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  hint="At least 8 characters."
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  isLoading={isSavingPassword}
                  disabled={!newPassword || !confirmPassword}
                  leftIcon={<Lock className="h-3.5 w-3.5" />}
                >
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Configure how and when you receive workspace updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Switch
              checked={emailNotifs}
              onCheckedChange={setEmailNotifs}
              label="Email notifications for task assignments and mentions"
              description="Receive an email digest when you are directly tagged or assigned work."
            />
            <Switch
              checked={pushNotifs}
              onCheckedChange={setPushNotifs}
              label="Desktop notifications"
              description="Show browser alerts for upcoming meetings and direct messages."
            />
          </CardContent>
        </Card>

        {/* Active Workspace Info */}
        <Card>
          <CardHeader>
            <CardTitle>Current Workspace</CardTitle>
            <CardDescription>Settings for {activeWorkspace.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-[var(--spark-border)]">
              <span className="text-[var(--spark-text-secondary)] font-medium">
                Workspace Name
              </span>
              <span className="font-semibold text-[var(--spark-text-primary)]">
                {activeWorkspace.name}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--spark-border)]">
              <span className="text-[var(--spark-text-secondary)] font-medium">
                Workspace Type
              </span>
              <span className="capitalize font-semibold text-[var(--spark-text-primary)]">
                {activeWorkspace.type}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[var(--spark-text-secondary)] font-medium">Your Role</span>
              <span className="capitalize font-semibold text-[var(--spark-accent)]">
                {activeWorkspace.role}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </ShellLayout>
  );
}
