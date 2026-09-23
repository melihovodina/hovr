import { api, ApiError } from "./api";
import { streamEvents } from "./sse";
import type { Conversation, Message } from "./types";

export interface ChatHandlers {
  // The conversation id; send it back with follow-ups.
  onConversation?: (id: string) => void;
  onText?: (text: string) => void;
}

// Streams one answer (playground or widget endpoint) and resolves with the saved message.
// A stream "error" event rejects with an ApiError, like refusals before the stream.
export async function streamChat(
  path: string,
  body: Record<string, unknown>,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<Message> {
  for await (const { event, data } of streamEvents(path, { method: "POST", body, signal })) {
    const payload = JSON.parse(data);
    switch (event) {
      case "conversation":
        handlers.onConversation?.(payload.id);
        break;
      case "text":
        handlers.onText?.(payload.text);
        break;
      case "done":
        return payload.message as Message;
      case "error":
        throw new ApiError(500, payload.error);
    }
  }
  throw new ApiError(0, "The answer was cut off. Try again.");
}

export async function listConversations(botId: string, signal?: AbortSignal): Promise<Conversation[]> {
  const { conversations } = await api<{ conversations: Conversation[] }>(`/bots/${botId}/conversations`, { signal });
  return conversations;
}

export function getConversation(botId: string, id: string, signal?: AbortSignal) {
  return api<{ conversation: Conversation; messages: Message[] }>(`/bots/${botId}/conversations/${id}`, { signal });
}

export function deleteConversation(botId: string, id: string): Promise<void> {
  return api(`/bots/${botId}/conversations/${id}`, { method: "DELETE" });
}

// Answers mark what they used with [n] markers. Visitors can't open the owner's sources, so the
// widget drops them, including one still arriving at the end of a streamed answer ("[1", "[1,").
export function withoutCitations(text: string): string {
  return text.replace(/ ?\[\d+(?:\s*,\s*\d+)*\]/g, "").replace(/ ?\[[\d,\s]*$/, "");
}
