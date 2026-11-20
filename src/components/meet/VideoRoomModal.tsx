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
  Send,
  Info,
  RotateCcw,
  Home,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordWorkspaceCallLog } from "@/lib/actions/meetings";
import { createClient } from "@/lib/supabase/client";

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

interface RemotePeerInfo {
  id: string;
  fullName: string;
  email?: string;
  avatarUrl?: string | null;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
  ],
};

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
  // Media states
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType !== "VOICE");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState(false);

  // Peer & Stream states
  const [remotePeer, setRemotePeer] = useState<RemotePeerInfo | null>(receiver || null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Call lifecycle states (active, left)
  const [callState, setCallState] = useState<"active" | "left">("active");
  const [leaveReason, setLeaveReason] = useState<string>("You left the meeting");

  // UI state
  const [callDuration, setCallDuration] = useState(0);
  const [activeSidePanel, setActiveSidePanel] = useState<"chat" | "participants" | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentTimeStr, setCurrentTimeStr] = useState("");

  // In-call chat
  const [chatMessages, setChatMessages] = useState<InCallChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const myPeerId = currentUser?.id || `usr-${Math.random().toString(36).substring(2, 8)}`;
  const myName = currentUser?.fullName || "You";

  // Clock in bottom bar (Google Meet style)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Guarantee local video attachment whenever element is mounted / remounted
  const bindLocalVideo = useCallback(() => {
    if (localVideoRef.current && localStreamRef.current && cameraEnabled && callType !== "VOICE") {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [cameraEnabled, callType]);

  // Keep local video attached across renders
  useEffect(() => {
    bindLocalVideo();
  }, [bindLocalVideo, isScreenSharing, cameraEnabled]);

  // Ensure remote stream is attached to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, isScreenSharing]);

  // Create RTCPeerConnection
  const initPeerConnection = useCallback(
    (targetPeerId: string, channel: any) => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Add local media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle receiving remote audio/video tracks
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          setRemoteStream(stream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.play().catch(() => {});
          }

          // Remote voice level analyser
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const rAudioCtx = new AudioCtx();
              const rAnalyser = rAudioCtx.createAnalyser();
              rAnalyser.fftSize = 256;
              const rSource = rAudioCtx.createMediaStreamSource(stream);
              rSource.connect(rAnalyser);
              const rBuf = new Uint8Array(rAnalyser.frequencyBinCount);

              const checkRemoteVol = () => {
                if (!peerConnectionRef.current) return;
                rAnalyser.getByteFrequencyData(rBuf);
                let sum = 0;
                for (let i = 0; i < rBuf.length; i++) sum += rBuf[i];
                setRemoteIsSpeaking(sum / rBuf.length > 15);
                requestAnimationFrame(checkRemoteVol);
              };
              checkRemoteVol();
            }
          } catch {}
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && channel) {
          channel.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              type: "candidate",
              candidate: event.candidate.toJSON(),
              senderId: myPeerId,
              targetId: targetPeerId,
            },
          });
        }
      };

      // Handle Remote Disconnection (when mobile peer cuts call, locks screen, or leaves)
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed" ||
          pc.connectionState === "failed"
        ) {
          setRemoteStream(null);
          setRemotePeer(null);
          setLeaveReason("The other participant left the call");
          setCallState("left");
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "closed" ||
          pc.iceConnectionState === "failed"
        ) {
          setRemoteStream(null);
          setRemotePeer(null);
          setLeaveReason("The other participant left the call");
          setCallState("left");
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [myPeerId]
  );

  // Setup Local Media & Supabase Realtime WebRTC
  useEffect(() => {
    if (!isOpen || callState !== "active") return;

    let isMounted = true;
    setCallDuration(0);
    candidateQueueRef.current = [];

    // Elapsed call duration timer
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    const supabase = createClient();
    const channelName = `spark-room:${roomCode}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });
    supabaseChannelRef.current = channel;

    async function startCallSession() {
      // Step A: Acquire Local Camera & Microphone
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
        bindLocalVideo();

        // Web Audio API for speaking volume indicator
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
              for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
              setIsSpeaking(sum / bufferLength > 15);
              animFrameRef.current = requestAnimationFrame(checkAudio);
            };
            checkAudio();
          }
        } catch {}
      } catch (err: any) {
        console.warn("Media access warning:", err);
      }

      // Step B: Realtime WebRTC Handshake
      channel
        .on("broadcast", { event: "peer-join" }, async ({ payload }) => {
          if (payload.senderId === myPeerId) return;

          setRemotePeer({
            id: payload.senderId,
            fullName: payload.senderName || "Participant",
            avatarUrl: payload.senderAvatar,
            micEnabled: payload.micEnabled,
            cameraEnabled: payload.cameraEnabled,
          });

          const pc = initPeerConnection(payload.senderId, channel);
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);

          channel.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              type: "offer",
              sdp: offer,
              senderId: myPeerId,
              senderName: myName,
              senderAvatar: currentUser?.avatarUrl,
              targetId: payload.senderId,
              micEnabled,
              cameraEnabled,
            },
          });
        })
        .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
          if (payload.targetId !== myPeerId) return;

          // Received Offer: reply with Answer
          if (payload.type === "offer") {
            setRemotePeer({
              id: payload.senderId,
              fullName: payload.senderName || "Participant",
              avatarUrl: payload.senderAvatar,
              micEnabled: payload.micEnabled,
              cameraEnabled: payload.cameraEnabled,
            });

            const pc = initPeerConnection(payload.senderId, channel);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

            while (candidateQueueRef.current.length > 0) {
              const c = candidateQueueRef.current.shift();
              if (c) await pc.addIceCandidate(new RTCIceCandidate(c));
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            channel.send({
              type: "broadcast",
              event: "webrtc-signal",
              payload: {
                type: "answer",
                sdp: answer,
                senderId: myPeerId,
                targetId: payload.senderId,
              },
            });
          }

          // Received Answer
          else if (payload.type === "answer") {
            if (peerConnectionRef.current) {
              await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(payload.sdp)
              );
              while (candidateQueueRef.current.length > 0) {
                const c = candidateQueueRef.current.shift();
                if (c) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c));
              }
            }
          }

          // Received ICE Candidate
          else if (payload.type === "candidate") {
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
              try {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(payload.candidate)
                );
              } catch (e) {}
            } else {
              candidateQueueRef.current.push(payload.candidate);
            }
          }
        })
        .on("broadcast", { event: "chat" }, ({ payload }) => {
          setChatMessages((prev) => [...prev, payload]);
          if (activeSidePanel !== "chat") {
            setHasUnreadChat(true);
          }
        })
        .on("broadcast", { event: "media-state" }, ({ payload }) => {
          if (payload.senderId !== myPeerId) {
            setRemotePeer((prev) =>
              prev
                ? {
                    ...prev,
                    micEnabled: payload.micEnabled ?? prev.micEnabled,
                    cameraEnabled: payload.cameraEnabled ?? prev.cameraEnabled,
                  }
                : null
            );
          }
        })
        // When peer ends the call from their side (mobile or desktop)
        .on("broadcast", { event: "call-ended" }, ({ payload }) => {
          if (payload.senderId !== myPeerId) {
            setRemoteStream(null);
            setRemotePeer(null);
            setLeaveReason(
              payload.senderName
                ? `${payload.senderName} ended the call`
                : "The other participant ended the call"
            );
            setCallState("left");
          }
        });

      // Announce presence on channel connect
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({
            type: "broadcast",
            event: "peer-join",
            payload: {
              senderId: myPeerId,
              senderName: myName,
              senderAvatar: currentUser?.avatarUrl,
              micEnabled,
              cameraEnabled,
            },
          });
        }
      });
    }

    startCallSession();

    return () => {
      isMounted = false;
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }

      if (supabaseChannelRef.current) {
        try {
          supabase.removeChannel(supabaseChannelRef.current);
        } catch {}
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
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
  }, [isOpen, callState, roomCode, callType, initPeerConnection, bindLocalVideo, myPeerId, myName, currentUser?.avatarUrl, activeSidePanel]);

  // Toggle Microphone
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextState = !micEnabled;
      audioTracks.forEach((t) => {
        t.enabled = nextState;
      });
      setMicEnabled(nextState);

      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { senderId: myPeerId, micEnabled: nextState },
        });
      }
    }
  };

  // Toggle Camera
  const handleToggleCamera = async () => {
    if (callType === "VOICE") return;

    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const nextState = !cameraEnabled;

      if (videoTracks.length > 0) {
        videoTracks.forEach((t) => {
          t.enabled = nextState;
        });
        setCameraEnabled(nextState);
      } else if (nextState) {
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newTrack);

          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(newTrack, localStreamRef.current);
          }
          setCameraEnabled(true);
        } catch (e) {
          console.warn("Could not acquire camera track:", e);
        }
      }

      bindLocalVideo();

      if (supabaseChannelRef.current) {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "media-state",
          payload: { senderId: myPeerId, cameraEnabled: nextState },
        });
      }
    }
  };

  // Stop Screen Share helper (safely restores local camera on both sides)
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Revert WebRTC sender track back to local camera track
    if (peerConnectionRef.current && localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = peerConnectionRef.current
        .getSenders()
        .find((s) => s.track && s.track.kind === "video");
      if (sender && camTrack) {
        sender.replaceTrack(camTrack);
      }
    }

    // Force immediate re-attachment to local video element so local preview is never blank
    setTimeout(() => {
      bindLocalVideo();
    }, 50);
  }, [bindLocalVideo]);

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = displayStream;
      setIsScreenSharing(true);

      // Re-attach local camera video element immediately
      setTimeout(() => {
        bindLocalVideo();
      }, 50);

      // Re-attach screen video element
      setTimeout(() => {
        if (screenShareVideoRef.current) {
          screenShareVideoRef.current.srcObject = displayStream;
          screenShareVideoRef.current.play().catch(() => {});
        }
      }, 50);

      // Replace WebRTC sender video track with screen track for remote peer
      const screenTrack = displayStream.getVideoTracks()[0];
      if (peerConnectionRef.current && screenTrack) {
        const sender = peerConnectionRef.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      }

      // Handle user clicking the native browser "Stop sharing" bar
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.warn("Screen share cancelled:", err);
      setIsScreenSharing(false);
    }
  };

  // Send In-Call Chat Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: InCallChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: myName,
      senderId: myPeerId,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput("");

    if (supabaseChannelRef.current) {
      supabaseChannelRef.current.send({
        type: "broadcast",
        event: "chat",
        payload: newMsg,
      });
    }
  };

  // Copy Meeting Link
  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const meetUrl = `${origin}/meet?room=${roomCode}`;
    navigator.clipboard.writeText(meetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // End Call / Cut Call (Google Meet behavior: broadcasts disconnect & shows post-call screen)
  const handleEndCall = async () => {
    // 1. Broadcast call-ended to other peer so their call cuts simultaneously
    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: "broadcast",
          event: "call-ended",
          payload: { senderId: myPeerId, senderName: myName, reason: "left" },
        });
      } catch {}
    }

    // 2. Stop all hardware tracks immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 3. Persist call log to DB
    if (workspaceId && workspaceId !== "personal-fallback") {
      try {
        await recordWorkspaceCallLog({
          workspaceId,
          receiverId: remotePeer?.id || receiver?.id,
          roomCode,
          type: callType,
          status: "COMPLETED",
          duration: callDuration,
        });
      } catch (e) {
        console.error("Failed to record call log:", e);
      }
    }

    // 4. Transition to Google Meet style "You left the meeting" screen
    setLeaveReason("You left the meeting");
    setCallState("left");
    if (onCallEnded) onCallEnded();
  };

  // Rejoin Call
  const handleRejoin = () => {
    setCallState("active");
    setRemoteStream(null);
    setRemotePeer(receiver || null);
    setCallDuration(0);
  };

  // Fully close and return to workspace
  const handleReturnHome = () => {
    onClose();
  };

  if (!isOpen) return null;

  const hasRemotePeer = !!remotePeer || !!remoteStream;

  // =========================================================================
  // GOOGLE MEET POST-CALL SCREEN ("You left the meeting")
  // =========================================================================
  if (callState === "left") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#202124] text-white select-none">
        <div className="flex flex-col items-center text-center max-w-md px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#303134] text-white/90 mb-5 shadow-lg">
            <PhoneOff className="h-7 w-7 text-[#ea4335]" />
          </div>

          <h2 className="text-2xl font-normal text-white tracking-tight mb-2">
            {leaveReason}
          </h2>
          <p className="text-sm text-[#9aa0a6] mb-8 font-mono">
            {roomCode}
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={handleRejoin}
              className="border-[#5f6368] text-white hover:bg-[#303134] rounded-full px-6 text-sm h-11"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Rejoin
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleReturnHome}
              className="bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-full px-6 text-sm h-11"
            >
              <Home className="h-4 w-4 mr-2" />
              Return to home screen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // GOOGLE MEET IN-CALL STUDIO UI
  // =========================================================================
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-[#202124] text-white select-none overflow-hidden font-sans"
    >
      {/* Top Bar (Clean, Minimal, No AI Slop) */}
      <header className="flex h-12 shrink-0 items-center justify-between px-4 bg-[#202124]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-white/90 truncate max-w-xs md:max-w-md">
            {roomTitle || "Meeting"}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-full bg-[#303134] hover:bg-[#3c4043] px-3 py-1.5 text-xs text-white/90 transition-colors"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? "Link copied" : "Copy link"}</span>
          </button>
        </div>
      </header>

      {/* Main Call Stage */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 items-center justify-center p-3 md:p-4 overflow-hidden">
          {/* ============================================================== */}
          {/* SCREEN SHARE ACTIVE PRESENTATION VIEW                         */}
          {/* ============================================================== */}
          {isScreenSharing ? (
            <div className="relative flex h-full w-full max-w-7xl items-center justify-center gap-3">
              {/* Main Presentation Stage */}
              <div className="relative flex-1 h-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-[#3c4043]">
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 rounded-lg bg-[#202124]/90 px-3 py-1.5 text-xs text-white/90 border border-[#3c4043]">
                  <Monitor className="h-3.5 w-3.5 text-blue-400" />
                  <span>You are presenting to everyone</span>
                </div>
              </div>

              {/* Side Floating Participant Tiles while sharing (Never Blank!) */}
              <div className="flex flex-col gap-3 w-56 shrink-0 h-full justify-start">
                {/* Local Camera Tile while sharing */}
                <div className="relative h-40 w-full rounded-xl overflow-hidden bg-[#303134] border border-[#3c4043]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover -scale-x-100 ${
                      !cameraEnabled || callType === "VOICE" ? "hidden" : "block"
                    }`}
                  />
                  {(!cameraEnabled || callType === "VOICE") && (
                    <div className="flex h-full w-full items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a73e8] text-base font-medium text-white">
                        {myName.charAt(0)}
                      </div>
                    </div>
                  )}
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                    You
                  </span>
                </div>

                {/* Remote Participant Tile while sharing */}
                {hasRemotePeer && (
                  <div className="relative h-40 w-full rounded-xl overflow-hidden bg-[#303134] border border-[#3c4043]">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className={`h-full w-full object-cover ${
                        remoteStream && remotePeer?.cameraEnabled !== false ? "block" : "hidden"
                      }`}
                    />
                    {(!remoteStream || remotePeer?.cameraEnabled === false) && (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ea4335] text-base font-medium text-white">
                          {remotePeer?.fullName?.charAt(0) || "P"}
                        </div>
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                      {remotePeer?.fullName || "Participant"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* STANDARD PARTICIPANT GRID VIEW (Google Meet style)            */
            /* ============================================================== */
            <div
              className={`grid h-full w-full max-w-6xl gap-3 ${
                hasRemotePeer ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
              } items-center justify-center`}
            >
              {/* Local User Tile */}
              <div
                className={`relative flex h-full max-h-[580px] w-full flex-col items-center justify-center rounded-2xl overflow-hidden bg-[#303134] border transition-all ${
                  isSpeaking ? "border-[#8ab4f8] ring-2 ring-[#8ab4f8]/50" : "border-[#3c4043]"
                }`}
              >
                {/* Local Camera Video */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover -scale-x-100 ${
                    !cameraEnabled || callType === "VOICE" ? "hidden" : "block"
                  }`}
                />

                {/* Initials Avatar fallback when camera is off */}
                {(!cameraEnabled || callType === "VOICE") && (
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className={`flex h-28 w-28 items-center justify-center rounded-full bg-[#1a73e8] text-4xl font-medium text-white shadow-md ${
                        isSpeaking ? "ring-4 ring-[#8ab4f8]" : ""
                      }`}
                    >
                      {myName.charAt(0)}
                    </div>
                  </div>
                )}

                {/* Bottom-left Name Tag & Mute Indicator */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="rounded-md bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                    You
                  </span>
                  {!micEnabled && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ea4335] text-white">
                      <MicOff className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Remote Peer Tile */}
              {hasRemotePeer && (
                <div
                  className={`relative flex h-full max-h-[580px] w-full flex-col items-center justify-center rounded-2xl overflow-hidden bg-[#303134] border transition-all ${
                    remoteIsSpeaking ? "border-[#8ab4f8] ring-2 ring-[#8ab4f8]/50" : "border-[#3c4043]"
                  }`}
                >
                  {/* Remote Video Feed */}
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className={`h-full w-full object-cover ${
                      remoteStream && remotePeer?.cameraEnabled !== false ? "block" : "hidden"
                    }`}
                  />

                  {/* Remote Initials Avatar fallback */}
                  {(!remoteStream || remotePeer?.cameraEnabled === false) && (
                    <div className="flex flex-col items-center justify-center">
                      <div
                        className={`flex h-28 w-28 items-center justify-center rounded-full bg-[#34a853] text-4xl font-medium text-white shadow-md ${
                          remoteIsSpeaking ? "ring-4 ring-[#8ab4f8]" : ""
                        }`}
                      >
                        {remotePeer?.fullName?.charAt(0) || "P"}
                      </div>
                    </div>
                  )}

                  {/* Bottom-left Remote Name Tag & Mute Status */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="rounded-md bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white">
                      {remotePeer?.fullName || "Participant"}
                    </span>
                    {remotePeer?.micEnabled === false && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ea4335] text-white">
                        <MicOff className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Slide-Out Side Panel (In-Call Chat & People) */}
        {activeSidePanel && (
          <aside className="relative flex w-80 shrink-0 flex-col border-l border-[#3c4043] bg-[#202124] transition-all animate-in slide-in-from-right-4 duration-150">
            {/* Header */}
            <div className="flex h-14 items-center justify-between border-b border-[#3c4043] px-4">
              <h4 className="text-sm font-medium text-white">
                {activeSidePanel === "chat" ? "In-call messages" : "People"}
              </h4>
              <button
                onClick={() => setActiveSidePanel(null)}
                className="rounded-full p-1.5 text-[#9aa0a6] hover:bg-[#303134] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Panel */}
            {activeSidePanel === "chat" && (
              <div className="flex flex-1 flex-col justify-between overflow-hidden p-3">
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  <div className="rounded-lg bg-[#303134] p-3 text-xs text-[#9aa0a6] text-center leading-relaxed">
                    Messages can only be seen by people in the call and are deleted when the call ends.
                  </div>

                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-[#9aa0a6]">
                        <span className="font-semibold text-white/90">{msg.senderName}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="rounded-lg bg-[#303134] p-2.5 text-white/90 break-words leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2 pt-2 border-t border-[#3c4043]">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message"
                    className="flex-1 rounded-full border border-[#5f6368] bg-[#303134] px-4 py-2 text-xs text-white placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8]"
                  />
                  <button
                    type="submit"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* People Panel */}
            {activeSidePanel === "participants" && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="text-xs text-[#9aa0a6] font-medium uppercase tracking-wider mb-2">
                  In meeting ({hasRemotePeer ? "2" : "1"})
                </p>

                {/* You */}
                <div className="flex items-center justify-between rounded-lg bg-[#303134] p-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a73e8] text-xs font-medium text-white">
                      {myName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white">{myName} (You)</p>
                      <p className="text-[11px] text-[#9aa0a6]">Meeting host</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#9aa0a6]">
                    {micEnabled ? <Mic className="h-3.5 w-3.5 text-white" /> : <MicOff className="h-3.5 w-3.5 text-[#ea4335]" />}
                  </div>
                </div>

                {/* Remote Participant */}
                {hasRemotePeer && (
                  <div className="flex items-center justify-between rounded-lg bg-[#303134] p-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#34a853] text-xs font-medium text-white">
                        {remotePeer?.fullName?.charAt(0) || "P"}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white">{remotePeer?.fullName || "Participant"}</p>
                        <p className="text-[11px] text-[#9aa0a6]">Connected</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#9aa0a6]">
                      {remotePeer?.micEnabled !== false ? (
                        <Mic className="h-3.5 w-3.5 text-white" />
                      ) : (
                        <MicOff className="h-3.5 w-3.5 text-[#ea4335]" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ===================================================================== */}
      {/* GOOGLE MEET BOTTOM CONTROL BAR                                        */}
      {/* ===================================================================== */}
      <footer className="flex h-20 shrink-0 items-center justify-between px-6 bg-[#202124] border-t border-[#3c4043]/40">
        {/* Bottom Left: Meeting Code & Time */}
        <div className="hidden sm:flex items-center gap-3 text-sm text-white/90">
          <span className="font-mono text-xs text-[#9aa0a6] select-all">{roomCode}</span>
          <span className="text-[#5f6368]">|</span>
          <span className="text-xs text-[#9aa0a6]">{currentTimeStr}</span>
        </div>

        {/* Center: Circular Call Control Buttons */}
        <div className="flex items-center gap-3 mx-auto sm:mx-0">
          {/* Microphone */}
          <button
            onClick={handleToggleMic}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              micEnabled
                ? "bg-[#3c4043] hover:bg-[#474a4d] text-white"
                : "bg-[#ea4335] hover:bg-[#d93025] text-white"
            }`}
            title={micEnabled ? "Turn off microphone" : "Turn on microphone"}
          >
            {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera */}
          {callType !== "VOICE" && (
            <button
              onClick={handleToggleCamera}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                cameraEnabled
                  ? "bg-[#3c4043] hover:bg-[#474a4d] text-white"
                  : "bg-[#ea4335] hover:bg-[#d93025] text-white"
              }`}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </button>
          )}

          {/* Screen Share */}
          <button
            onClick={handleToggleScreenShare}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              isScreenSharing
                ? "bg-[#8ab4f8] text-[#202124]"
                : "bg-[#3c4043] hover:bg-[#474a4d] text-white"
            }`}
            title={isScreenSharing ? "Stop presenting" : "Present now"}
          >
            {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>

          {/* End Call (Google Red Pill Button) */}
          <button
            onClick={handleEndCall}
            className="flex h-12 w-14 items-center justify-center rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white shadow-md ml-2 transition-transform active:scale-95"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        </div>

        {/* Bottom Right: Info, People, Chat Toggles */}
        <div className="hidden sm:flex items-center gap-2">
          {/* People Toggle */}
          <button
            onClick={() => {
              setActiveSidePanel(activeSidePanel === "participants" ? null : "participants");
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              activeSidePanel === "participants" ? "bg-[#8ab4f8] text-[#202124]" : "text-white/80 hover:bg-[#303134]"
            }`}
            title="People"
          >
            <Users className="h-4 w-4" />
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              setActiveSidePanel(activeSidePanel === "chat" ? null : "chat");
              setHasUnreadChat(false);
            }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
              activeSidePanel === "chat" ? "bg-[#8ab4f8] text-[#202124]" : "text-white/80 hover:bg-[#303134]"
            }`}
            title="Chat with everyone"
          >
            <MessageSquare className="h-4 w-4" />
            {hasUnreadChat && activeSidePanel !== "chat" && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#8ab4f8]" />
            )}
          </button>

          {/* Copy Info Pill */}
          <button
            onClick={handleCopyLink}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/80 hover:bg-[#303134] transition-colors"
            title="Meeting details"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
