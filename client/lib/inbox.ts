import { api } from "./api";
import type { InboxItem, Lead, Message, Source, Stats } from "./types";

// Inbox, leads and the Overview numbers (/api/bots/<bot>/...).

export type InboxStatus = "open" | "done";

// historyDays: how far back the plan shows (0 = forever).
export function listInbox(botId: string, status: InboxStatus, signal?: AbortSignal) {
  return api<{ items: InboxItem[]; historyDays: number }>(`/bots/${botId}/inbox?status=${status}`, { signal });
}

// The item with the last conversation it came from; messages are null when that chat was deleted.
export function getInboxItem(botId: string, id: string, signal?: AbortSignal) {
  return api<{ item: InboxItem; messages: Message[] | null }>(`/bots/${botId}/inbox/${id}`, { signal });
}

export function setInboxStatus(botId: string, id: string, status: InboxStatus): Promise<InboxItem> {
  return api<InboxItem>(`/bots/${botId}/inbox/${id}`, { method: "PATCH", body: { status } });
}

// Teach your bot: the answer becomes a knowledge source and the item is done.
export function teach(botId: string, id: string, answer: string) {
  return api<{ item: InboxItem; source: Source }>(`/bots/${botId}/inbox/${id}/answer`, { method: "POST", body: { answer } });
}

export function listLeads(botId: string, signal?: AbortSignal) {
  return api<{ leads: Lead[]; historyDays: number; canExport: boolean }>(`/bots/${botId}/leads`, { signal });
}

// A plain link: the session cookie comes along and the browser saves the file.
export function leadsCsvUrl(botId: string): string {
  return `/api/bots/${botId}/leads.csv`;
}

// Opens the owner's mail app with a reply to a visitor.
export function replyLink(email: string, botName: string, question?: string): string {
  const q = new URLSearchParams({ subject: `Your question to ${botName}` });
  if (question) q.set("body", `You asked: “${question}”\n\n`);
  // URLSearchParams writes spaces as "+", which mail apps show literally.
  return `mailto:${email}?${q.toString().replace(/\+/g, "%20")}`;
}

export function getStats(botId: string, days: number, signal?: AbortSignal): Promise<Stats> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return api<Stats>(`/bots/${botId}/stats?days=${days}&tz=${encodeURIComponent(tz)}`, { signal });
}
