"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { Notice } from "@/components/auth/fields";
import { errorMessage } from "@/lib/api";
import { AVATAR_ACCEPT, checkAvatar, removeAvatar, uploadAvatar } from "@/lib/bots";
import { onColor } from "@/lib/format";
import { Group, Segmented } from "./controls";
import type { Draft } from "./widget-screen";

export const SWATCHES = [
  { hex: "#2F6B4F", name: "Forest" },
  { hex: "#1F4FD1", name: "Blue" },
  { hex: "#B4441F", name: "Rust" },
  { hex: "#7A3FC4", name: "Violet" },
  { hex: "#F2C94C", name: "Mustard" },
  { hex: "#16161A", name: "Ink" },
];

const ring = "shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--ink)]";

export function LookTab({ draft, onChange }: { draft: Draft; onChange: (d: Partial<Draft>) => void }) {
  const { bot, billing, href, updateBot } = useApp();
  const picker = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const canHideBadge = billing?.limits.removeBadge ?? false;
  const custom = !SWATCHES.some((s) => s.hex === draft.color);

  async function upload(file: File | undefined) {
    if (!file) return;
    const problem = checkAvatar(file);
    setAvatarError(problem ?? "");
    if (problem) return;
    setAvatarBusy(true);
    try {
      updateBot(await uploadAvatar(bot.id, file));
    } catch (err) {
      setAvatarError(errorMessage(err));
    }
    setAvatarBusy(false);
  }

  async function useLetter() {
    setAvatarBusy(true);
    setAvatarError("");
    try {
      updateBot(await removeAvatar(bot.id));
    } catch (err) {
      setAvatarError(errorMessage(err));
    }
    setAvatarBusy(false);
  }

  return (
    <>
      <Group label="Main color">
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Main color">
          {SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              role="radio"
              aria-checked={draft.color === s.hex}
              aria-label={s.name}
              onClick={() => onChange({ color: s.hex })}
              className={cn("size-10 rounded-full ring-1 ring-black/10 ring-inset transition-shadow", draft.color === s.hex && ring)}
              style={{ background: s.hex }}
            />
          ))}
          <label
            className={cn(
              "relative flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full text-[11px] font-extrabold ring-1 ring-black/10 ring-inset",
              custom ? ring : "bg-app text-subtle",
            )}
            style={custom ? { background: draft.color, color: onColor(draft.color) } : undefined}
            title="Your own color"
          >
            <span aria-hidden="true">+</span>
            <input
              type="color"
              aria-label="Your own color"
              value={draft.color.toLowerCase()}
              onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </Group>

      <Group label="Avatar" hint="PNG, JPG or WebP, up to 1 MB. Without a logo it shows the first letter of the name.">
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
          <button
            type="button"
            disabled={avatarBusy || !bot.avatarUrl}
            onClick={useLetter}
            aria-pressed={!bot.avatarUrl}
            aria-label="Use the first letter"
            className={cn(
              "flex size-12 items-center justify-center rounded-full text-lg font-extrabold",
              !bot.avatarUrl && "shadow-[0_0_0_3px_var(--surface),0_0_0_5px_var(--ink)]",
            )}
            style={{ background: draft.color, color: onColor(draft.color) }}
          >
            {(draft.name || bot.name).charAt(0).toUpperCase()}
          </button>
          {bot.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a remote logo in a static export
            <img src={bot.avatarUrl} alt="Your logo" className={cn("size-12 rounded-full object-cover", ring)} />
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
          <span className="flex grow flex-col gap-0.5">
            <span className="text-sm font-extrabold">Show “Powered by hovr”</span>
            <span className="text-xs text-subtle">Your plan lets you hide it.</span>
          </span>
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
          <span className="flex grow flex-col gap-0.5">
            <span className="text-sm font-extrabold">Hide “Powered by hovr”</span>
            <span className="text-xs text-subtle">Comes with Pro</span>
          </span>
          <span className="flex h-7 items-center rounded-full bg-lime px-2.5 text-xs font-extrabold text-on-lime">Pro</span>
        </Link>
      )}
    </>
  );
}
