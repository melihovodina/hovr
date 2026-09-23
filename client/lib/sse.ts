import { request, type RequestOptions } from "./api";

export interface SSEEvent {
  event: string;
  data: string;
}

// Reads a POST that answers with server-sent events (EventSource can't POST).
// Refusals before the stream starts reject like any other request.
export async function* streamEvents(path: string, options: RequestOptions): AsyncGenerator<SSEEvent> {
  const res = await request(path, options);
  if (!res.body) return;
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r\n?/g, "\n");
      // Events end with a blank line; the last piece may still be incomplete.
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseBlock(block);
        if (parsed) yield parsed;
      }
    }
    const last = parseBlock(buffer);
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(block: string): SSEEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? { event, data: data.join("\n") } : null;
}
