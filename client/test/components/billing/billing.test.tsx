import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { appState, billing } from "@/test/fixtures";
import { json, mockFetch } from "@/test/http";
import { nav } from "@/test/navigation";
import { AppContext, type AppState } from "@/components/app/app-context";
import { BillingScreen } from "@/components/billing/billing-screen";
import { CHOICES, planAction, PlanPicker } from "@/components/billing/plan-picker";
import { usageNote } from "@/components/billing/usage-card";
import type { Billing } from "@/lib/types";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

const pro = (over: Partial<Billing> = {}) =>
  billing({
    plan: "pro",
    planName: "Pro",
    limits: { bots: 3, messagesPerMonth: 2000, sources: 100, removeBadge: true, exportLeads: false, historyDays: 0 },
    hasSubscription: true,
    periodEnd: "2026-10-22T10:00:00Z",
    ...over,
  });

beforeEach(() => nav.reset());
afterEach(() => vi.unstubAllGlobals());

test("the plan list comes from the pricing table", () => {
  expect(CHOICES.map((c) => [c.value, c.price])).toEqual([
    ["free", "$0"],
    ["pro", "$19"],
    ["business", "$49"],
  ]);
  expect(CHOICES[0].desc).toBe("1 bot, 100 messages a month, 10 sources");
  expect(CHOICES[2].desc).toBe("10 bots, 10,000 messages a month, 500 sources, no hovr badge, lead export");
});

describe("usageNote", () => {
  const now = new Date("2026-09-23T12:00:00Z");

  test("says which limits are reached and when messages reset", () => {
    const b = billing({ usage: { messages: 100, bots: 1, sources: 10 } });
    expect(usageNote(b, now)).toBe(
      "You’ve used your only bot slot. You’ve used all 10 knowledge sources. You’ve used this month’s messages, so the bot can’t answer visitors until they reset. Messages reset on October 1.",
    );
  });

  test("mentions the billing period on a paid plan", () => {
    expect(usageNote(pro({ usage: { messages: 5, bots: 1, sources: 4 } }), now)).toBe("Messages reset on October 1. This billing period ends on October 22.");
  });
});

describe("planAction", () => {
  test("Free goes to Checkout for a paid plan, and does nothing for itself", () => {
    expect(planAction(billing(), "pro").action).toEqual({ kind: "checkout", plan: "pro" });
    expect(planAction(billing(), "business").title).toBe("Business, $49 a month");
    expect(planAction(billing(), "free").action).toEqual({ kind: "none" });
  });

  test("a running subscription changes or cancels in the portal, never a second Checkout", () => {
    for (const p of ["free", "pro", "business"] as const) expect(planAction(pro(), p).action).toEqual({ kind: "portal" });
    expect(planAction(pro(), "free").title).toBe("Back to Free");
  });
});

test("PlanPicker starts on the next plan up and sends it to Checkout", async () => {
  const fetch = mockFetch(json(200, { url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
  const user = userEvent.setup();
  render(<PlanPicker billing={billing()} />);

  expect(screen.getByRole("radio", { name: /Pro/ }).getAttribute("aria-checked")).toBe("true");
  await user.click(screen.getByRole("radio", { name: /Business/ }));
  await user.click(screen.getByRole("button", { name: "Continue to checkout" }));

  expect(fetch.mock.calls[0][0]).toBe("/api/billing/checkout");
  expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ plan: "business" });
});

test("PlanPicker shows why Stripe couldn't be opened", async () => {
  mockFetch(json(400, { error: "You don't have a subscription yet." }));
  const user = userEvent.setup();
  render(<PlanPicker billing={pro()} />);

  await user.click(screen.getByRole("button", { name: "Open billing portal" }));
  expect((await screen.findByRole("alert")).textContent).toBe("You don't have a subscription yet.");
});

function renderScreen(search: string, over: Partial<AppState> = {}) {
  nav.search = new URLSearchParams(search);
  return render(
    <AppContext.Provider value={appState(over)}>
      <BillingScreen />
    </AppContext.Provider>,
  );
}

describe("coming back from Checkout", () => {
  test("confirms the session once, reloads the plan and cleans the address", async () => {
    const fetch = mockFetch(json(200, { plan: "pro", planName: "Pro" }));
    const reload = vi.fn();
    renderScreen("bot=b1&checkout=cs_test_1", { reload });

    expect(screen.getByText("Confirming your payment…")).toBeTruthy();
    expect(await screen.findByText("You’re on Pro now. Thanks!")).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ sessionId: "cs_test_1" });
    expect(reload).toHaveBeenCalled();
    expect(nav.router.replace).toHaveBeenCalledWith("/app/billing?bot=b1", { scroll: false });
  });

  test("a payment that can't be confirmed says so", async () => {
    mockFetch(json(400, { error: "We couldn't confirm that payment. If you were charged, contact us." }));
    renderScreen("checkout=cs_test_bad");
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't confirm that payment/);
  });

  test("a cancelled checkout calls nothing", () => {
    const fetch = mockFetch();
    renderScreen("checkout=cancelled");
    expect(screen.getByText("Checkout cancelled. Nothing was charged.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
