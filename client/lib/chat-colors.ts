import type { CSSProperties } from "react";
import { onColor } from "./format";

// The widget's colours from the owner's choices. Text, muted text, borders and the soft fills
// (suggestions) are worked out from the background, so any colour stays readable.

export const DEFAULT_CHAT_BACKGROUND = "#FFFFFF";
export const DEFAULT_BOT_MESSAGE = "#F0F0EE";

// The chat's saved colours with the defaults filled in; older bots have null for "not picked".
export function chatColors(bot: { chatBackground: string | null; botMessageColor: string | null }) {
  return {
    chatBackground: bot.chatBackground ?? DEFAULT_CHAT_BACKGROUND,
    botMessageColor: bot.botMessageColor ?? DEFAULT_BOT_MESSAGE,
  };
}

type Vars = CSSProperties & Record<`--w-${string}`, string>;

// The --w-* variables the widget's parts read, for a panel on `background`.
export function chatPalette(background: string): Vars {
  const dark = onColor(background) === "#FFFFFF";
  const ink = dark ? "#F3F2EE" : "#17171B";
  const shade = dark ? "#FFFFFF" : "#000000";
  return {
    "--w-bg": background,
    "--w-ink": ink,
    "--w-muted": `color-mix(in srgb, ${ink} 62%, ${background})`,
    "--w-soft": `color-mix(in srgb, ${shade} ${dark ? 10 : 5}%, ${background})`,
    "--w-border": `color-mix(in srgb, ${shade} ${dark ? 16 : 10}%, ${background})`,
    "--w-ring": dark ? "rgba(255,255,255,0.08)" : "rgba(10,12,16,0.08)",
    "--w-shadow": dark ? "rgba(0,0,0,0.5)" : "rgba(10,12,16,0.16)",
  };
}

// Background and text of a visitor's message: their own colour, or the bot's main colour.
export function visitorBubble(color: string, visitorMessageColor: string | null): CSSProperties {
  const bg = visitorMessageColor ?? color;
  return { background: bg, color: onColor(bg) };
}

// Background and text of the bot's message; without a colour (the landing's demos) a shade of the panel.
export function botBubble(botMessageColor: string | null): CSSProperties {
  return botMessageColor ? { background: botMessageColor, color: onColor(botMessageColor) } : { background: "var(--w-soft)", color: "var(--w-ink)" };
}
