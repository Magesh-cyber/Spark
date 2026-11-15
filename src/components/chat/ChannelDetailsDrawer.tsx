"use client";

import React, { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FileText, Pin, Trash2, Plus, ExternalLink, AlertTriangle } from "lucide-react";
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

    if (!confirm(`Are you sure you want to delete #${channelDetails.name}? All channel history will be permanently removed.`)) {
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
    <div className="w-64 shrink-0 border-l border-slate-200 bg-slate-50/40 p-4 space-y-4 overflow-y-auto select-none">
      {/* About */}
      <div>
        <h4 className="text-xs font-semibold text-slate-900">
          {isChannel ? `About #${activeConversation.name}` : `Direct Message`}
        </h4>
        <p className="mt-1 text-xs text-slate-500 font-normal leading-relaxed">
          {isChannel
            ? activeConversation.description || "No topic set for this channel."
            : `Private direct conversation with ${activeConversation.name}.`}
        </p>
      </div>

      {/* Members */}
      {isChannel && channelDetails && (
        <div className="border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Channel Members ({channelDetails.members.length + 1})
            </span>
          </div>

          <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
            {/* Creator */}
            <div className="flex items-center gap-2">
              <Avatar
                name={channelDetails.creator.fullName}
                size="sm"
                src={channelDetails.creator.avatarUrl || undefined}
              />
              <div className="truncate">
                <div className="text-xs font-medium text-slate-800 truncate">
                  {channelDetails.creator.fullName}
                </div>
                <div className="text-[10px] text-slate-400">Creator</div>
              </div>
            </div>

            {/* Other Members */}
            {channelDetails.members.map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <Avatar
                  name={member.fullName}
                  size="sm"
                  src={member.avatarUrl || undefined}
                />
                <div className="truncate">
                  <div className="text-xs font-medium text-slate-800 truncate">
                    {member.fullName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{member.email}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Artifacts */}
      {isChannel && channelDetails && (
        <div className="border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Pinned Artifacts ({channelDetails.pinnedArtifacts.length})
            </span>
            <button
              onClick={() => setIsAddingPin(!isAddingPin)}
              className="text-slate-400 hover:text-blue-600 p-0.5"
              title="Pin an artifact"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {isAddingPin && (
            <form onSubmit={handleAddPin} className="mt-2 space-y-2 p-2 rounded-lg bg-white border border-slate-200 text-xs">
              <input
                type="text"
                placeholder="Title (e.g. Master Spec)"
                value={pinTitle}
                onChange={(e) => setPinTitle(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-blue-600"
                required
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={pinUrl}
                onChange={(e) => setPinUrl(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:outline-blue-600"
                required
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setIsAddingPin(false)}
                  className="px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPinning}
                  className="px-2 py-0.5 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPinning ? "Pinning..." : "Pin"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-2 space-y-1.5 text-xs">
            {channelDetails.pinnedArtifacts.length === 0 ? (
              <span className="text-[11px] text-slate-400 font-normal italic">
                No pinned artifacts
              </span>
            ) : (
              channelDetails.pinnedArtifacts.map((artifact) => (
                <a
                  key={artifact.id}
                  href={artifact.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:underline truncate group"
                >
                  <Pin className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-blue-600" />
                  <span className="truncate">{artifact.title}</span>
                  <ExternalLink className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                </a>
              ))
            )}
          </div>
        </div>
      )}

      {/* Danger Zone: Delete Channel */}
      {isChannel && channelDetails && !channelDetails.isDefault && (
        <div className="border-t border-slate-200 pt-3">
          <button
            onClick={handleDeleteChannel}
            disabled={isDeleting}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-md w-full transition-colors font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete #{channelDetails.name}</span>
          </button>
        </div>
      )}
    </div>
  );
}

