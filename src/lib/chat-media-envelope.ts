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

const PREFIX = "__SPARK_SECURE_MEDIA_V1__:";

export function encodeMediaMessage(envelope: SparkMediaEnvelope): string {
  return `${PREFIX}${JSON.stringify(envelope)}`;
}

export function decodeMediaMessage(
  rawText: string | undefined | null
): { text: string; media: SparkMediaEnvelope | null } {
  if (!rawText || typeof rawText !== "string") {
    return { text: "", media: null };
  }
  if (!rawText.startsWith(PREFIX)) {
    return { text: rawText, media: null };
  }
  try {
    const parsed = JSON.parse(rawText.slice(PREFIX.length)) as SparkMediaEnvelope;
    if (parsed && parsed.v === 1 && parsed.url && parsed.name) {
      return {
        text: parsed.caption || "",
        media: parsed,
      };
    }
  } catch {
    // Fall back to plain text if malformed
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
