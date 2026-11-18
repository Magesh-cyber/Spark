"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Loader2,
  Smile,
  X,
  FileText,
  Film,
  Music,
  Lock,
  AlertCircle,
} from "lucide-react";
import { useNexconnChat } from "./NexconnChatProvider";
import { getMediaKindFromMime } from "@/lib/chat-media-envelope";

const QUICK_EMOJIS = ["👍", "❤️", "😊", "🎉", "🔥", "🚀", "👏", "✅"];
const MAX_CLIENT_BYTES = 15 * 1024 * 1024; // 15 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MessageComposer() {
  const {
    activeConversation,
    sendMessage,
    sendMedia,
    isReady,
    sendTyping,
  } = useNexconnChat();

  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (stagedPreviewUrl) {
        URL.revokeObjectURL(stagedPreviewUrl);
      }
    };
  }, [stagedPreviewUrl]);

  // Clear staged file when switching conversations
  useEffect(() => {
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setUploadError(null);
  }, [activeConversation?.id]);

  if (!activeConversation) return null;

  const clearStagedFile = () => {
    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setUploadError(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const stageSelectedFile = (file: File) => {
    setUploadError(null);
    if (file.size > MAX_CLIENT_BYTES) {
      setUploadError("File exceeds the 15 MB limit. Please choose a smaller file.");
      return;
    }
    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setStagedFile(file);
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      setStagedPreviewUrl(URL.createObjectURL(file));
    } else {
      setStagedPreviewUrl(null);
    }
    inputRef.current?.focus();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      stageSelectedFile(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const pastedFile = items[i].getAsFile();
        if (pastedFile) {
          e.preventDefault();
          stageSelectedFile(pastedFile);
          break;
        }
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending) return;
    if (!stagedFile && !text.trim()) return;

    setUploadError(null);

    try {
      setIsSending(true);
      setShowEmojiPicker(false);

      if (stagedFile) {
        const fileToSend = stagedFile;
        const captionToSend = text.trim();
        setText("");
        clearStagedFile();

        const result = await sendMedia(fileToSend, captionToSend);
        if (!result.success) {
          setUploadError(result.error || "Failed to send media. Please try again.");
        }
      } else {
        const toSend = text;
        setText("");
        const success = await sendMessage(toSend);
        if (!success) {
          setText(toSend);
          setUploadError("Failed to send message. Please check your connection.");
        }
      }
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (uploadError) setUploadError(null);
    sendTyping();
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const stagedKind = stagedFile ? getMediaKindFromMime(stagedFile.type) : null;

  const placeholder = stagedFile
    ? "Add an optional caption..."
    : activeConversation.type === "channel"
    ? `Message #${activeConversation.name}...`
    : `Message ${activeConversation.name}...`;

  const canSubmit = (Boolean(stagedFile) || Boolean(text.trim())) && !isSending && isReady;

  return (
    <div className="p-3 border-t border-slate-200 bg-white relative space-y-2">
      {/* Quick Emojis Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex items-center gap-1 z-30 animate-in fade-in zoom-in-95">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="p-1.5 hover:bg-slate-100 rounded text-base transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="p-0.5 text-rose-500 hover:text-rose-700"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Staged Media Preview Bar */}
      {stagedFile && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/40 p-2 animate-in fade-in slide-in-from-bottom-1">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {stagedKind === "image" && stagedPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stagedPreviewUrl}
                alt={stagedFile.name}
                className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                {stagedKind === "video" ? (
                  <Film className="h-5 w-5" />
                ) : stagedKind === "audio" ? (
                  <Music className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {stagedFile.name}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                <span>{formatBytes(stagedFile.size)}</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-medium">
                  <Lock className="h-2.5 w-2.5" />
                  AES-256 Encrypted
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearStagedFile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors shrink-0"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-2 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 focus-within:bg-white transition-all shadow-2xs">
          {/* Hidden Photo / Video Picker */}
          <input
            type="file"
            ref={mediaInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*"
          />

          {/* Hidden Document / File / Audio Picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
          />

          {/* Photo / Video Button */}
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            disabled={isSending || !isReady}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/70 rounded-md transition-colors"
            title="Share photo or video"
            aria-label="Share photo or video"
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          {/* Document / File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending || !isReady}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors"
            title="Attach file or audio (max 15 MB)"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Emoji Toggle */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={isSending || !isReady}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-md transition-colors mr-1"
            title="Insert emoji"
            aria-label="Insert emoji"
          >
            <Smile className="h-4 w-4" />
          </button>

          {/* Text / Caption Input */}
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={!isReady || isSending}
            className="flex-1 min-w-0 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="p-1.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:bg-slate-200 disabled:text-slate-400 transition-all ml-1.5 shadow-2xs shrink-0"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
