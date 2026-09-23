import { api } from "./api";
import type { Bot } from "./types";

// Same limits as the server (internal/bots).
export const MAX_NAME = 80;
export const MAX_GREETING = 280;
export const MAX_QUESTIONS = 5;
export const MAX_QUESTION = 120;
export const MAX_DOMAINS = 20;
export const MAX_AVATAR_SIZE = 1 << 20;
export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";

// The widget settings the editor changes; any subset can be sent.
export type BotPatch = Partial<Pick<Bot, "name" | "allowedDomains" | "color" | "position" | "greeting" | "suggestedQuestions" | "showBadge">>;

export function updateBot(id: string, patch: BotPatch): Promise<Bot> {
  return api<Bot>(`/bots/${id}`, { method: "PATCH", body: patch });
}

export function uploadAvatar(id: string, file: File): Promise<Bot> {
  const body = new FormData();
  body.append("file", file);
  return api<Bot>(`/bots/${id}/avatar`, { method: "POST", body });
}

export function removeAvatar(id: string): Promise<Bot> {
  return api<Bot>(`/bots/${id}/avatar`, { method: "DELETE" });
}

// A readable reason the server would refuse the logo, or null. The server also checks the bytes.
export function checkAvatar(file: File): string | null {
  if (!AVATAR_ACCEPT.split(",").includes(file.type) || file.size > MAX_AVATAR_SIZE) {
    return "Use a PNG, JPG or WebP image up to 1 MB.";
  }
  return null;
}

// The line owners paste into their site.
export function embedCode(origin: string, publicKey: string): string {
  return `<script src="${origin}/widget.js" data-bot="${publicKey}" defer></script>`;
}
