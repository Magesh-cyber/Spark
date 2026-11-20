"use client";

/**
 * Nexconn Call SDK Client Wrapper & Signaling Bridge
 * 
 * Provides initialization, session handling, and WebRTC integration
 * for @nexconn/call and @nexconn/chat.
 */

let isEngineInstalled = false;
let callEngineInstance: any = null;

export interface NexconnCallOptions {
  appKey?: string;
  userId?: string;
  token?: string;
  logOutputLevel?: 1 | 2 | 3 | 4;
}

/**
 * Installs and initializes the NCCallEngine singleton safely in browser environments.
 */
export async function initNexconnCallEngine(options?: NexconnCallOptions) {
  if (typeof window === "undefined") return null;

  try {
    const { NCCallEngine, NCCallLogLevel } = await import("@nexconn/call");

    if (!isEngineInstalled) {
      try {
        NCCallEngine.install();
        isEngineInstalled = true;
      } catch (err) {
        // Already installed or handled by ChatEngine
      }
    }

    if (!callEngineInstance) {
      callEngineInstance = NCCallEngine.initialize({
        logOutputLevel: options?.logOutputLevel ?? NCCallLogLevel.WARN,
        isPubLowResolutionStream: false,
      });
    }

    return callEngineInstance;
  } catch (err) {
    console.warn("Nexconn Call SDK initialization note:", err);
    return null;
  }
}

/**
 * Returns the active call engine instance if initialized
 */
export function getNexconnCallEngine() {
  return callEngineInstance;
}

/**
 * Start a 1:1 or group call via Nexconn Call SDK
 */
export async function startNexconnCall(params: {
  calleeIds: string[];
  callType?: "SINGLE" | "MULTI";
  mediaType?: "AUDIO" | "AUDIO_VIDEO";
  extra?: string;
}) {
  const engine = await initNexconnCallEngine();
  if (!engine) {
    throw new Error("Nexconn Call Engine is not initialized.");
  }

  const { NCCallType, NCCallMediaType } = await import("@nexconn/call");

  return engine.startCall({
    calleeIds: params.calleeIds,
    callType: params.callType === "MULTI" ? NCCallType.MULTI : NCCallType.SINGLE,
    mediaType: params.mediaType === "AUDIO" ? NCCallMediaType.AUDIO : NCCallMediaType.AUDIO_VIDEO,
    extra: params.extra,
  });
}

/**
 * Accept an incoming call session
 */
export async function acceptNexconnCall(callId: string) {
  const engine = await initNexconnCallEngine();
  if (!engine) return null;
  return engine.acceptCall({ callId });
}

/**
 * Hang up / end the current call
 */
export async function endNexconnCall(callId?: string) {
  const engine = await initNexconnCallEngine();
  if (!engine) return null;
  return engine.endCall(callId ? { callId } : undefined);
}

/**
 * Toggle camera during call
 */
export async function setNexconnCameraEnabled(enabled: boolean) {
  const engine = await initNexconnCallEngine();
  if (!engine) return null;
  return engine.enableCamera(enabled);
}

/**
 * Toggle microphone during call
 */
export async function setNexconnMicEnabled(enabled: boolean) {
  const engine = await initNexconnCallEngine();
  if (!engine) return null;
  return engine.enableMicrophone(enabled);
}
