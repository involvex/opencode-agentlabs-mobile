import type { Attachment } from "../components/chat/ImageAttachments";

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_PICK = 5;

const EXTENSION_TO_MIME: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  log: "text/plain",
  pdf: "application/pdf",
  html: "text/html",
  htm: "text/html",
  xml: "text/xml",
  yaml: "text/yaml",
  yml: "text/yaml",
  js: "text/javascript",
  ts: "text/typescript",
  tsx: "text/typescript",
  jsx: "text/javascript",
  py: "text/x-python",
  rb: "text/x-ruby",
  go: "text/x-go",
  rs: "text/x-rust",
  java: "text/x-java",
  kt: "text/x-kotlin",
  swift: "text/x-swift",
  c: "text/x-c",
  h: "text/x-c",
  cpp: "text/x-c++",
  cs: "text/x-csharp",
  css: "text/css",
  sh: "text/x-shellscript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export function guessMimeFromFilename(
  filename?: string,
  fallback = "application/octet-stream",
): string {
  if (!filename) return fallback;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return fallback;
  return EXTENSION_TO_MIME[ext] ?? fallback;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa exists in the RN Hermes runtime via Expo polyfills; fall back to
  // manual encoding if not.
  if (typeof globalThis.btoa === "function") return globalThis.btoa(binary);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : NaN;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : NaN;
    const n1 = a >> 2;
    const n2 = ((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4);
    const n3 = Number.isNaN(b)
      ? 64
      : ((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6);
    const n4 = Number.isNaN(b) || Number.isNaN(c) ? 64 : c & 63;
    out += chars[n1] + chars[n2] + chars[n3] + chars[n4];
  }
  return out;
}

export interface PickDocumentsResult {
  attachments: Attachment[];
  skippedOversize: string[];
}

export async function pickDocuments(): Promise<PickDocumentsResult | null> {
  // Dynamic imports keep this module runnable under plain `node --test`
  // (pure-helper tests) where native Expo modules have no implementation.
  const DocumentPicker = await import("expo-document-picker");
  const { File } = await import("expo-file-system");
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: "*/*",
  });
  if (result.canceled || !result.assets?.length) return null;

  const attachments: Attachment[] = [];
  const skippedOversize: string[] = [];
  const assets = result.assets.slice(0, MAX_DOCUMENTS_PER_PICK);

  for (const asset of assets) {
    if (asset.size != null && asset.size > MAX_DOCUMENT_BYTES) {
      skippedOversize.push(asset.name);
      continue;
    }
    const filename = asset.name || asset.uri.split("/").pop() || "file";
    const mime = asset.mimeType || guessMimeFromFilename(filename);
    try {
      const file = new File(asset.uri);
      const buffer = await file.arrayBuffer();
      if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
        skippedOversize.push(filename);
        continue;
      }
      const base64 = arrayBufferToBase64(buffer);
      attachments.push({
        uri: asset.uri,
        mime,
        filename,
        base64,
        size: buffer.byteLength,
      });
    } catch (err) {
      console.error("[pickDocuments] failed to read file:", filename, err);
      skippedOversize.push(filename);
    }
  }

  return { attachments, skippedOversize };
}

export function isImageAttachment(att: Attachment): boolean {
  return att.mime.startsWith("image/");
}

export function formatFileSize(bytes?: number): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
