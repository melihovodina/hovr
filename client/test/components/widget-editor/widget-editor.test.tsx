import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppContext } from "@/components/app/app-context";
import { appState, bot } from "@/test/fixtures";
import { json, mockFetch } from "@/test/http";
import { nav } from "@/test/navigation";
import { InstallTab } from "@/components/widget-editor/install-tab";
import { MessagesTab } from "@/components/widget-editor/messages-tab";
import { changes, type Draft } from "@/components/widget-editor/widget-screen";

vi.mock("next/navigation", async () => (await import("@/test/navigation")).navigationMock);

beforeEach(() => nav.reset());
afterEach(() => vi.unstubAllGlobals());

const draftOf = (over: Partial<Draft> = {}): Draft => {
  const b = bot();
  return { name: b.name, color: b.color, position: b.position, greeting: b.greeting, suggestedQuestions: b.suggestedQuestions, showBadge: b.showBadge, ...over };
};

describe("changes", () => {
  test("nothing changed means nothing to save", () => {
    expect(changes(bot(), draftOf())).toEqual({});
  });

  test("only the edited fields are sent", () => {
    expect(changes(bot(), draftOf({ color: "#1F4FD1", suggestedQuestions: ["Do you ship to Canada?"] }))).toEqual({
      color: "#1F4FD1",
      suggestedQuestions: ["Do you ship to Canada?"],
    });
  });

  test("spaces around the name or greeting alone aren't a change", () => {
    expect(changes(bot(), draftOf({ name: " Northwind Coffee ", greeting: "Ask me anything about us.  " }))).toEqual({});
  });
});

function Messages({ initial }: { initial: Draft }) {
  const [draft, setDraft] = useState(initial);
  return <MessagesTab draft={draft} onChange={(d) => setDraft((x) => ({ ...x, ...d }))} />;
}

describe("MessagesTab", () => {
  test("adds suggested questions with Enter and removes them", async () => {
    const user = userEvent.setup();
    render(<Messages initial={draftOf()} />);

    await user.type(screen.getByLabelText("Suggested questions"), "Do you ship to Canada?{Enter}");
    expect(screen.getByText("Do you ship to Canada?")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Remove “Do you ship to Canada?”" }));
    expect(screen.queryByText("Do you ship to Canada?")).toBeNull();
  });

  test("stops at five questions", () => {
    render(<Messages initial={draftOf({ suggestedQuestions: ["a", "b", "c", "d", "e"] })} />);
    const input = screen.getByLabelText("Suggested questions") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe("That’s the most you can add");
  });

  test("counts the hello message's characters", async () => {
    render(<Messages initial={draftOf({ greeting: "Hi" })} />);
    expect(screen.getByText("2 of 280 characters.")).toBeTruthy();
  });
});

function renderInstall(over = {}) {
  const updateBot = vi.fn();
  render(
    <AppContext.Provider value={appState({ bot: bot(over), updateBot })}>
      <InstallTab />
    </AppContext.Provider>,
  );
  return updateBot;
}

describe("InstallTab", () => {
  test("shows the bot's embed code and where it was last seen", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
    renderInstall({ publicKey: "pub_live1", lastSeenHost: "northwind.example", lastSeenAt: "2026-09-23T11:58:00Z" });
    vi.useRealTimers();

    expect(screen.getByText("pub_live1")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Working on northwind.example. Last seen 2 minutes ago.");
  });

  test("says when the widget hasn't been seen on a site", () => {
    renderInstall();
    expect(screen.getByRole("status").textContent).toBe("Not on a site yet. Paste the code, then open your site.");
  });

  test("switches the paste steps per site builder", async () => {
    renderInstall();
    await userEvent.click(screen.getByRole("radio", { name: "Wix" }));
    expect(screen.getByText("Settings → Custom code → Add custom code.")).toBeTruthy();
  });

  test("adds an allowed website and saves it right away", async () => {
    const saved = bot({ allowedDomains: ["shop.example.com"] });
    const fetch = mockFetch(json(200, saved));
    const updateBot = renderInstall();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Allowed websites"), "https://Shop.Example.com/help");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ allowedDomains: ["https://Shop.Example.com/help"] });
    expect(updateBot).toHaveBeenCalledWith(saved);
  });

  test("shows why a website was refused", async () => {
    mockFetch(json(400, { error: "\"not a domain\" doesn't look like a website address." }));
    renderInstall();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Allowed websites"), "not a domain");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("\"not a domain\" doesn't look like a website address.")).toBeTruthy();
  });
});
