import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { appState, billing, bot } from "@/test/fixtures";
import { nav } from "@/test/navigation";
import { AppContext, type AppState } from "./app-context";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

beforeEach(() => {
  nav.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

function renderSidebar(over: Partial<AppState> = {}) {
  return render(
    <AppContext.Provider value={appState(over)}>
      <Sidebar />
    </AppContext.Provider>,
  );
}

test("nav links keep the selected bot and mark the current screen", () => {
  nav.pathname = "/app/knowledge";
  renderSidebar();

  const knowledge = screen.getByRole("link", { name: "Knowledge" });
  expect(knowledge.getAttribute("href")).toBe("/app/knowledge?bot=b1");
  expect(knowledge.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Overview" }).getAttribute("aria-current")).toBeNull();
});

test("the inbox shows how many questions are open, and nothing when there are none", () => {
  const { unmount } = renderSidebar({ inboxOpen: 4 });
  expect(screen.getByRole("link", { name: "Inbox, 4 open" })).toBeTruthy();
  unmount();

  renderSidebar({ inboxOpen: 0 });
  expect(screen.getByRole("link", { name: "Inbox" })).toBeTruthy();
});

test("the plan card shows this month's messages, the reset date and the next plan", () => {
  renderSidebar();
  expect(screen.getByRole("link", { name: "Free plan: 62 of 100 messages used this month. Open billing" })).toBeTruthy();
  expect(screen.getByText("Free plan")).toBeTruthy();
  expect(screen.getByText("62 of 100")).toBeTruthy();
  expect(screen.getByText("Messages reset on Oct 1. Pro gives you 2,000.")).toBeTruthy();
});

test("on Business there is no bigger plan to mention", () => {
  renderSidebar({
    billing: billing({
      plan: "business",
      planName: "Business",
      limits: { bots: 10, messagesPerMonth: 10000, sources: 500, removeBadge: true, exportLeads: true, historyDays: 0 },
      usage: { messages: 1234, bots: 2, sources: 40 },
    }),
  });
  expect(screen.getByText("1,234 of 10,000")).toBeTruthy();
  expect(screen.getByText(/^Messages reset on Oct 1\.\s*$/)).toBeTruthy();
});

test("the bot switcher shows the selected bot", () => {
  renderSidebar({ bot: bot({ name: "Harbor Books" }) });
  expect(screen.getByRole("button", { name: "Harbor Books" })).toBeTruthy();
});
