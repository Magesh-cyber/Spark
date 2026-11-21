import "server-only";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "@/lib/prisma";
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

let tableInitPromise: Promise<void> | null = null;
async function ensureMediaTable(): Promise<void> {
  if (!tableInitPromise) {
    tableInitPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "chat_encrypted_media" (
            "id" TEXT PRIMARY KEY,
            "workspace_id" UUID NOT NULL,
            "uploader_id" UUID NOT NULL,
            "conversation_type" TEXT,
            "conversation_target_id" TEXT,
            "original_name" TEXT NOT NULL,
            "mime_type" TEXT NOT NULL,
            "size" INTEGER NOT NULL,
            "kind" TEXT NOT NULL,
            "iv_hex" TEXT NOT NULL,
            "auth_tag_hex" TEXT NOT NULL,
            "sha256" TEXT NOT NULL,
            "encrypted_data" TEXT NOT NULL,
            "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS "idx_chat_encrypted_media_ws" ON "chat_encrypted_media" ("workspace_id");
        `);
      } catch (err) {
        console.warn("[Media DB init]:", err);
      }
    })();
  }
  return tableInitPromise;
}

/**
 * Encrypts raw file bytes with AES-256-GCM (unique random IV + auth tag)
 * and persists the ciphertext in PostgreSQL database (with multi-tenant isolation)
 * and optional local cache.
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

  // 1. Persist ciphertext in PostgreSQL (Persistent across Vercel serverless lambdas & cold starts)
  await ensureMediaTable();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "chat_encrypted_media" (
      "id", "workspace_id", "uploader_id", "conversation_type", "conversation_target_id",
      "original_name", "mime_type", "size", "kind", "iv_hex", "auth_tag_hex", "sha256", "encrypted_data"
    ) VALUES (
      $1, $2::uuid, $3::uuid, $4, $5,
      $6, $7, $8, $9, $10, $11, $12, $13
    )
    ON CONFLICT ("id") DO UPDATE SET
      "encrypted_data" = EXCLUDED."encrypted_data",
      "iv_hex" = EXCLUDED."iv_hex",
      "auth_tag_hex" = EXCLUDED."auth_tag_hex"`,
    mediaId,
    params.workspaceId,
    params.uploaderId,
    params.conversationType || null,
    params.conversationTargetId || null,
    safeName,
    mimeType,
    params.buffer.length,
    kind,
    iv.toString("hex"),
    authTag.toString("hex"),
    sha256,
    encrypted.toString("base64")
  );

  // 2. Optional disk cache (safe against EROFS on serverless platforms)
  try {
    const baseDir = process.env.VERCEL
      ? path.join(os.tmpdir(), ".spark_secure_media")
      : STORAGE_ROOT;
    const wsDir = path.join(baseDir, params.workspaceId);
    await fs.mkdir(wsDir, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(wsDir, `${mediaId}.enc`), encrypted),
      fs.writeFile(path.join(wsDir, `${mediaId}.meta.json`), JSON.stringify(meta)),
    ]);
  } catch {
    // Non-fatal, PostgreSQL is the persistent storage authority
  }

  const sig = signMediaAccess(mediaId, params.workspaceId);
  const signedUrl = `/api/chat/media/${mediaId}?workspaceId=${encodeURIComponent(
    params.workspaceId
  )}&sig=${sig}`;

  return { meta, signedUrl };
}

/**
 * Verifies workspace ownership & decrypts AES-256-GCM encrypted media bytes.
 * Reads from PostgreSQL database primary storage, falling back to disk cache if available.
 * Fails immediately if the file was tampered with (GCM auth tag verification).
 */
export async function readDecryptedChatMedia(
  workspaceId: string,
  mediaId: string
): Promise<{ meta: StoredMediaMetadata; buffer: Buffer } | null> {
  if (!isSafeId(workspaceId) || !isSafeId(mediaId)) {
    return null;
  }

  // 1. Try reading from PostgreSQL primary storage
  try {
    await ensureMediaTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "workspace_id", "uploader_id", "conversation_type", "conversation_target_id",
              "original_name", "mime_type", "size", "kind", "iv_hex", "auth_tag_hex", "sha256",
              "encrypted_data", "created_at"
       FROM "chat_encrypted_media"
       WHERE "id" = $1 AND "workspace_id" = $2::uuid
       LIMIT 1`,
      mediaId,
      workspaceId
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const meta: StoredMediaMetadata = {
        mediaId: String(row.id),
        workspaceId: String(row.workspace_id || row.workspaceId),
        uploaderId: String(row.uploader_id || row.uploaderId),
        conversationType: row.conversation_type || row.conversationType || undefined,
        conversationTargetId: row.conversation_target_id || row.conversationTargetId || undefined,
        originalName: String(row.original_name || row.originalName || "attachment"),
        mimeType: String(row.mime_type || row.mimeType || "application/octet-stream"),
        size: Number(row.size) || 0,
        kind: (row.kind || getMediaKindFromMime(row.mime_type || "")) as ChatMediaKind,
        ivHex: String(row.iv_hex || row.ivHex),
        authTagHex: String(row.auth_tag_hex || row.authTagHex),
        sha256: String(row.sha256 || ""),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };

      const encrypted = Buffer.from(String(row.encrypted_data || row.encryptedData), "base64");
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        getMasterKey(),
        Buffer.from(meta.ivHex, "hex")
      );
      decipher.setAuthTag(Buffer.from(meta.authTagHex, "hex"));

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return { meta, buffer: decrypted };
    }
  } catch (dbErr) {
    console.warn("[Media DB read failed, falling back to disk cache]:", dbErr);
  }

  // 2. Fallback to disk cache if available
  const candidates = [
    path.join(STORAGE_ROOT, workspaceId),
    path.join(os.tmpdir(), ".spark_secure_media", workspaceId),
  ];

  for (const wsDir of candidates) {
    const metaPath = path.join(wsDir, `${mediaId}.meta.json`);
    const encPath = path.join(wsDir, `${mediaId}.enc`);

    try {
      const [metaRaw, encrypted] = await Promise.all([
        fs.readFile(metaPath, "utf8"),
        fs.readFile(encPath),
      ]);

      const meta = JSON.parse(metaRaw) as StoredMediaMetadata;
      if (meta.workspaceId !== workspaceId || meta.mediaId !== mediaId) {
        continue;
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
      // Continue checking next candidate
    }
  }

  return null;
}
