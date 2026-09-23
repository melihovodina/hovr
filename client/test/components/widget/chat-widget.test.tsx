import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ChatWidget } from "@/components/widget/chat-widget";
import { json, mockFetch, sse } from "@/test/http";
import { nav } from "@/test/navigation";
import { remember } from "@/lib/widget";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

const config = {
  name: "Northwind Coffee",
  color: "#2F6B4F",
  avatarUrl: null,
  position: "left",
  greeting: "Ask me about orders.",
  suggestedQuestions: ["Do you ship to Canada?"],
  showBadge: true,
};

// The widget runs in an iframe and talks to widget.js through its parent.
let posted: unknown[];

beforeEach(() => {
  nav.reset();
  nav.search = new URLSearchParams("key=pub_k");
  posted = [];
  vi.spyOn(window, "parent", "get").mockReturnValue({ postMessage: (m: unknown) => posted.push(m) } as unknown as Window);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  // remember() also keeps a copy in memory for the page's lifetime.
  for (const key of ["hovr:visitor", "hovr:conv:pub_k", "hovr:conv:k", "hovr:lead:c1"]) remember(key, null);
});

function answer(content: string, answered: boolean) {
  const message = { id: 2, role: "assistant", content, citations: answered ? [{ n: 1, sourceId: "s1", sourceTitle: "Shipping.md", score: 0.7, excerpt: "" }] : [], answered, createdAt: "" };
  return sse(['event:conversation\ndata:{"id":"c1"}\n\n', `event:text\ndata:${JSON.stringify({ text: content })}\n\n`, `event:done\ndata:${JSON.stringify({ message })}\n\n`]);
}

test("shows the launcher only once the settings are in, and tells the page where it sits", async () => {
  mockFetch(json(200, config));
  render(<ChatWidget />);
  expect(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" })).toBeTruthy();
  expect(posted).toEqual([{ type: "hovr:ready", position: "left" }]);
});

test("a site that isn't allowed hides the widget", async () => {
  mockFetch(json(403, { error: "This chat isn't set up for this website.", code: "domain_not_allowed" }));
  const { container } = render(<ChatWidget />);
  await waitFor(() => expect(posted).toEqual([{ type: "hovr:hide" }]));
  expect(container.innerHTML).toBe("");
});

test("opens, answers a suggested question without the owner's sources, and closes", async () => {
  const fetch = mockFetch(json(200, config), answer("We ship to Canada [1].", true));
  const user = userEvent.setup();
  render(<ChatWidget />);

  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));
  expect(posted).toContainEqual({ type: "hovr:open" });
  expect(screen.getByText("Ask me about orders.")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Do you ship to Canada\?/ }));
  // Visitors can't open the owner's files, so neither the source nor its [1] marker shows.
  expect(await screen.findByText("We ship to Canada.")).toBeTruthy();
  expect(screen.queryByText("Shipping.md")).toBeNull();
  const body = JSON.parse(fetch.mock.calls[1][1]?.body as string);
  expect(body.message).toBe("Do you ship to Canada?");
  expect(body.visitorId).toBeTruthy();
  expect(localStorage.getItem("hovr:conv:pub_k")).toBe("c1");
  expect(screen.queryByText(/Leave your email/)).toBeNull();

  await user.click(screen.getByRole("button", { name: "Close chat" }));
  // The panel shrinks away before the iframe is told to close.
  await vi.waitFor(() => expect(posted).toContainEqual({ type: "hovr:close" }));
});

test("after an answer it didn't know, the visitor can leave an email once", async () => {
  const fetch = mockFetch(json(200, config), answer("I don't know that one.", false), new Response(null, { status: 204 }));
  const user = userEvent.setup();
  render(<ChatWidget />);

  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));
  await user.type(screen.getByLabelText("Your question"), "Do you sell tea?{Enter}");
  await user.type(await screen.findByLabelText(/Leave your email/), "maria@example.com");
  await user.click(screen.getByRole("button", { name: "Send email" }));

  expect(await screen.findByText("Thanks! The team will get back to you by email.")).toBeTruthy();
  expect(fetch.mock.calls[2][0]).toBe("/api/widget/pub_k/lead");
  expect(localStorage.getItem("hovr:lead:c1")).toBe("1");
});

test("a plan limit doesn't leak the owner's message to visitors", async () => {
  mockFetch(json(200, config), json(402, { error: "You've used all 100 messages of the Free plan this month.", code: "upgrade_required" }));
  const user = userEvent.setup();
  render(<ChatWidget />);

  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));
  await user.type(screen.getByLabelText("Your question"), "Hi{Enter}");
  expect(await screen.findByText("This chat can’t take new questions right now. Please try again later.")).toBeTruthy();
  expect(screen.queryByText(/100 messages/)).toBeNull();
});

test("brings back the visitor's conversation after a reload", async () => {
  localStorage.setItem("hovr:conv:pub_k", "c7");
  mockFetch(json(200, config), json(200, { messages: [{ id: 1, role: "user", content: "Earlier question", citations: [], answered: null, createdAt: "" }] }));
  const user = userEvent.setup();
  render(<ChatWidget />);

  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));
  expect(await screen.findByText("Earlier question")).toBeTruthy();
});

test("an answer still being written ends in a blinking caret", async () => {
  // A stream that sends its first words and then stays open.
  const encoder = new TextEncoder();
  const open = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('event:conversation\ndata:{"id":"c1"}\n\nevent:text\ndata:{"text":"Yes, we"}\n\n'));
    },
  });
  mockFetch(json(200, config), new Response(open, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
  const user = userEvent.setup();
  const { container } = render(<ChatWidget />);

  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));
  await user.click(screen.getByRole("button", { name: "Do you ship to Canada?" }));

  expect(await screen.findByText("Yes, we")).toBeTruthy();
  expect(container.querySelector(".animate-caret")).not.toBeNull();
});

test("the email offer stays under the answer the bot didn't know, not at the end", async () => {
  remember("hovr:conv:pub_k", "c1");
  const msg = (id: number, role: string, content: string, answered: boolean | null) => ({ id, role, content, citations: [], answered, createdAt: "" });
  mockFetch(
    json(200, config),
    json(200, {
      messages: [
        msg(1, "user", "Do you ship to Canada?", null),
        msg(2, "assistant", "I don't know that one.", false),
        msg(3, "user", "Do you ship to Canada?", null),
        msg(4, "assistant", "Yes, we ship to Canada.", true),
      ],
    }),
  );
  const user = userEvent.setup();
  render(<ChatWidget />);
  await user.click(await screen.findByRole("button", { name: "Open chat with Northwind Coffee" }));

  const form = await screen.findByLabelText(/Leave your email/);
  const missed = screen.getByText("I don't know that one.");
  const later = screen.getByText("Yes, we ship to Canada.");
  // DOCUMENT_POSITION_FOLLOWING: the form comes after the missed answer and before the later one.
  expect(missed.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(form.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
