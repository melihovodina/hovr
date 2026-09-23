import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";

// Tests run from client/.
const code = readFileSync(resolve("public/widget.js"), "utf8");
const ORIGIN = "https://hovr.test";

// Runs widget.js the way a browser would for <script src=".../widget.js" data-bot="...">.
function load(bot: string | null = "pub_k") {
  const script = document.createElement("script");
  script.src = `${ORIGIN}/widget.js`;
  if (bot) script.setAttribute("data-bot", bot);
  Object.defineProperty(document, "currentScript", { value: script, configurable: true });
  new Function(code)();
  return document.querySelector("iframe");
}

function send(frame: HTMLIFrameElement, data: unknown, origin = ORIGIN) {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: frame.contentWindow }));
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
});
afterEach(() => {
  document.body.innerHTML = "";
  delete (window as unknown as { __hovrWidget?: boolean }).__hovrWidget;
});

test("adds one hidden iframe pointing at the bot's chat", () => {
  const frame = load()!;
  expect(frame.src).toBe(`${ORIGIN}/widget?key=pub_k`);
  expect(frame.style.display).toBe("none");
  load();
  expect(document.querySelectorAll("iframe")).toHaveLength(1); // pasted twice, loaded once
});

test("does nothing without a bot key", () => {
  expect(load(null)).toBeNull();
});

test("shows the launcher on the bot's side once ready, and grows into the panel when opened", () => {
  const frame = load()!;
  send(frame, { type: "hovr:ready", position: "left" });
  expect(frame.style.display).toBe("block");
  expect(frame.style.width).toBe("92px");
  expect(frame.style.left).toBe("4px");
  expect(frame.style.right).toBe("auto");

  send(frame, { type: "hovr:open" });
  expect(frame.style.width).toBe("396px");
  expect(frame.style.height).toBe("700px");

  send(frame, { type: "hovr:close" });
  expect(frame.style.width).toBe("92px");
});

test("opens full screen on a phone", () => {
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  const frame = load()!;
  send(frame, { type: "hovr:ready", position: "right" });
  send(frame, { type: "hovr:open" });
  expect(frame.style.width).toBe("100%");
  expect(frame.style.height).toBe("100%");
});

test("ignores messages from anywhere but its own iframe", () => {
  const frame = load()!;
  send(frame, { type: "hovr:ready", position: "right" }, "https://evil.example");
  expect(frame.style.display).toBe("none");
});

test("hides itself when the bot isn't allowed on the site", () => {
  const frame = load()!;
  send(frame, { type: "hovr:ready", position: "right" });
  send(frame, { type: "hovr:hide" });
  expect(frame.style.display).toBe("none");
});
