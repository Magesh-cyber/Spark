"use client";

import React, { useState } from "react";
import { X, Hash, Lock, Users, AlertCircle } from "lucide-react";
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
    // Sanitize to lowercase alphanumeric and hyphens
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-");
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

      // Switch to newly created channel
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-[10px] border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Hash className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Create a Channel</h2>
              <p className="text-xs text-slate-500">Channels organize team conversations by topic.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
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
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("PUBLIC")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                  type === "PUBLIC"
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Hash className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Public</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Anyone in this workspace can view and join.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("PRIVATE")}
                className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                  type === "PRIVATE"
                    ? "border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Lock className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Private</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Only invited members can view this channel.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {type === "PRIVATE" && directPeers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Add Members to Private Channel
              </label>
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
                {directPeers.map((peer) => (
                  <label
                    key={peer.id}
                    className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(peer.id)}
                      onChange={() => toggleMember(peer.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800">{peer.fullName}</span>
                    <span className="text-[10px] text-slate-400">({peer.email})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
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

