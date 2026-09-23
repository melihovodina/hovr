import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { billing, source } from "@/test/fixtures";
import { Chart, dayLabel } from "@/components/overview/chart";
import { change, Metrics } from "@/components/overview/metrics";
import { todos } from "@/components/overview/side-cards";
import type { Stats, Totals } from "@/lib/types";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

const ZERO: Totals = { questions: 0, answered: 0, missed: 0, answeredRate: null, conversations: 0, leads: 0 };

function stats(over: Partial<Stats> = {}): Stats {
  return {
    days: 7,
    timezone: "UTC",
    current: ZERO,
    previous: ZERO,
    daily: ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23"].map((date) => ({ date, answered: 0, missed: 0 })),
    topQuestions: [],
    openQuestions: 0,
    needsYou: [],
    ...over,
  };
}

const href = (path: string) => `${path}?bot=b1`;

test("change compares with the previous period", () => {
  expect(change(118, 100, 7)).toEqual({ text: "+18% on last week", up: true });
  expect(change(80, 100, 7)).toEqual({ text: "−20% on last week", up: false });
  expect(change(100, 100, 7)).toEqual({ text: "Same as last week", up: false });
  expect(change(5, 0, 30)).toEqual({ text: "None the 30 days before", up: true });
  expect(change(0, 0, 7)).toEqual({ text: "None last week either", up: false });
});

test("dayLabel names weekdays for a week and every fifth date for longer periods", () => {
  expect(dayLabel("2026-09-23", 0, 7)).toBe("Wed");
  expect(dayLabel("2026-09-01", 0, 30)).toBe("1");
  expect(dayLabel("2026-09-02", 1, 30)).toBe("");
  expect(dayLabel("2026-09-30", 29, 30)).toBe("30");
});

test("Metrics shows the answered rate out of what was asked, or a dash before anything was", () => {
  const { unmount } = render(
    <Metrics stats={stats({ current: { ...ZERO, questions: 412, answered: 375, missed: 37, answeredRate: 375 / 412, leads: 19 } })} />,
  );
  expect(screen.getByText("91%")).toBeTruthy();
  expect(screen.getByText("375 of 412")).toBeTruthy();
  expect(screen.getByText("19")).toBeTruthy();
  unmount();

  render(<Metrics stats={stats()} />);
  expect(screen.getByText("—")).toBeTruthy();
  expect(screen.getByText("Nothing to answer yet")).toBeTruthy();
});

test("Chart describes every day and says so when nothing was asked", () => {
  const { unmount } = render(<Chart stats={stats()} />);
  expect(screen.getByText("No questions from visitors this week yet.")).toBeTruthy();
  unmount();

  const s = stats();
  s.daily[6] = { date: "2026-09-23", answered: 3, missed: 1 };
  render(<Chart stats={s} />);
  expect(screen.queryByText(/No questions/)).toBeNull();
  expect(screen.getByLabelText("Wednesday, Sep 23: 3 answered, 1 missed")).toBeTruthy();
});

test("todos lists open questions, the rest of the inbox, failed imports and a nearly used plan", () => {
  const s = stats({
    openQuestions: 3,
    needsYou: [
      { id: "i1", question: "Can I pay with crypto?", timesAsked: 3, lastAskedAt: "2026-09-23T10:00:00Z" },
      { id: "i2", question: "Do you ship to Mars?", timesAsked: 1, lastAskedAt: "2026-09-23T10:00:00Z" },
    ],
  });
  const list = todos(s, [source(), source({ id: "s2", title: "Menu-scan.pdf", status: "failed" })], billing({ usage: { messages: 85, bots: 1, sources: 2 } }), href);

  expect(list.map((t) => [t.text, t.href])).toEqual([
    ["“Can I pay with crypto?”", "/app/inbox?bot=b1&item=i1"],
    ["“Do you ship to Mars?”", "/app/inbox?bot=b1&item=i2"],
    ["1 more question in the Inbox", "/app/inbox?bot=b1"],
    ["Menu-scan.pdf didn’t import", "/app/knowledge?bot=b1"],
    ["85 of 100 messages used this month", "/app/billing?bot=b1"],
  ]);
  expect(list[0].meta).toBe("Asked 3 times, it couldn’t answer");
  expect(todos(stats(), [source()], billing(), href)).toEqual([]);
});
