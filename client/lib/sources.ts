import { api } from "./api";
import type { Source, SourceStatus } from "./types";

// Same rules as the server (internal/sources): by extension, up to 10 MB.
export const FILE_EXTENSIONS = [".pdf", ".docx", ".md", ".markdown", ".txt"];
export const MAX_FILE_SIZE = 10 << 20;
export const MAX_TITLE = 120;
export const MAX_TEXT = 200_000;

export const FILE_ACCEPT = FILE_EXTENSIONS.join(",");

// A readable reason the server would refuse the file, or null.
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) return "Only PDF, Word (.docx), Markdown or text files.";
  if (file.size > MAX_FILE_SIZE) return "Files can be up to 10 MB.";
  return null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uploadFile(botId: string, file: File): Promise<Source> {
  const body = new FormData();
  body.append("file", file);
  return api<Source>(`/bots/${botId}/sources/file`, { method: "POST", body });
}

export function addText(botId: string, title: string, text: string): Promise<Source> {
  return api<Source>(`/bots/${botId}/sources/text`, { method: "POST", body: { title, text } });
}

export async function listSources(botId: string, signal?: AbortSignal): Promise<Source[]> {
  const { sources } = await api<{ sources: Source[] }>(`/bots/${botId}/sources`, { signal });
  return sources;
}

// Still being read: the list is worth polling.
export function isPending(status: SourceStatus): boolean {
  return status === "queued" || status === "processing";
}
