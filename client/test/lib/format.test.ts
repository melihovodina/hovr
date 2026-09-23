import { expect, test } from "vitest";
import { onColor, resetDate, shortDate, timeAgo } from "@/lib/format";

test("onColor picks readable text for a background", () => {
  expect(onColor("#C8F547")).toBe("#0D0E11"); // lime: dark text
  expect(onColor("#FFFFFF")).toBe("#0D0E11");
  expect(onColor("#2F6B4F")).toBe("#FFFFFF"); // forest: white text
  expect(onColor("#141417")).toBe("#FFFFFF");
  expect(onColor("c8f547")).toBe("#0D0E11"); // without the #
  expect(onColor("green")).toBe("#FFFFFF"); // not a hex colour: fall back to white
});

test("shortDate", () => {
  const now = new Date(2026, 8, 23, 15, 0, 0);
  expect(shortDate(new Date(2026, 8, 23, 14, 59, 30).toISOString(), now)).toBe("Just now");
  expect(shortDate(new Date(2026, 8, 23, 9, 0).toISOString(), now)).toBe("Today");
  expect(shortDate(new Date(2026, 8, 19, 9, 0).toISOString(), now)).toBe("Sep 19");
  expect(shortDate(new Date(2025, 11, 31, 9, 0).toISOString(), now)).toBe("Dec 31, 2025");
});

test("timeAgo", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms).toISOString(), now);
  expect(ago(20_000)).toBe("just now");
  expect(ago(60_000)).toBe("a minute ago");
  expect(ago(2 * 60_000)).toBe("2 minutes ago");
  expect(ago(60 * 60_000)).toBe("an hour ago");
  expect(ago(5 * 3_600_000)).toBe("5 hours ago");
  expect(ago(30 * 3_600_000)).toBe("yesterday");
  expect(ago(4 * 86_400_000)).toBe("4 days ago");
});

test("resetDate is the first of next month in UTC", () => {
  expect(resetDate("short", new Date("2026-09-23T12:00:00Z"))).toBe("Oct 1");
  expect(resetDate("long", new Date("2026-12-31T23:30:00Z"))).toBe("January 1");
});
