import { afterEach, expect, test, vi } from "vitest";
import { json, mockFetch, sse } from "@/test/http";
import { ApiError } from "@/lib/api";
import { streamEvents } from "@/lib/sse";

afterEach(() => vi.unstubAllGlobals());

async function collect(pieces: string[]) {
  mockFetch(sse(pieces));
  const out = [];
  for await (const e of streamEvents("/bots/b1/chat", { method: "POST", body: { message: "hi" } })) out.push(e);
  return out;
}

test("reads events in order", async () => {
  const events = await collect(['event:conversation\ndata:{"id":"c1"}\n\n', 'event:text\ndata:{"text":"Hi"}\n\n']);
  expect(events).toEqual([
    { event: "conversation", data: '{"id":"c1"}' },
    { event: "text", data: '{"text":"Hi"}' },
  ]);
});

test("puts together events split across network chunks", async () => {
  const events = await collect(["event:te", 'xt\ndata:{"te', 'xt":"Hel', 'lo"}\n', "\nevent:done\ndata:{}\n\n"]);
  expect(events).toEqual([
    { event: "text", data: '{"text":"Hello"}' },
    { event: "done", data: "{}" },
  ]);
});

test("handles CRLF line ends, several data lines and a missing event name", async () => {
  const events = await collect(["data: first\r\ndata: second\r\n\r\n"]);
  expect(events).toEqual([{ event: "message", data: "first\nsecond" }]);
});

test("keeps a last event that has no blank line after it", async () => {
  const events = await collect(['event:done\ndata:{"ok":true}']);
  expect(events).toEqual([{ event: "done", data: '{"ok":true}' }]);
});

test("skips blocks without data", async () => {
  const events = await collect([": keep-alive\n\n", "event:text\ndata:x\n\n"]);
  expect(events).toEqual([{ event: "text", data: "x" }]);
});

test("a refusal before the stream rejects like a normal request", async () => {
  mockFetch(json(400, { error: "Messages can be 1 to 2000 characters." }));
  const it = streamEvents("/bots/b1/chat", { method: "POST", body: { message: "" } });
  await expect(it.next()).rejects.toBeInstanceOf(ApiError);
});
