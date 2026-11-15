"use client";

import React, { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FileText, Download, Image as ImageIcon, MessageSquare } from "lucide-react";
import { useNexconnChat } from "./NexconnChatProvider";

export function MessageStream() {
  const { messages, isLoadingMessages, activeConversation } = useNexconnChat();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!activeConversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <MessageSquare className="h-10 w-10 text-slate-300 mb-2 stroke-1" />
        <p className="text-sm font-medium text-slate-600">No conversation selected</p>
        <p className="text-xs text-slate-400">Choose a channel or direct message from the sidebar.</p>
      </div>
    );
  }

  if (isLoadingMessages) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
          <span>Loading message history...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          {activeConversation.type === "channel"
            ? `Welcome to #${activeConversation.name}!`
            : `Direct conversation with ${activeConversation.name}`}
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          {activeConversation.type === "channel"
            ? activeConversation.description || "This is the start of the channel. Send a message to get the conversation started."
            : "This is the beginning of your direct message history. Messages are private and securely routed through Nexconn."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg) => (
        <div key={msg.id} className="flex items-start gap-3 group transition-colors hover:bg-slate-50/50 -mx-2 px-2 py-1 rounded-md">
          <Avatar name={msg.senderName} size="md" />

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-slate-900">
                {msg.senderName}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {msg.time}
              </span>
            </div>

            {msg.text && (
              <p className="mt-0.5 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-w-3xl">
                {msg.text}
              </p>
            )}

            {/* Attachment Card */}
            {msg.fileInfo && (
              <div className="mt-2">
                {msg.fileInfo.type === "image" ? (
                  <div className="max-w-sm rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={msg.fileInfo.url}
                      alt={msg.fileInfo.name}
                      className="max-h-60 w-auto object-cover"
                    />
                  </div>
                ) : (
                  <a
                    href={msg.fileInfo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 hover:bg-slate-50 text-xs transition-colors shadow-2xs group/file"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="truncate max-w-xs">
                      <div className="font-medium text-slate-800 truncate group-hover/file:text-blue-600">
                        {msg.fileInfo.name}
                      </div>
                      {msg.fileInfo.size && (
                        <div className="text-[10px] text-slate-400">
                          {(msg.fileInfo.size / 1024).toFixed(1)} KB
                        </div>
                      )}
                    </div>
                    <Download className="h-3.5 w-3.5 text-slate-400 ml-2" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
