import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { appState } from "@/test/fixtures";
import { json } from "@/test/http";
import { nav } from "@/test/navigation";
import { AppContext, type AppState } from "@/components/app/app-context";
import { InboxScreen } from "@/components/inbox/inbox-screen";
import type { InboxItem, Lead, Message } from "@/lib/types";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

function item(over: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "i1",
    question: "Can I pay with crypto?",
    timesAsked: 3,
    status: "open",
    lastConversationId: "c1",
    visitorEmail: "maria@example.com",
    answerSourceId: null,
    lastAskedAt: "2026-09-23T11:48:00Z",
    createdAt: "2026-09-22T10:00:00Z",
    ...over,
  };
}

const lead: Lead = {
  conversationId: "c9",
  email: "jon@acme.example",
  question: "Corporate gift boxes?",
  missed: true,
  createdAt: "2026-09-23T09:00:00Z",
  lastMessageAt: "2026-09-23T09:05:00Z",
};

const messages: Message[] = [
  { id: 1, role: "user", content: "hi, can I pay with crypto?", citations: [], answered: null, createdAt: "2026-09-23T11:48:00Z" },
  { id: 2, role: "assistant", content: "I’d rather not guess.", citations: [], answered: false, createdAt: "2026-09-23T11:48:02Z" },
];

interface Server {
  open: InboxItem[];
  done: InboxItem[];
  canExport: boolean;
  // Overrides for single requests, by "METHOD path".
  answers: Record<string, Response>;
}

let server: Server;

// Answers like the API, by path, so the order of parallel requests doesn't matter.
function serve() {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = url.replace("/api/bots/b1", "");
    const override = server.answers[`${method} ${path}`];
    if (override) return override;
    if (path === "/inbox?status=open") return json(200, { items: server.open, historyDays: 7 });
    if (path === "/inbox?status=done") return json(200, { items: server.done, historyDays: 7 });
    if (path === "/leads") return json(200, { leads: [lead], historyDays: 7, canExport: server.canExport });
    if (path.startsWith("/inbox/")) return json(200, { item: server.open[0], messages });
    if (path.startsWith("/conversations/")) return json(200, { conversation: {}, messages });
    return json(404, { error: "Not found." });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  nav.reset();
  nav.pathname = "/app/inbox";
  server = { open: [item(), item({ id: "i2", question: "Do you ship to Mars?", timesAsked: 1, visitorEmail: null })], done: [], canExport: false, answers: {} };
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderInbox(search: string, over: Partial<AppState> = {}) {
  nav.search = new URLSearchParams(search);
  return render(
    <AppContext.Provider value={appState(over)}>
      <InboxScreen />
    </AppContext.Provider>,
  );
}

test("lists open questions with counts on the tabs, and opens one by its id", async () => {
  serve();
  const user = userEvent.setup();
  renderInbox("bot=b1");

  expect(await screen.findByRole("tab", { name: "Needs an answer · 2" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Leads · 1" })).toBeTruthy();
  expect(screen.getByText("3 times · maria@example.com · 12 minutes ago")).toBeTruthy();
  expect(screen.getByText("Once · no email · 12 minutes ago")).toBeTruthy();
  expect(screen.getByText("Your plan shows the last 7 days.")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Do you ship to Mars/ }));
  expect(nav.router.replace).toHaveBeenCalledWith("/app/inbox?bot=b1&item=i2", { scroll: false });
});

test("shows the chat and teaches the bot, then moves on to the next question", async () => {
  const fetch = serve();
  const reload = vi.fn();
  const user = userEvent.setup();
  server.answers["POST /inbox/i1/answer"] = json(201, { item: item({ status: "done", answerSourceId: "s1" }), source: { id: "s1" } });
  renderInbox("bot=b1&item=i1", { reload });

  expect(await screen.findByText("hi, can I pay with crypto?")).toBeTruthy();
  expect(screen.getByText("It didn’t know")).toBeTruthy();
  expect(screen.getByText("Asked 3 times · latest chat 12 minutes ago")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Reply to maria@example.com" }).getAttribute("href")).toMatch(/^mailto:maria@example\.com\?subject=/);

  const save = screen.getByRole("button", { name: "Save to knowledge" });
  expect((save as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText("Teach your bot"), "  Not yet. We take cards and PayPal.  ");
  await user.click(save);

  expect(await screen.findByText(/Saved to your knowledge/)).toBeTruthy();
  const call = fetch.mock.calls.find(([url]) => url.endsWith("/answer"))!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ answer: "Not yet. We take cards and PayPal." });
  expect(nav.router.replace).toHaveBeenLastCalledWith("/app/inbox?bot=b1&item=i2", { scroll: false });
  expect(reload).toHaveBeenCalled();
});

test("a full plan keeps the question open and points to the plans", async () => {
  serve();
  const user = userEvent.setup();
  server.answers["POST /inbox/i1/answer"] = json(402, { error: "Your Free plan includes 10 knowledge sources.", code: "upgrade_required" });
  renderInbox("bot=b1&item=i1");

  await user.type(await screen.findByLabelText("Teach your bot"), "Yes.");
  await user.click(screen.getByRole("button", { name: "Save to knowledge" }));

  expect((await screen.findByRole("alert")).textContent).toContain("Your Free plan includes 10 knowledge sources.");
  expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/app/billing?bot=b1");
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test("a done question can go back to Needs an answer", async () => {
  const fetch = serve();
  const user = userEvent.setup();
  server.done = [item({ id: "d1", status: "done", answerSourceId: "s1" })];
  server.answers["PATCH /inbox/d1"] = json(200, item({ id: "d1", status: "open" }));
  renderInbox("bot=b1&tab=done&item=d1");

  expect(await screen.findByText(/Answered and added to your/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Move back to Needs an answer" }));

  expect(await screen.findByText("Moved back to Needs an answer.")).toBeTruthy();
  const call = fetch.mock.calls.find(([url, init]) => url.endsWith("/inbox/d1") && init?.method === "PATCH")!;
  expect(JSON.parse(call[1]!.body as string)).toEqual({ status: "open" });
});

test("leads offer a reply, and CSV only on Business", async () => {
  serve();
  const { unmount } = renderInbox("bot=b1&tab=leads&item=c9");

  expect(await screen.findByText(/The bot couldn’t answer something in this chat/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Reply to jon@acme.example" })).toBeTruthy();
  expect(screen.getByText(/Exporting leads to CSV comes with Business/)).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Export to CSV" })).toBeNull();
  unmount();

  server.canExport = true;
  renderInbox("bot=b1&tab=leads");
  expect((await screen.findByRole("link", { name: "Export to CSV" })).getAttribute("href")).toBe("/api/bots/b1/leads.csv");
});

test("an empty inbox says what shows up there", async () => {
  serve();
  server.open = [];
  renderInbox("bot=b1");
  expect(await screen.findByText(/Nothing to answer/)).toBeTruthy();
  expect(screen.getByText("All caught up.")).toBeTruthy();
});
