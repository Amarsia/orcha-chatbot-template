import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { appConfig } from "@/config/app";

const UPLOADS_ROOT = path.resolve(process.cwd(), ".orcha", "uploads");
const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;

const EXT_TO_MIME: Record<string, string> = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const MIME_TO_EXT: Record<string, string> = {
  "application/json": ".json",
  "application/msword": ".doc",
  "application/pdf": ".pdf",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/csv": ".csv",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export type StoredUploadMeta = {
  id: string;
  visitorId: string;
  name: string;
  mimeType: string;
  fileName: string;
  size: number;
};

export class UploadError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function visitorDir(visitorId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(visitorId)) {
    throw new UploadError("Invalid visitor session.", 400);
  }
  return path.join(UPLOADS_ROOT, visitorId);
}

function resolveMimeType(file: File): { mimeType: string; ext: string } {
  const ext = path.extname(file.name || "").toLowerCase();
  const normalizedType = file.type.trim().toLowerCase().split(";")[0];

  if (ext && EXT_TO_MIME[ext]) {
    return { mimeType: EXT_TO_MIME[ext], ext };
  }
  if (normalizedType && MIME_TO_EXT[normalizedType]) {
    return { mimeType: normalizedType, ext: MIME_TO_EXT[normalizedType] };
  }
  throw new UploadError(
    `Unsupported file type "${file.name || normalizedType || "unknown"}". Supported formats: images, PDF, TXT, MD, CSV, JSON, DOC/DOCX, XLS/XLSX.`,
    400,
  );
}

function sanitizeFileName(name: string): string {
  const base = path.basename(name || "attachment").replace(/[\r\n\0]/g, "");
  return base.slice(0, 180) || "attachment";
}

export async function saveVisitorUpload(visitorId: string, file: File): Promise<StoredUploadMeta> {
  if (!appConfig.allowFileUploads) {
    throw new UploadError("File uploads are disabled.", 403);
  }
  const maxBytes = appConfig.maxFileSizeMb * 1024 * 1024;
  if (file.size <= 0) {
    throw new UploadError("Cannot upload an empty file.", 400);
  }
  if (file.size > maxBytes) {
    throw new UploadError(`"${sanitizeFileName(file.name)}" exceeds the ${appConfig.maxFileSizeMb} MB limit.`, 400);
  }

  const { mimeType, ext } = resolveMimeType(file);
  const id = randomUUID().replace(/-/g, "");
  const fileName = `${id}${ext}`;
  const dir = visitorDir(visitorId);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta: StoredUploadMeta = {
    id,
    visitorId,
    name: sanitizeFileName(file.name),
    mimeType,
    fileName,
    size: buffer.length,
  };

  await writeFile(path.join(dir, fileName), buffer);
  await writeFile(path.join(dir, `${id}.meta.json`), JSON.stringify(meta), "utf8");
  return meta;
}

export async function resolveVisitorUpload(
  visitorId: string,
  fileId: string,
): Promise<{ meta: StoredUploadMeta; filePath: string }> {
  if (!FILE_ID_PATTERN.test(fileId)) {
    throw new UploadError("Invalid attachment ID.", 400);
  }
  const dir = visitorDir(visitorId);
  const metaPath = path.join(dir, `${fileId}.meta.json`);

  let raw: string;
  try {
    raw = await readFile(metaPath, "utf8");
  } catch {
    throw new UploadError("Attachment not found.", 404);
  }

  const meta = JSON.parse(raw) as StoredUploadMeta;
  if (meta.visitorId !== visitorId) {
    throw new UploadError("Attachment not found.", 404);
  }

  const filePath = path.join(dir, path.basename(meta.fileName));
  try {
    await stat(filePath);
  } catch {
    throw new UploadError("Attachment file is missing.", 404);
  }

  return { meta, filePath };
}

export async function attachmentFromStoredFilePath(
  visitorId: string,
  storedFilePath: string,
  mimeType: string,
): Promise<{ name: string; mimeType: string; url?: string }> {
  const dir = visitorDir(visitorId);
  const resolved = path.resolve(storedFilePath);
  if (resolved.startsWith(dir + path.sep)) {
    const base = path.basename(resolved);
    const id = base.slice(0, base.length - path.extname(base).length);
    if (FILE_ID_PATTERN.test(id)) {
      try {
        const { meta } = await resolveVisitorUpload(visitorId, id);
        return {
          name: meta.name,
          mimeType: meta.mimeType,
          url: `/api/uploads/${encodeURIComponent(meta.id)}`,
        };
      } catch {
        // Fall through to basename fallback
      }
    }
  }
  return {
    name: path.basename(storedFilePath) || "Attachment",
    mimeType,
  };
}
