import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { bot } from "@/test/fixtures";
import { json, mockFetch } from "@/test/http";
import { nav } from "@/test/navigation";
import { Onboarding } from "./onboarding";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

const me = () => json(200, { id: "u1", email: "anna@example.com", plan: "free" });
const bots = (...list: ReturnType<typeof bot>[]) => json(200, { bots: list });

beforeEach(() => nav.reset());
afterEach(() => vi.unstubAllGlobals());

test("an account that already has a bot goes to the app", async () => {
  mockFetch(me(), bots(bot()));
  render(<Onboarding />);
  await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/app"));
  expect(screen.queryByText("Let’s set up your first bot")).toBeNull();
});

test("creates the bot, sends its knowledge and opens it", async () => {
  const fetch = mockFetch(me(), bots(), json(201, bot({ id: "b9", name: "Harbor Books" })), json(201, { id: "s1" }));
  const user = userEvent.setup();
  render(<Onboarding />);

  await user.type(await screen.findByLabelText("What should we call it?"), "Harbor Books");
  await user.click(screen.getByRole("button", { name: /Paste some text/ }));
  await user.type(screen.getByPlaceholderText("Title, e.g. Opening hours"), "Opening hours");
  await user.type(screen.getByLabelText("Text"), "Open every day, 9 to 6.");
  await user.click(screen.getByRole("button", { name: /Create bot and start reading/ }));

  await waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/app?bot=b9"));
  expect(fetch.mock.calls[2][0]).toBe("/api/bots");
  expect(JSON.parse(fetch.mock.calls[2][1]?.body as string)).toEqual({ name: "Harbor Books" });
  expect(fetch.mock.calls[3][0]).toBe("/api/bots/b9/sources/text");
});

test("lists what didn't go in and lets the owner continue", async () => {
  mockFetch(
    me(),
    bots(),
    json(201, bot({ id: "b9" })),
    json(402, { error: "Your Free plan includes 10 knowledge sources.", code: "upgrade_required" }),
  );
  const user = userEvent.setup();
  const { container } = render(<Onboarding />);

  await user.type(await screen.findByLabelText("What should we call it?"), "Harbor Books");
  await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["# FAQ"], "faq.md"));
  await user.click(screen.getByRole("button", { name: /Create bot and start reading/ }));

  expect(await screen.findByText(/Your bot is ready, but one item didn’t go in/)).toBeTruthy();
  expect(screen.getByText("Your Free plan includes 10 knowledge sources.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Continue to your bot" }));
  expect(nav.router.replace).toHaveBeenCalledWith("/app?bot=b9");
});

test("a file the server would refuse blocks the form before any request", async () => {
  const fetch = mockFetch(me(), bots());
  const user = userEvent.setup({ applyAccept: false });
  const { container } = render(<Onboarding />);

  await user.type(await screen.findByLabelText("What should we call it?"), "Harbor Books");
  await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File(["x"], "logo.png"));
  await user.click(screen.getByRole("button", { name: /Create bot and start reading/ }));

  expect(await screen.findByText("Remove the files that can’t be added.")).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(2); // only the account loads
});

test("“Add a bot” past the plan's limit points to the plans", async () => {
  nav.search = new URLSearchParams("new=1");
  mockFetch(me(), bots(bot()), json(402, { error: "Your Free plan includes 1 bot. Upgrade to add more.", code: "upgrade_required" }));
  const user = userEvent.setup();
  render(<Onboarding />);

  expect(await screen.findByText("Set up another bot")).toBeTruthy();
  expect(nav.router.replace).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("What should we call it?"), "Second bot");
  await user.click(screen.getByRole("button", { name: /Create bot/ }));

  expect(await screen.findByText(/Your Free plan includes 1 bot/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/app/billing");
});
