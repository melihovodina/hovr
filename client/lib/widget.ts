import { api } from "./api";
import { readLocal, writeLocal } from "./storage";
import type { Message, WidgetConfig } from "./types";

// The public widget API (/api/widget/<key>). `host` is the customer's page, which the server
// checks against the bot's allowed websites.

export function getConfig(key: string, host: string, signal?: AbortSignal): Promise<WidgetConfig> {
  return api<WidgetConfig>(`/widget/${key}/config?host=${encodeURIComponent(host)}`, { signal });
}

export async function restoreConversation(key: string, id: string, visitorId: string, host: string): Promise<Message[]> {
  const q = new URLSearchParams({ visitorId, host });
  const { messages } = await api<{ messages: Message[] }>(`/widget/${key}/conversations/${id}?${q}`);
  return messages;
}

export function leaveEmail(key: string, body: { conversationId: string; visitorId: string; email: string; host: string }): Promise<void> {
  return api(`/widget/${key}/lead`, { method: "POST", body });
}

export function chatPath(key: string): string {
  return `/widget/${key}/chat`;
}

// Messages between the iframe and widget.js on the customer's page.
export type WidgetEvent = { type: "hovr:ready"; position: "left" | "right" } | { type: "hovr:open" } | { type: "hovr:close" } | { type: "hovr:hide" };

// Kept in the iframe's own storage (per customer site), with a copy in memory for when storage is
// blocked or full; then it lasts one page view.
const memory = new Map<string, string>();

export function remember(key: string, value: string | null) {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  writeLocal(key, value);
}

export function recall(key: string): string | null {
  return readLocal(key) ?? memory.get(key) ?? null;
}

// The anonymous id that lets a visitor come back to their own conversation.
export function visitorId(): string {
  const saved = recall("hovr:visitor");
  if (saved) return saved;
  const id = crypto.randomUUID();
  remember("hovr:visitor", id);
  return id;
}
