"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Mic,
  Square,
  Trash2,
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

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getSupportedAudioMime(): { mimeType: string; ext: string } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", ext: "webm" };
  }
  const candidates = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/mp4", ext: "m4a" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/wav", ext: "wav" },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    } catch {}
  }
  return { mimeType: "audio/webm", ext: "webm" };
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

  // Audio voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Recorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up recording hardware and timer
  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      mediaStreamRef.current = null;
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancelRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    stopMediaStream();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, [stopMediaStream, stopTimer]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (stagedPreviewUrl) {
        URL.revokeObjectURL(stagedPreviewUrl);
      }
    };
  }, [stagedPreviewUrl]);

  // Clear staged file and cancel active recording when switching conversations
  useEffect(() => {
    cancelRecording();
    setStagedFile(null);
    setStagedPreviewUrl(null);
    setUploadError(null);
  }, [activeConversation?.id, cancelRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

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
    if (
      file.type.startsWith("image/") ||
      file.type.startsWith("video/") ||
      file.type.startsWith("audio/")
    ) {
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

  // Start live microphone recording
  const startRecording = async () => {
    setUploadError(null);
    if (isSending || !isReady) return;

    if (
      typeof window === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setUploadError("Audio voice recording is not supported on this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const { mimeType } = getSupportedAudioMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100); // 100ms slice
      setIsRecording(true);
      setRecordingDuration(0);

      stopTimer();
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      stopMediaStream();
      stopTimer();
      setIsRecording(false);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setUploadError(
          "Microphone permission was denied. Please allow microphone access in your browser to record voice messages."
        );
      } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
        setUploadError("No microphone found. Please connect a microphone to record voice messages.");
      } else {
        setUploadError(err?.message || "Failed to start microphone recording.");
      }
    }
  };

  // Stop recording and either stage for preview OR send immediately
  const finishRecording = async (sendImmediately: boolean = false) => {
    if (!mediaRecorderRef.current || !isRecording) return;
    const duration = recordingDuration;
    stopTimer();

    const recorder = mediaRecorderRef.current;
    const { mimeType, ext } = getSupportedAudioMime();

    return new Promise<void>((resolve) => {
      recorder.onstop = async () => {
        stopMediaStream();
        setIsRecording(false);
        setRecordingDuration(0);

        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];

        if (!chunks || chunks.length === 0 || duration < 1) {
          setUploadError("Voice message too short.");
          resolve();
          return;
        }

        const audioBlob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}${now
          .getMinutes()
          .toString()
          .padStart(2, "0")}`;
        const fileName = `voice-message-${timeStr}.${ext}`;
        const audioFile = new File([audioBlob], fileName, {
          type: mimeType || "audio/webm",
          lastModified: Date.now(),
        });

        if (sendImmediately) {
          setIsSending(true);
          try {
            const res = await sendMedia(audioFile, text.trim() || undefined);
            if (!res.success) {
              setUploadError(res.error || "Failed to send voice message.");
            } else {
              setText("");
            }
          } finally {
            setIsSending(false);
          }
        } else {
          stageSelectedFile(audioFile);
        }
        resolve();
      };

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          recorder.onstop?.(new Event("stop"));
        }
      } catch {
        stopMediaStream();
        setIsRecording(false);
        resolve();
      }
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending) return;

    // If currently recording, clicking submit stops and sends the voice note
    if (isRecording) {
      await finishRecording(true);
      return;
    }

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

  const canSubmit =
    (Boolean(stagedFile) || Boolean(text.trim()) || isRecording) && !isSending && isReady;

  return (
    <div className="p-3 border-t border-[var(--spark-border)] bg-[var(--spark-surface)] relative space-y-2 transition-colors duration-150">
      {/* Glassmorphic Quick Emojis Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 spark-glass border rounded-[12px] shadow-elevated p-2 flex items-center gap-1 z-30 animate-in fade-in zoom-in-95">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="p-1.5 hover:bg-[var(--spark-highlight)] rounded-[6px] text-base transition-colors duration-150"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Upload / Recording Error Banner */}
      {uploadError && (
        <div className="flex items-center justify-between gap-2 rounded-[8px] border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-1.5 truncate">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="p-0.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Staged Media / Audio Preview Bar */}
      {stagedFile && (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--spark-accent)]/30 bg-[var(--spark-highlight)]/45 p-2 animate-in fade-in slide-in-from-bottom-1">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {stagedKind === "image" && stagedPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stagedPreviewUrl}
                alt={stagedFile.name}
                className="h-11 w-11 rounded-[8px] object-cover border border-[var(--spark-border)] shrink-0"
              />
            ) : stagedKind === "audio" && stagedPreviewUrl ? (
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)] flex items-center justify-center shrink-0">
                  <Mic className="h-4 w-4" />
                </div>
                <audio
                  src={stagedPreviewUrl}
                  controls
                  className="h-8 max-w-[190px] sm:max-w-[260px]"
                />
              </div>
            ) : (
              <div className="h-11 w-11 rounded-[8px] bg-[var(--spark-highlight)] text-[var(--spark-accent)] flex items-center justify-center shrink-0">
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
              <div className="text-xs font-semibold text-[var(--spark-text-primary)] truncate">
                {stagedFile.name}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--spark-text-secondary)] mt-0.5">
                <span>{formatBytes(stagedFile.size)}</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-medium">
                  <Lock className="h-2.5 w-2.5" />
                  AES-256 Encrypted
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearStagedFile}
            className="p-1.5 rounded-[6px] text-[var(--spark-text-muted)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface)] transition-colors duration-150 shrink-0"
            title="Remove attachment"
            aria-label="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Composer Box: Switches smoothly to Live Recording Studio Bar when recording */}
      {isRecording ? (
        <div className="flex items-center justify-between rounded-[10px] border border-[var(--spark-accent)]/45 bg-[var(--spark-highlight)]/45 px-3 py-2 text-xs transition-all duration-150 shadow-2xs">
          {/* Left: Blinking indicator, animated audio waveform & live timer */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>

            {/* Dynamic Sound Wave Simulation */}
            <div className="flex items-center gap-0.5 h-4">
              <span className="w-1 bg-[var(--spark-accent)] rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3" />
              <span className="w-1 bg-[var(--spark-accent)] rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-4" />
              <span className="w-1 bg-[var(--spark-accent)] rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-2" />
              <span className="w-1 bg-[var(--spark-accent)] rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-4" />
              <span className="w-1 bg-[var(--spark-accent)] rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2.5" />
            </div>

            <span className="font-mono font-semibold text-[var(--spark-text-primary)] text-xs tabular-nums">
              {formatDuration(recordingDuration)}
            </span>

            <span className="hidden sm:inline text-[11px] text-[var(--spark-text-secondary)] font-medium">
              Recording voice message...
            </span>
          </div>

          {/* Right: Discard, Stop & Review, and Instant Send */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-[6px] transition-colors duration-150"
              title="Discard recording"
              aria-label="Discard recording"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => finishRecording(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-[6px] border border-[var(--spark-border)] bg-[var(--spark-surface)] text-[var(--spark-text-secondary)] hover:text-[var(--spark-text-primary)] hover:bg-[var(--spark-surface-subtle)] transition-colors duration-150"
              title="Stop and preview audio before sending"
              aria-label="Stop and preview audio"
            >
              <Square className="h-3 w-3 fill-current text-[var(--spark-text-muted)]" />
              <span className="hidden xs:inline">Preview</span>
            </button>

            <button
              type="button"
              onClick={() => finishRecording(true)}
              disabled={isSending}
              className="p-1.5 rounded-[6px] text-white bg-[var(--spark-accent)] hover:bg-[var(--spark-accent-hover)] transition-all duration-150 shadow-2xs"
              title="Send voice message now"
              aria-label="Send voice message now"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-2">
          <div className="flex items-center rounded-[10px] border border-[var(--spark-border)] bg-[var(--spark-canvas)] px-2.5 py-2 focus-within:border-[var(--spark-accent)] focus-within:ring-1 focus-within:ring-[var(--spark-accent)] focus-within:bg-[var(--spark-surface)] transition-all duration-150">
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
              className="p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] rounded-[6px] transition-colors duration-150"
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
              className="p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] rounded-[6px] transition-colors duration-150"
              title="Attach file or audio (max 15 MB)"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Record Voice Message / Audio Button */}
            <button
              type="button"
              onClick={startRecording}
              disabled={isSending || !isReady}
              className="p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] rounded-[6px] transition-colors duration-150"
              title="Record voice message"
              aria-label="Record voice message"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Emoji Toggle */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              disabled={isSending || !isReady}
              className="p-1.5 text-[var(--spark-text-muted)] hover:text-[var(--spark-accent)] hover:bg-[var(--spark-highlight)] rounded-[6px] transition-colors duration-150 mr-1"
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
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-[13px] text-[var(--spark-text-primary)] placeholder:text-[var(--spark-text-muted)] focus:outline-none"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="p-1.5 rounded-[6px] text-white bg-[var(--spark-accent)] hover:bg-[var(--spark-accent-hover)] disabled:opacity-40 disabled:bg-[var(--spark-border)] disabled:text-[var(--spark-text-muted)] transition-all duration-150 ml-1.5 shadow-2xs shrink-0"
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
      )}
    </div>
  );
}
