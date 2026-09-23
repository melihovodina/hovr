"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { Notice } from "@/components/auth/fields";
import { errorMessage } from "@/lib/api";
import { AVATAR_ACCEPT, checkAvatar, uploadAvatar } from "@/lib/bots";
import { DEFAULT_BOT_MESSAGE } from "@/lib/chat-colors";
import { onColor } from "@/lib/format";
import { ColorChoice, Group, Segmented, type ColorOption } from "./controls";
import type { Draft } from "./widget-screen";

export const SWATCHES = [
  { hex: "#2F6B4F", name: "Forest" },
  { hex: "#1F4FD1", name: "Blue" },
  { hex: "#B4441F", name: "Rust" },
  { hex: "#7A3FC4", name: "Violet" },
  { hex: "#F2C94C", name: "Mustard" },
];

// White and black for the chat and the messages; "+" covers everything else.
const BACKGROUNDS: ColorOption[] = [
  { value: "#FFFFFF", label: "White" },
  { value: "#16161A", label: "Black" },
];

// Gray (the default) instead of white, which would vanish on the default white chat.
const BOT_MESSAGES: ColorOption[] = [{ value: DEFAULT_BOT_MESSAGE, label: "Gray" }, BACKGROUNDS[1]];

const ring = "shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--ink)]";

// `site` colours only the made-up website behind the preview; it isn't part of the widget.
export function LookTab({
  draft,
  onChange,
  site,
  onSite,
}: {
  draft: Draft;
  onChange: (d: Partial<Draft>) => void;
  site: string;
  onSite: (color: string) => void;
}) {
  const { bot, billing, href, updateBot } = useApp();
  const picker = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const canHideBadge = billing?.limits.removeBadge ?? false;
  const logo = draft.useLogo && bot.avatarUrl !== null;

  async function upload(file: File | undefined) {
    if (!file) return;
    const problem = checkAvatar(file);
    setAvatarError(problem ?? "");
    if (problem) return;
    setAvatarBusy(true);
    try {
      updateBot(await uploadAvatar(bot.id, file));
      onChange({ useLogo: true });
    } catch (err) {
      setAvatarError(errorMessage(err));
    }
    setAvatarBusy(false);
  }

  return (
    <>
      <Group label="Main color">
        <ColorChoice label="Main color" options={SWATCHES.map((s) => ({ value: s.hex, label: s.name }))} value={draft.color} onChange={(c) => c && onChange({ color: c })} />
      </Group>

      <Group label="Visitor’s messages">
        <ColorChoice
          label="Visitor’s messages"
          options={[{ value: null, label: "Same as the main color", swatch: draft.color }, ...BACKGROUNDS]}
          value={draft.visitorMessageColor}
          onChange={(visitorMessageColor) => onChange({ visitorMessageColor })}
        />
      </Group>

      <Group label="Bot’s messages">
        <ColorChoice
          label="Bot’s messages"
          options={BOT_MESSAGES}
          value={draft.botMessageColor}
          onChange={(c) => c && onChange({ botMessageColor: c })}
        />
      </Group>

      <Group label="Chat background">
        <ColorChoice
          label="Chat background"
          options={BACKGROUNDS}
          value={draft.chatBackground}
          onChange={(c) => c && onChange({ chatBackground: c })}
        />
      </Group>

      <Group label="Your site in the preview">
        <ColorChoice label="Your site in the preview" options={BACKGROUNDS} value={site} onChange={(c) => c && onSite(c)} />
      </Group>

      <Group label="Avatar">
        <input
          ref={picker}
          type="file"
          accept={AVATAR_ACCEPT}
          className="hidden"
          onChange={(e) => {
            upload(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          {/* Picking the letter only changes the draft; the logo stays until the changes are saved. */}
          <button
            type="button"
            disabled={avatarBusy}
            onClick={() => onChange({ useLogo: false })}
            aria-pressed={!logo}
            aria-label="Use the first letter"
            className={cn("flex size-12 items-center justify-center rounded-full text-lg font-extrabold transition-shadow", !logo && ring)}
            style={{ background: draft.color, color: onColor(draft.color) }}
          >
            {(draft.name || bot.name).charAt(0).toUpperCase()}
          </button>
          {bot.avatarUrl && (
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => onChange({ useLogo: true })}
              aria-pressed={logo}
              aria-label="Use your logo"
              className={cn("size-12 overflow-hidden rounded-full transition-shadow", logo && ring)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a remote logo in a static export */}
              <img src={bot.avatarUrl} alt="" className="size-full object-cover" />
            </button>
          )}
          <button
            type="button"
            disabled={avatarBusy}
            onClick={() => picker.current?.click()}
            className="flex h-12 items-center rounded-full bg-app px-4 text-[13px] font-bold hover:bg-surface-2 disabled:opacity-60"
          >
            {avatarBusy ? "Saving…" : bot.avatarUrl ? "Change logo" : "Upload logo"}
          </button>
        </div>
        {avatarError && <Notice tone="bad">{avatarError}</Notice>}
      </Group>

      <Group label="Where it sits">
        <Segmented
          label="Where it sits"
          value={draft.position}
          onChange={(position) => onChange({ position })}
          options={[
            { value: "left", label: "Bottom left" },
            { value: "right", label: "Bottom right" },
          ]}
        />
      </Group>

      {canHideBadge ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-[18px] bg-app px-4 py-3.5">
          <span className="grow text-sm font-extrabold">Show “Powered by hovr”</span>
          <input
            type="checkbox"
            checked={draft.showBadge}
            onChange={(e) => onChange({ showBadge: e.target.checked })}
            className="size-5 accent-(--ink)"
          />
        </label>
      ) : (
        <Link href={href("/app/billing")} className="flex items-center gap-3 rounded-[18px] bg-app px-4 py-3.5 hover:bg-surface-2">
          <Lock className="size-4.5 shrink-0 text-subtle" strokeWidth={2} aria-hidden="true" />
          <span className="grow text-sm font-extrabold">Hide “Powered by hovr”</span>
          <span className="flex h-7 items-center rounded-full bg-lime px-2.5 text-xs font-extrabold text-on-lime">Pro</span>
        </Link>
      )}
    </>
  );
}
