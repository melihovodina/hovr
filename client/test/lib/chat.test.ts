import { afterEach, expect, test, vi } from "vitest";
import { mockFetch, sse } from "@/test/http";
import { ApiError } from "@/lib/api";
import { streamChat, withoutCitations } from "@/lib/chat";

afterEach(() => vi.unstubAllGlobals());

const saved = { id: 7, role: "assistant", content: "We ship to Canada [1].", citations: [], answered: true, createdAt: "2026-09-23T10:00:00Z" };

test("reports the conversation and the text, and resolves with the saved message", async () => {
  mockFetch(
    sse([
      'event:conversation\ndata:{"id":"c1"}\n\n',
      'event:text\ndata:{"text":"We ship "}\n\n',
      'event:text\ndata:{"text":"to Canada [1]."}\n\n',
      `event:done\ndata:${JSON.stringify({ message: saved })}\n\n`,
    ]),
  );
  const onConversation = vi.fn();
  const texts: string[] = [];

  const message = await streamChat("/bots/b1/chat", { message: "Canada?" }, { onConversation, onText: (t) => texts.push(t) });

  expect(onConversation).toHaveBeenCalledWith("c1");
  expect(texts.join("")).toBe("We ship to Canada [1].");
  expect(message).toEqual(saved);
});

test("an error event rejects with the server's message", async () => {
  mockFetch(sse(['event:conversation\ndata:{"id":"c1"}\n\n', 'event:error\ndata:{"error":"The bot couldn\'t answer right now."}\n\n']));
  const err = await streamChat("/bots/b1/chat", { message: "hi" }, {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toBe("The bot couldn't answer right now.");
});

test("a stream that ends without done rejects", async () => {
  mockFetch(sse(['event:text\ndata:{"text":"We ship"}\n\n']));
  const err = await streamChat("/bots/b1/chat", { message: "hi" }, {}).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toMatch(/cut off/);
});

test("withoutCitations drops [n] markers, also one still arriving", () => {
  expect(withoutCitations("We ship to Canada [1]. Orders arrive in 5 days [1, 2].")).toBe("We ship to Canada. Orders arrive in 5 days.");
  expect(withoutCitations("Yes, we do [1")).toBe("Yes, we do");
  expect(withoutCitations("Prices in [brackets] stay")).toBe("Prices in [brackets] stay");
});
