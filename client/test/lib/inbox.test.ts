import { afterEach, expect, test, vi } from "vitest";
import { json, mockFetch } from "@/test/http";
import { getStats, leadsCsvUrl, replyLink, setInboxStatus, teach } from "@/lib/inbox";

afterEach(() => vi.unstubAllGlobals());

test("replyLink writes spaces as %20 so mail apps don't show plus signs", () => {
  const link = replyLink("maria@example.com", "Northwind Coffee", "Can I pay with crypto? 1+1");
  expect(link.startsWith("mailto:maria@example.com?")).toBe(true);
  expect(link).not.toContain("+");
  const q = new URLSearchParams(link.split("?")[1]);
  expect(q.get("subject")).toBe("Your question to Northwind Coffee");
  expect(q.get("body")).toBe("You asked: “Can I pay with crypto? 1+1”\n\n");
});

test("replyLink leaves the body out without a question", () => {
  expect(replyLink("a@b.example", "Bot")).toBe("mailto:a@b.example?subject=Your%20question%20to%20Bot");
});

test("getStats asks for the period in the browser's timezone", async () => {
  const fetch = mockFetch(json(200, { days: 30 }));
  await getStats("b1", 30);
  const url = new URL(fetch.mock.calls[0][0] as string, "http://x");
  expect(url.pathname).toBe("/api/bots/b1/stats");
  expect(url.searchParams.get("days")).toBe("30");
  expect(url.searchParams.get("tz")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
});

test("teach and setInboxStatus send the answer and the status", async () => {
  const fetch = mockFetch(json(201, { item: { id: "i1" }, source: { id: "s1" } }), json(200, { id: "i1", status: "open" }));

  await teach("b1", "i1", "Yes, we do.");
  await setInboxStatus("b1", "i1", "open");

  expect(fetch.mock.calls[0][0]).toBe("/api/bots/b1/inbox/i1/answer");
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ answer: "Yes, we do." }) });
  expect(fetch.mock.calls[1][0]).toBe("/api/bots/b1/inbox/i1");
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ status: "open" }) });
});

test("the CSV is a plain same-origin link", () => {
  expect(leadsCsvUrl("b1")).toBe("/api/bots/b1/leads.csv");
});
