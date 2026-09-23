import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { billing, bot } from "@/test/fixtures";
import { json } from "@/test/http";
import { nav } from "@/test/navigation";
import { AppShell } from "@/components/app/shell";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

beforeEach(() => nav.reset());
afterEach(() => vi.unstubAllGlobals());

// Answers by path; `down` makes /me fail like an unreachable server.
function serve(state: { down: boolean }) {
  const fn = vi.fn(async (url: string) => {
    if (state.down) throw new TypeError("Failed to fetch");
    if (url === "/api/me") return json(200, { id: "u1", email: "anna@northwind.example", plan: "free" });
    if (url === "/api/bots") return json(200, { bots: [bot()] });
    if (url === "/api/billing") return json(200, billing());
    return json(200, { items: [], historyDays: 7 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

test("shows the outline while loading, then the screen", async () => {
  serve({ down: false });
  render(
    <AppShell>
      <p>Screen</p>
    </AppShell>,
  );
  expect(screen.getByLabelText("Loading").getAttribute("aria-busy")).toBe("true");
  expect(await screen.findByText("Screen")).toBeTruthy();
  expect(screen.queryByLabelText("Loading")).toBeNull();
});

test("an account that didn't load can be asked for again", async () => {
  const state = { down: true };
  serve(state);
  const user = userEvent.setup();
  render(
    <AppShell>
      <p>Screen</p>
    </AppShell>,
  );

  expect((await screen.findByRole("alert")).textContent).toContain("Can’t reach hovr right now.");
  state.down = false;
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Screen")).toBeTruthy();
});

test("a signed-out visitor goes to sign in", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json(401, { error: "Sign in first." })),
  );
  render(
    <AppShell>
      <p>Screen</p>
    </AppShell>,
  );
  await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/signin"));
});

test("a session whose account is gone goes to sign in too", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json(404, { error: "Account not found." })),
  );
  render(
    <AppShell>
      <p>Screen</p>
    </AppShell>,
  );
  await vi.waitFor(() => expect(nav.router.replace).toHaveBeenCalledWith("/signin"));
  expect(screen.queryByRole("alert")).toBeNull();
});
