"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";

interface IncomingCallPayload {
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  callType: "VOICE" | "VIDEO";
  roomCode: string;
}

export function IncomingCallDialog() {
  const { currentUser, activeWorkspace } = useWorkspace();
  const router = useRouter();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    const supabase = createClient();
    const channelName = `spark-user-calls:${currentUser.id}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "incoming-call" }, ({ payload }) => {
        if (payload && payload.callerId !== currentUser.id) {
          setIncomingCall(payload as IncomingCallPayload);
        }
      })
      .on("broadcast", { event: "call-cancelled" }, () => {
        setIncomingCall(null);
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [currentUser?.id]);

  if (!incomingCall) return null;

  const handleAccept = () => {
    const callData = incomingCall;
    setIncomingCall(null);
    // Redirect to direct messages with caller and connect to the active call
    router.push(
      `/chat?dm=${encodeURIComponent(callData.callerId)}&activeCall=${encodeURIComponent(
        callData.roomCode
      )}&type=${callData.callType.toLowerCase()}`
    );
  };

  const handleDecline = () => {
    const callData = incomingCall;
    setIncomingCall(null);

    // Notify caller that call was declined
    if (callData) {
      try {
        const supabase = createClient();
        const callerChan = supabase.channel(`spark-call-response:${callData.roomCode}`);
        callerChan.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            callerChan.send({
              type: "broadcast",
              event: "call-declined",
              payload: { receiverId: currentUser?.id },
            });
            setTimeout(() => supabase.removeChannel(callerChan), 1000);
          }
        });
      } catch {}
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-[#202124] border border-[#3c4043] p-6 text-white shadow-2xl flex flex-col items-center text-center">
        {/* Pulsing Avatar */}
        <div className="relative mb-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1a73e8] text-2xl font-semibold text-white shadow-lg">
            {incomingCall.callerName.charAt(0)}
          </div>
          <span className="absolute -inset-2 rounded-full border-2 border-[#8ab4f8] animate-ping opacity-75" />
        </div>

        {/* Caller Info */}
        <h3 className="text-lg font-medium text-white mb-1">
          {incomingCall.callerName}
        </h3>
        <p className="text-xs text-[#9aa0a6] mb-6 flex items-center gap-1.5">
          {incomingCall.callType === "VIDEO" ? (
            <Video className="h-3.5 w-3.5 text-[#8ab4f8]" />
          ) : (
            <Phone className="h-3.5 w-3.5 text-[#8ab4f8]" />
          )}
          <span>Incoming 1-on-1 {incomingCall.callType === "VIDEO" ? "Video" : "Voice"} Call</span>
        </p>

        {/* Action Buttons (Decline / Accept) */}
        <div className="flex items-center justify-center gap-8 w-full pt-2">
          {/* Decline (Red) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleDecline}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ea4335] hover:bg-[#d93025] text-white shadow-lg transition-transform active:scale-95"
              title="Decline"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-[#9aa0a6]">Decline</span>
          </div>

          {/* Accept (Green) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={handleAccept}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[#34a853] hover:bg-[#2d9249] text-white shadow-lg transition-transform active:scale-95"
              title="Accept"
            >
              <Phone className="h-6 w-6" />
            </button>
            <span className="text-[11px] text-[#9aa0a6]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
