import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { ChatMediaKind, getMediaKindFromMime } from "./chat-media-envelope";

export const MAX_CHAT_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
]);

export interface StoredMediaMetadata {
  mediaId: string;
  workspaceId: string;
  uploaderId: string;
  conversationType?: "channel" | "direct";
  conversationTargetId?: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: ChatMediaKind;
  ivHex: string;
  authTagHex: string;
  sha256: string;
  createdAt: string;
}

const STORAGE_ROOT = path.resolve(process.cwd(), ".spark_secure_media");

function getMasterKey(): Buffer {
  const seed =
    process.env.SPARK_MEDIA_ENCRYPTION_KEY ||
    `${process.env.NEXCONN_APP_SECRET || "spark"}:${process.env.DATABASE_URL || "local"}:spark-chat-media-v1`;
  return crypto.createHash("sha256").update(seed).digest();
}

export function signMediaAccess(mediaId: string, workspaceId: string): string {
  return crypto
    .createHmac("sha256", getMasterKey())
    .update(`${workspaceId}:${mediaId}`)
    .digest("hex");
}

export function verifyMediaSignature(
  mediaId: string,
  workspaceId: string,
  providedSig: string | null
): boolean {
  if (!providedSig || !/^[a-f0-9]{64}$/i.test(providedSig)) return false;
  const expected = signMediaAccess(mediaId, workspaceId);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(providedSig, "hex")
    );
  } catch {
    return false;
  }
}

export function isAllowedMimeType(mimeType: string): boolean {
  const lower = (mimeType || "").toLowerCase().trim();
  if (!lower) return true; // Fallback octet-stream allowed for generic files
  if (ALLOWED_MIME_PREFIXES.some((p) => lower.startsWith(p))) return true;
  return ALLOWED_EXACT_MIMES.has(lower);
}

export function sanitizeFileName(name: string): string {
  const cleaned = (name || "attachment")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .trim();
  return cleaned.slice(0, 120) || "attachment";
}

function isSafeId(val: string): boolean {
  return /^[a-zA-Z0-9_-]{8,80}$/.test(val);
}

/**
 * Encrypts raw file bytes with AES-256-GCM (unique random IV + auth tag)
 * and persists the ciphertext in workspace-isolated private storage.
 */
export async function storeEncryptedChatMedia(params: {
  workspaceId: string;
  uploaderId: string;
  conversationType?: "channel" | "direct";
  conversationTargetId?: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ meta: StoredMediaMetadata; signedUrl: string }> {
  if (!isSafeId(params.workspaceId)) {
    throw new Error("Invalid workspace identifier.");
  }

  const mediaId = crypto.randomUUID().replace(/-/g, "");
  const iv = crypto.randomBytes(12);
  const key = getMasterKey();

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(params.buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const sha256 = crypto.createHash("sha256").update(params.buffer).digest("hex");

  const safeName = sanitizeFileName(params.originalName);
  const mimeType = params.mimeType || "application/octet-stream";
  const kind = getMediaKindFromMime(mimeType);

  const meta: StoredMediaMetadata = {
    mediaId,
    workspaceId: params.workspaceId,
    uploaderId: params.uploaderId,
    conversationType: params.conversationType,
    conversationTargetId: params.conversationTargetId,
    originalName: safeName,
    mimeType,
    size: params.buffer.length,
    kind,
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
    sha256,
    createdAt: new Date().toISOString(),
  };

  const wsDir = path.join(STORAGE_ROOT, params.workspaceId);
  await fs.mkdir(wsDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.join(wsDir, `${mediaId}.enc`), encrypted),
    fs.writeFile(path.join(wsDir, `${mediaId}.meta.json`), JSON.stringify(meta)),
  ]);

  const sig = signMediaAccess(mediaId, params.workspaceId);
  const signedUrl = `/api/chat/media/${mediaId}?workspaceId=${encodeURIComponent(
    params.workspaceId
  )}&sig=${sig}`;

  return { meta, signedUrl };
}

/**
 * Verifies workspace ownership & decrypts AES-256-GCM encrypted media bytes.
 * Fails immediately if the file was tampered with (GCM auth tag verification).
 */
export async function readDecryptedChatMedia(
  workspaceId: string,
  mediaId: string
): Promise<{ meta: StoredMediaMetadata; buffer: Buffer } | null> {
  if (!isSafeId(workspaceId) || !isSafeId(mediaId)) {
    return null;
  }

  const wsDir = path.join(STORAGE_ROOT, workspaceId);
  const metaPath = path.join(wsDir, `${mediaId}.meta.json`);
  const encPath = path.join(wsDir, `${mediaId}.enc`);

  try {
    const [metaRaw, encrypted] = await Promise.all([
      fs.readFile(metaPath, "utf8"),
      fs.readFile(encPath),
    ]);

    const meta = JSON.parse(metaRaw) as StoredMediaMetadata;
    if (meta.workspaceId !== workspaceId || meta.mediaId !== mediaId) {
      return null;
    }

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getMasterKey(),
      Buffer.from(meta.ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(meta.authTagHex, "hex"));

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return { meta, buffer: decrypted };
  } catch {
    return null;
  }
}
