import { ApiError } from "./api";
import { streamEvents } from "./sse";
import type { Message } from "./types";

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
