"use client";

import React, { useState } from "react";
import { X, Hash, Lock, AlertCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/workspace-context";
import { createWorkspaceChannel } from "@/lib/actions/chat-channels";
import { useNexconnChat } from "./NexconnChatProvider";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChannelModal({ isOpen, onClose }: CreateChannelModalProps) {
  const { activeWorkspace } = useWorkspace();
  const { refreshChannels, directPeers, setActiveConversation } = useNexconnChat();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/--+/g, "-");
    setName(val);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id) return;
    if (!name.trim()) {
      setError("Please enter a channel name.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const res = await createWorkspaceChannel(activeWorkspace.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        memberIds: type === "PRIVATE" ? selectedMemberIds : undefined,
      });

      if (!res.success || !res.channel) {
        setError(res.error || "Failed to create channel.");
        return;
      }

      await refreshChannels();

      setActiveConversation({
        type: "channel",
        id: res.channel.id,
        name: res.channel.name,
        nexconnTargetId: res.channel.nexconnChannelId,
        description: res.channel.description,
        isPrivate: res.channel.type === "PRIVATE",
      });

      onClose();
      setName("");
      setDescription("");
      setType("PUBLIC");
      setSelectedMemberIds([]);
    } catch (err: any) {
      setError(err.message || "Failed to create channel.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0B14]/55 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-[14px] border spark-glass p-6 text-[var(--spark-text-primary)] shadow-modal animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--spark-border)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)]">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--spark-text-primary)]">
                Create a Channel
              </h2>
              <p className="text-xs text-[var(--spark-text-secondary)]">
                Channels organize team conversations by topic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-[6px] p-1.5 text-[var(--spark-text-muted)] hover:bg-[var(--spark-surface-subtle)] hover:text-[var(--spark-text-primary)] transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-[8px] border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Input
            label="Channel Name"
            placeholder="e.g. design-system, engineering"
            value={name}
            onChange={handleNameChange}
            hint="Lowercase letters, numbers, and hyphens only."
            required
          />

          <div>
            <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] px-3 py-2 text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:border-[var(--spark-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--spark-accent)] transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1.5">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setType("PUBLIC")}
                className={`flex items-start gap-2.5 rounded-[8px] border p-2.5 text-left transition-all duration-150 ${
                  type === "PUBLIC"
                    ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] ring-1 ring-[var(--spark-accent)]"
                    : "border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
              >
                <Hash className="h-4 w-4 mt-0.5 text-[var(--spark-accent)] shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Public</div>
                  <div className="text-[11px] text-[var(--spark-text-secondary)] font-normal">
                    Anyone in this workspace can view and join.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("PRIVATE")}
                className={`flex items-start gap-2.5 rounded-[8px] border p-2.5 text-left transition-all duration-150 ${
                  type === "PRIVATE"
                    ? "border-[var(--spark-accent)] bg-[var(--spark-highlight)] text-[var(--spark-highlight-text)] ring-1 ring-[var(--spark-accent)]"
                    : "border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)]"
                }`}
              >
                <Lock className="h-4 w-4 mt-0.5 text-[#F59E0B] shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Private</div>
                  <div className="text-[11px] text-[var(--spark-text-secondary)] font-normal">
                    Only invited members can view this channel.
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-[8px] bg-[var(--spark-surface-subtle)] p-2.5 border border-[var(--spark-border)] flex items-center gap-2 text-xs text-[var(--spark-text-muted)]">
            <KeyRound className="h-4 w-4 text-[var(--spark-accent)] shrink-0" />
            <span>A unique 6-character alphanumeric join code will be generated to share with team members.</span>
          </div>

          {type === "PRIVATE" && directPeers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[var(--spark-text-secondary)] mb-1">
                Add Members to Private Channel
              </label>
              <div className="max-h-36 overflow-y-auto rounded-[8px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] p-2 space-y-1">
                {directPeers.map((peer) => (
                  <label
                    key={peer.id}
                    className="flex items-center gap-2 rounded-[6px] px-2 py-1 hover:bg-[var(--spark-surface-subtle)] text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(peer.id)}
                      onChange={() => toggleMember(peer.id)}
                      className="rounded border-[var(--spark-border-strong)] accent-[var(--spark-accent)]"
                    />
                    <span className="font-medium text-[var(--spark-text-primary)]">
                      {peer.fullName}
                    </span>
                    <span className="text-[10px] text-[var(--spark-text-muted)]">
                      ({peer.email})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--spark-border)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Channel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
