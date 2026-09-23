import { expect, test } from "vitest";
import { botBubble, chatColors, chatPalette, visitorBubble } from "@/lib/chat-colors";

test("chatPalette picks light text on a dark background and dark text on a light one", () => {
  expect(chatPalette("#16161A")["--w-ink"]).toBe("#F3F2EE");
  expect(chatPalette("#FFFFFF")["--w-ink"]).toBe("#17171B");
  expect(chatPalette("#1F4FD1")["--w-bg"]).toBe("#1F4FD1");
  // Muted text and fills are mixed from the background, so they suit any colour.
  expect(chatPalette("#FFFFFF")["--w-soft"]).toBe("color-mix(in srgb, #000000 5%, #FFFFFF)");
});

test("visitor messages use their own colour or the main one, with readable text", () => {
  expect(visitorBubble("#2F6B4F", null)).toEqual({ background: "#2F6B4F", color: "#FFFFFF" });
  expect(visitorBubble("#2F6B4F", "#F2C94C")).toEqual({ background: "#F2C94C", color: "#0D0E11" });
});

test("bot messages use their own colour or a shade of the panel", () => {
  expect(botBubble(null)).toEqual({ background: "var(--w-soft)", color: "var(--w-ink)" });
  expect(botBubble("#16161A")).toEqual({ background: "#16161A", color: "#FFFFFF" });
});

test("chatColors fills in white for the chat and gray for the bot when nothing was picked", () => {
  expect(chatColors({ chatBackground: null, botMessageColor: null })).toEqual({ chatBackground: "#FFFFFF", botMessageColor: "#F0F0EE" });
  expect(chatColors({ chatBackground: "#16161A", botMessageColor: "#1F4FD1" })).toEqual({ chatBackground: "#16161A", botMessageColor: "#1F4FD1" });
});
