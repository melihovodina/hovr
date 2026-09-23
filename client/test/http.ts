import { vi } from "vitest";

// A JSON response the way the Go API sends it.
export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// A server-sent events response delivered in the given pieces, to test reading across chunk borders.
export function sse(pieces: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of pieces) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

// Replaces fetch with a mock that answers with the given responses in order.
// Anything that isn't a Response is thrown, like a failed or aborted fetch.
export function mockFetch(...responses: unknown[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    if (r instanceof Response) fn.mockResolvedValueOnce(r);
    else fn.mockRejectedValueOnce(r);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}
