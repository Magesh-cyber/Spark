"use client";

import React, { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Pin, Trash2, Plus, ExternalLink, KeyRound, Copy, Check } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { useNexconnChat } from "./NexconnChatProvider";
import { pinArtifactToChannel, deleteWorkspaceChannel } from "@/lib/actions/chat-channels";

export function ChannelDetailsDrawer() {
  const { activeWorkspace } = useWorkspace();
  const { activeConversation, channelDetails, refreshChannels, setActiveConversation } =
    useNexconnChat();

  const [isAddingPin, setIsAddingPin] = useState(false);
  const [pinTitle, setPinTitle] = useState("");
  const [pinUrl, setPinUrl] = useState("");
  const [isPinning, setIsPinning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedChannelCode, setCopiedChannelCode] = useState(false);

  if (!activeConversation) return null;

  const isChannel = activeConversation.type === "channel";

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !channelDetails?.id || !pinTitle.trim() || !pinUrl.trim()) return;

    try {
      setIsPinning(true);
      const res = await pinArtifactToChannel(activeWorkspace.id, channelDetails.id, {
        title: pinTitle.trim(),
        url: pinUrl.trim(),
      });

      if (res.success) {
        setIsAddingPin(false);
        setPinTitle("");
        setPinUrl("");
        await refreshChannels();
      }
    } finally {
      setIsPinning(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!activeWorkspace?.id || !channelDetails?.id) return;
    if (channelDetails.isDefault) return;

    if (
      !confirm(
        `Are you sure you want to delete #${channelDetails.name}? All channel history will be permanently removed.`
      )
    ) {
      return;
    }

    try {
      setIsDeleting(true);
      const res = await deleteWorkspaceChannel(activeWorkspace.id, channelDetails.id);
      if (res.success) {
        await refreshChannels();
        setActiveConversation(null);
      } else {
        alert(res.error || "Failed to delete channel.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-72 shrink-0 border-l border-[var(--spark-border)] bg-[var(--spark-canvas)] dark:bg-[var(--spark-surface)] p-4 space-y-4 overflow-y-auto select-none transition-colors duration-150">
      {/* About */}
      <div>
        <h4 className="text-xs font-semibold text-[var(--spark-text-primary)]">
          {isChannel ? `About #${activeConversation.name}` : `Direct Message`}
        </h4>
        <p className="mt-1 text-xs text-[var(--spark-text-secondary)] font-normal leading-relaxed">
          {isChannel
            ? activeConversation.description || "No topic set for this channel."
            : `Private direct conversation with ${activeConversation.name}.`}
        </p>
      </div>

      {/* 6-Character Channel Join Code */}
      {isChannel && channelDetails?.joinCode && (
        <div className="border-t border-[var(--spark-border)] pt-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
              Channel Join Code
            </span>
            <button
              onClick={() => {
                if (channelDetails.joinCode) {
                  navigator.clipboard.writeText(channelDetails.joinCode);
                  setCopiedChannelCode(true);
                  setTimeout(() => setCopiedChannelCode(false), 2000);
                }
              }}
              className="text-[10px] font-medium text-[var(--spark-accent)] hover:underline flex items-center gap-1"
            >
              {copiedChannelCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copiedChannelCode ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <div className="flex items-center justify-between bg-[var(--spark-surface)] p-2 rounded-[8px] border border-[var(--spark-border)]">
            <span className="font-mono text-xs font-bold tracking-widest text-[var(--spark-accent)]">
              {channelDetails.joinCode}
            </span>
            <span className="text-[10px] text-[var(--spark-text-muted)]">
              Share to join
            </span>
          </div>
        </div>
      )}

      {/* Members */}
      {isChannel && channelDetails && (
        <div className="border-t border-[var(--spark-border)] pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
              Channel Members ({channelDetails.members.length + 1})
            </span>
          </div>

          <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto">
            {/* Creator */}
            <div className="flex items-center gap-2.5">
              <Avatar
                name={channelDetails.creator.fullName}
                size="sm"
                src={channelDetails.creator.avatarUrl || undefined}
              />
              <div className="truncate">
                <div className="text-xs font-medium text-[var(--spark-text-primary)] truncate">
                  {channelDetails.creator.fullName}
                </div>
                <div className="text-[10px] text-[var(--spark-accent)] font-medium">Creator</div>
              </div>
            </div>

            {/* Other Members */}
            {channelDetails.members.map((member) => (
              <div key={member.id} className="flex items-center gap-2.5">
                <Avatar
                  name={member.fullName}
                  size="sm"
                  src={member.avatarUrl || undefined}
                />
                <div className="truncate">
                  <div className="text-xs font-medium text-[var(--spark-text-primary)] truncate">
                    {member.fullName}
                  </div>
                  <div className="text-[10px] text-[var(--spark-text-muted)] truncate">
                    {member.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Artifacts */}
      {isChannel && channelDetails && (
        <div className="border-t border-[var(--spark-border)] pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--spark-text-muted)]">
              Pinned Artifacts ({channelDetails.pinnedArtifacts.length})
            </span>
            <button
              onClick={() => setIsAddingPin(!isAddingPin)}
              className="text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] p-1 rounded-[6px] hover:bg-[var(--spark-highlight)] transition-colors duration-150"
              title="Pin an artifact"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {isAddingPin && (
            <form
              onSubmit={handleAddPin}
              className="mt-2 space-y-2 p-2.5 rounded-[8px] bg-[var(--spark-surface)] border border-[var(--spark-border)] text-xs"
            >
              <input
                type="text"
                placeholder="Title (e.g. Master Spec)"
                value={pinTitle}
                onChange={(e) => setPinTitle(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2 py-1 text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)]"
                required
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={pinUrl}
                onChange={(e) => setPinUrl(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2 py-1 text-xs text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none focus:border-[var(--spark-accent)]"
                required
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingPin(false)}
                  className="px-2 py-1 text-[11px] text-[var(--spark-text-secondary)] hover:bg-[var(--spark-surface-subtle)] rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPinning}
                  className="px-2.5 py-1 text-[11px] bg-[var(--spark-accent)] text-white rounded-[6px] hover:bg-[var(--spark-accent-hover)] disabled:opacity-50"
                >
                  {isPinning ? "Pinning..." : "Pin"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-2 space-y-1.5 text-xs">
            {channelDetails.pinnedArtifacts.length === 0 ? (
              <span className="text-[11px] text-[var(--spark-text-muted)] font-normal italic">
                No pinned artifacts
              </span>
            ) : (
              channelDetails.pinnedArtifacts.map((artifact) => (
                <a
                  key={artifact.id}
                  href={artifact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[var(--spark-accent)] hover:underline truncate group"
                >
                  <Pin className="h-3.5 w-3.5 text-[var(--spark-text-muted)] shrink-0 group-hover:text-[var(--spark-accent)]" />
                  <span className="truncate">{artifact.title}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-[var(--spark-text-muted)] shrink-0" />
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* Danger Zone: Delete Channel */}
      {isChannel && channelDetails && !channelDetails.isDefault && (
        <div className="border-t border-[var(--spark-border)] pt-3.5">
          <button
            onClick={handleDeleteChannel}
            disabled={isDeleting}
            className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 p-2 rounded-[6px] w-full transition-colors duration-150 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete #{channelDetails.name}</span>
          </button>
        </div>
      )}
    </div>
  );
}
