import { MessageReplyInfo, HandoverReportData } from "@/components/chat/types";

export type ChatMediaKind = "image" | "video" | "audio" | "file";

export interface SparkMediaEnvelope {
  v: 1;
  mediaId: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: ChatMediaKind;
  encrypted: true;
  caption?: string;
}

export interface SparkRichEnvelope {
  v: 1;
  text: string;
  media?: SparkMediaEnvelope;
  replyTo?: MessageReplyInfo;
  handover?: HandoverReportData;
}

const MEDIA_PREFIX = "__SPARK_SECURE_MEDIA_V1__:";
const ENVELOPE_PREFIX = "__SPARK_ENVELOPE_V1__:";

export function encodeMediaMessage(envelope: SparkMediaEnvelope): string {
  return `${MEDIA_PREFIX}${JSON.stringify(envelope)}`;
}

export function encodeRichMessage(envelope: SparkRichEnvelope): string {
  return `${ENVELOPE_PREFIX}${JSON.stringify(envelope)}`;
}

export interface DecodedChatContent {
  text: string;
  media: SparkMediaEnvelope | null;
  replyTo?: MessageReplyInfo;
  handover?: HandoverReportData;
}

export function decodeMediaMessage(
  rawText: string | undefined | null
): DecodedChatContent {
  if (!rawText || typeof rawText !== "string") {
    return { text: "", media: null };
  }

  // 1. Check for modern unified envelope
  if (rawText.startsWith(ENVELOPE_PREFIX)) {
    try {
      const parsed = JSON.parse(rawText.slice(ENVELOPE_PREFIX.length)) as SparkRichEnvelope;
      if (parsed && parsed.v === 1) {
        return {
          text: parsed.text || "",
          media: parsed.media || null,
          replyTo: parsed.replyTo,
          handover: parsed.handover,
        };
      }
    } catch {
      // Fall back
    }
  }

  // 2. Check for legacy media envelope
  if (rawText.startsWith(MEDIA_PREFIX)) {
    try {
      const parsed = JSON.parse(rawText.slice(MEDIA_PREFIX.length)) as SparkMediaEnvelope;
      if (parsed && parsed.v === 1 && parsed.url && parsed.name) {
        return {
          text: parsed.caption || "",
          media: parsed,
        };
      }
    } catch {
      // Fall back
    }
  }

  return { text: rawText, media: null };
}

export function getMediaKindFromMime(mimeType: string): ChatMediaKind {
  const lower = (mimeType || "").toLowerCase();
  if (lower.startsWith("image/")) return "image";
  if (lower.startsWith("video/")) return "video";
  if (lower.startsWith("audio/")) return "audio";
  return "file";
}

export function getMediaSummaryLabel(kind: ChatMediaKind, caption?: string): string {
  const tag =
    kind === "image"
      ? "📷 Photo"
      : kind === "video"
      ? "🎬 Video"
      : kind === "audio"
      ? "🎵 Audio"
      : "📎 File";
  return caption ? `${tag}: ${caption}` : tag;
}

export function getHandoverSummaryLabel(shiftPeriod: string): string {
  return `📋 Shift Handover: ${shiftPeriod}`;
}
