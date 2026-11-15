"use client";

import React, { useState, useRef } from "react";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { useNexconnChat } from "./NexconnChatProvider";

export function MessageComposer() {
  const { activeConversation, sendMessage, sendMedia, isReady } = useNexconnChat();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!activeConversation) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isSending) return;

    try {
      setIsSending(true);
      const toSend = text;
      setText("");
      const success = await sendMessage(toSend);
      if (!success) {
        // Restore text if failed
        setText(toSend);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSending(true);
      await sendMedia(file);
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const placeholder =
    activeConversation.type === "channel"
      ? `Message #${activeConversation.name}...`
      : `Message ${activeConversation.name}...`;

  return (
    <div className="p-3 border-t border-slate-200 bg-white">
      <form onSubmit={handleSend} className="space-y-2">
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:bg-white transition-all">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.zip,.txt"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !isReady}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors mr-1.5"
            title="Attach file or image"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={!isReady || isSending}
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!text.trim() || isSending || !isReady}
            className="p-1.5 rounded-md text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors ml-1.5"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

