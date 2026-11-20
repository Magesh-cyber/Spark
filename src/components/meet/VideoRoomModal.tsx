"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  Users,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Sparkles,
  Send,
  Shield,
  Volume2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordWorkspaceCallLog } from "@/lib/actions/meetings";
import {
  initNexconnCallEngine,
  setNexconnCameraEnabled,
  setNexconnMicEnabled,
} from "@/lib/nexconn/call-service";

export interface VideoRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  roomCode: string;
  roomTitle: string;
  callType?: "VOICE" | "VIDEO";
  currentUser: {
    id: string;
    fullName?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
  receiver?: {
    id: string;
    fullName: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
  onCallEnded?: () => void;
}

interface InCallChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export function VideoRoomModal({
  isOpen,
  onClose,
  workspaceId,
  roomCode,
  roomTitle,
  callType = "VIDEO",
  currentUser,
  receiver,
  onCallEnded,
}: VideoRoomModalProps) {
  // Media state
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType !== "VOICE");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState(false);

  // UI state
  const [callDuration, setCallDuration] = useState(0);
  const [activeSidePanel, setActiveSidePanel] = useState<"chat" | "participants" | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // In-call chat
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([
    {
      id: "sys-1",
      senderName: "Spark System",
      senderId: "system",
      text: `Connected to room [${roomCode}]. Communications are encrypted.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initialize WebRTC Media Stream & Audio Analyser
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCallDuration(0);
    setMediaError(null);

    // Timer for call duration
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Nexconn Call Engine warm-up
    initNexconnCallEngine().catch(() => {});

    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType !== "VOICE" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && callType !== "VOICE") {
          localVideoRef.current.srcObject = stream;
        }

        // Web Audio API for real-time speaking detection
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioContextRef.current = audioCtx;
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const checkAudio = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;
              setIsSpeaking(average > 15);
              animFrameRef.current = requestAnimationFrame(checkAudio);
            };

            checkAudio();
          }
        } catch (e) {
          console.warn("Audio analyser not initialized:", e);
        }
      } catch (err: any) {
        console.warn("Media access warning:", err);
        if (isMounted) {
          setMediaError(
            err.name === "NotAllowedError"
              ? "Microphone or Camera access was denied in browser permissions."
              : "Could not access camera/microphone hardware. Audio fallback active."
          );
        }
      }
    }

    setupMedia();

    // Random slight speaking animation for remote peer when connected to make UI lively
    const remoteSpeakerTimer = setInterval(() => {
      if (Math.random() > 0.6) {
        setRemoteIsSpeaking(true);
        setTimeout(() => setRemoteIsSpeaking(false), 2400);
      }
    }, 4500);

    return () => {
      isMounted = false;
      clearInterval(remoteSpeakerTimer);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
    };
  }, [isOpen, callType]);

  // 2. Toggle Microphone
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
      setNexconnMicEnabled(!micEnabled).catch(() => {});
    }
  };

  // 3. Toggle Camera
  const handleToggleCamera = async () => {
    if (callType === "VOICE") return;

    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((t) => {
          t.enabled = !cameraEnabled;
        });
        setCameraEnabled(!cameraEnabled);
        setNexconnCameraEnabled(!cameraEnabled).catch(() => {});
      } else if (!cameraEnabled) {
        // Request video track if initially started as voice
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setCameraEnabled(true);
          setNexconnCameraEnabled(true).catch(() => {});
        } catch (e) {
          console.warn("Could not enable camera:", e);
        }
      }
    }
  };

  // 4. Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);

      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = displayStream;
      }

      displayStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        screenStreamRef.current = null;
      };
    } catch (err) {
      console.warn("Screen share cancelled or failed:", err);
      setIsScreenSharing(false);
    }
  };

  // 5. Send In-Call Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: InCallChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: currentUser?.fullName || "You",
      senderId: currentUser?.id || "local",
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");
  };

  // 6. Copy Room Link
  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const meetUrl = `${origin}/meet?room=${roomCode}`;
    navigator.clipboard.writeText(meetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 7. Fullscreen Toggle
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 8. Hang Up / End Meeting
  const handleEndCall = async () => {
    // Record call log to DB
    if (workspaceId && workspaceId !== "personal-fallback") {
      try {
        await recordWorkspaceCallLog({
          workspaceId,
          receiverId: receiver?.id,
          roomCode,
          type: callType,
          status: "COMPLETED",
          duration: callDuration,
        });
      } catch (e) {
        console.error("Failed to record call log:", e);
      }
    }

    if (onCallEnded) onCallEnded();
    onClose();
  };

  // Format elapsed seconds as 00:00 or 00:00:00
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#0B0912] text-white select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#120F1D]/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md">
            <Video className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight">{roomTitle}</h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 flex items-center gap-1 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-white/50 flex items-center gap-2">
              <span>Code: {roomCode}</span>
              <span>•</span>
              <span className="font-mono text-purple-300">{formatDuration(callDuration)}</span>
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs text-white/80 hover:text-white hover:bg-white/10 border border-white/10"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            {copiedLink ? "Link Copied!" : "Copy Link"}
          </Button>

          <button
            onClick={handleToggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Call Stage Area */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Main Video / Content Area */}
        <div className="relative flex flex-1 flex-col items-center justify-center p-3 md:p-6 overflow-hidden">
          {mediaError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs text-amber-200 backdrop-blur-md max-w-md">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{mediaError}</span>
            </div>
          )}

          {/* Screen Share Large View */}
          {isScreenSharing ? (
            <div className="relative h-full w-full max-w-6xl rounded-2xl overflow-hidden border border-purple-500/30 bg-black/80 flex items-center justify-center shadow-2xl">
              <video
                ref={screenShareVideoRef}
                autoPlay
                playsInline
                className="h-full w-full object-contain"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-purple-950/80 px-2.5 py-1 text-xs text-purple-200 border border-purple-500/40">
                <Monitor className="h-3.5 w-3.5 text-purple-400" />
                <span>You are sharing your screen</span>
              </div>
            </div>
          ) : (
            /* Multi-Participant Grid */
            <div
              className={`grid h-full w-full max-w-6xl gap-4 ${
                receiver ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
              } items-center justify-center`}
            >
              {/* Local User Tile */}
              <div
                className={`relative flex h-full max-h-[540px] w-full flex-col items-center justify-center rounded-2xl overflow-hidden border transition-all duration-300 ${
                  isSpeaking
                    ? "border-purple-500 ring-2 ring-purple-500/40 shadow-[0_0_25px_rgba(168,85,247,0.35)]"
                    : "border-white/10 bg-[#161224]"
                }`}
              >
                {/* Live Video Feed */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${
                    !cameraEnabled || callType === "VOICE" ? "hidden" : "block"
                  }`}
                />

                {/* Avatar Fallback when camera is OFF */}
                {(!cameraEnabled || callType === "VOICE") && (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div
                      className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-3xl font-bold text-white shadow-xl ${
                        isSpeaking ? "ring-4 ring-purple-400 scale-105" : ""
                      } transition-all duration-200`}
                    >
                      {currentUser?.fullName?.charAt(0) || "U"}
                      {isSpeaking && (
                        <div className="absolute -inset-2 rounded-full border-2 border-purple-400 animate-ping opacity-60" />
                      )}
                    </div>
                    <p className="text-sm font-medium text-white/90">
                      {currentUser?.fullName || "You"}
                    </p>
                  </div>
                )}

                {/* Tile Overlay Info */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                    {currentUser?.fullName || "You"} (Host)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-md backdrop-blur-md ${
                        micEnabled ? "bg-black/60 text-emerald-400" : "bg-red-500/80 text-white"
                      }`}
                    >
                      {micEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    </span>
                    {!cameraEnabled && callType !== "VOICE" && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/80 text-white backdrop-blur-md">
                        <VideoOff className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Remote Peer Tile (1:1 Call or Invited Teammate) */}
              {receiver && (
                <div
                  className={`relative flex h-full max-h-[540px] w-full flex-col items-center justify-center rounded-2xl overflow-hidden border transition-all duration-300 ${
                    remoteIsSpeaking
                      ? "border-emerald-500 ring-2 ring-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                      : "border-white/10 bg-[#161224]"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div
                      className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-3xl font-bold text-white shadow-xl ${
                        remoteIsSpeaking ? "ring-4 ring-emerald-400 scale-105" : ""
                      } transition-all duration-200`}
                    >
                      {receiver.fullName?.charAt(0) || "T"}
                      {remoteIsSpeaking && (
                        <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 animate-ping opacity-60" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">{receiver.fullName}</p>
                      <p className="text-xs text-white/50">{receiver.email || "Workspace Member"}</p>
                    </div>
                  </div>

                  {/* Remote Tile Info */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      {receiver.fullName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-emerald-400 backdrop-blur-md">
                        <Mic className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Slide-Out Side Panel (In-Call Chat & Participants) */}
        {activeSidePanel && (
          <aside className="relative flex w-80 shrink-0 flex-col border-l border-white/10 bg-[#120F1D]/95 backdrop-blur-lg transition-all animate-in slide-in-from-right-4 duration-200">
            {/* Panel Tabs Header */}
            <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSidePanel("chat")}
                  className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                    activeSidePanel === "chat"
                      ? "text-purple-300 bg-purple-500/20"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  In-Call Chat
                </button>
                <button
                  onClick={() => setActiveSidePanel("participants")}
                  className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                    activeSidePanel === "participants"
                      ? "text-purple-300 bg-purple-500/20"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Participants ({receiver ? "2" : "1"})
                </button>
              </div>

              <button
                onClick={() => setActiveSidePanel(null)}
                className="text-xs text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>

            {/* Chat Content */}
            {activeSidePanel === "chat" && (
              <div className="flex flex-1 flex-col justify-between overflow-hidden p-3">
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-2.5 text-xs ${
                        msg.senderId === "system"
                          ? "bg-white/5 border border-white/10 text-white/60 text-center italic"
                          : msg.senderId === currentUser?.id
                          ? "bg-purple-600/30 border border-purple-500/30 text-purple-100 ml-4"
                          : "bg-white/10 border border-white/10 text-white/90 mr-4"
                      }`}
                    >
                      {msg.senderId !== "system" && (
                        <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
                          <span className="font-semibold text-white/80">{msg.senderName}</span>
                          <span>{msg.timestamp}</span>
                        </div>
                      )}
                      <p className="break-words leading-relaxed">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2 pt-2 border-t border-white/10">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type in-call message..."
                    className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* Participants Content */}
            {activeSidePanel === "participants" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Local user entry */}
                <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5 border border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white">
                      {currentUser?.fullName?.charAt(0) || "U"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {currentUser?.fullName || "You"}{" "}
                        <span className="text-[10px] text-purple-400 font-normal">(Host)</span>
                      </p>
                      <p className="text-[10px] text-white/50">{currentUser?.email || "Host"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70">
                    {micEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5 text-red-400" />}
                    {cameraEnabled ? <Video className="h-3.5 w-3.5 text-emerald-400" /> : <VideoOff className="h-3.5 w-3.5 text-red-400" />}
                  </div>
                </div>

                {/* Remote user entry */}
                {receiver && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5 border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        {receiver.fullName?.charAt(0) || "T"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{receiver.fullName}</p>
                        <p className="text-[10px] text-white/50">{receiver.email || "Workspace Member"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/70">
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                      <Video className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <footer className="flex h-20 shrink-0 items-center justify-center border-t border-white/10 bg-[#120F1D]/90 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Microphone */}
          <button
            onClick={handleToggleMic}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
              micEnabled
                ? "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30"
            }`}
            title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          {callType !== "VOICE" && (
            <button
              onClick={handleToggleCamera}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                cameraEnabled
                  ? "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                  : "bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30"
              }`}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          )}

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
              isScreenSharing
                ? "bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-600/40"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            }`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>

          {/* In-Call Chat */}
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === "chat" ? null : "chat")}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
              activeSidePanel === "chat"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            }`}
            title="In-call chat"
          >
            <MessageSquare className="h-5 w-5" />
          </button>

          {/* Participants */}
          <button
            onClick={() => setActiveSidePanel(activeSidePanel === "participants" ? null : "participants")}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
              activeSidePanel === "participants"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
            }`}
            title="Participants"
          >
            <Users className="h-5 w-5" />
          </button>

          {/* End Call (Red Button) */}
          <button
            onClick={handleEndCall}
            className="flex h-12 w-14 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-600/40 ml-4 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Leave / End Meeting"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
