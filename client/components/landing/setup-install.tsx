"use client";

import { useState } from "react";
import { cn } from "cn";
import { INSTALL_GUIDES } from "@/lib/landing";

// A sample of the embed code, plus where to paste it on each site builder.
// The code is only an illustration: it can't be copied, because the real line
// carries the key of a bot you own.
export function SetupInstall({ siteUrl }: { siteUrl: string }) {
  const [platform, setPlatform] = useState(INSTALL_GUIDES[0].id);
  const guide = INSTALL_GUIDES.find((g) => g.id === platform) ?? INSTALL_GUIDES[0];

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-2">
        <span className="flex h-6 w-fit items-center rounded-full bg-surface-2 px-2.5 text-[11px] font-extrabold tracking-[0.08em] text-subtle uppercase">
          Example
        </span>
        <pre
          aria-hidden="true"
          className="pointer-events-none rounded-[18px] bg-[#111215] p-4 font-mono text-[13px] leading-[1.7] break-all whitespace-pre-wrap text-[#E9E8E3] select-none sm:px-6 sm:py-5.5 sm:text-[15px]"
        >
          {`<script src="${siteUrl}/widget.js"\n  data-bot="`}
          <span className="text-lime">pub_7fK2qLx9</span>
          {`"\n  defer></script>`}
        </pre>
        <span className="text-[13px] leading-normal text-subtle">
          Your own line, with your bot’s key, waits in the dashboard once you make a bot.
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where your site is built">
        {INSTALL_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={platform === g.id}
            onClick={() => setPlatform(g.id)}
            className={cn(
              "flex h-9 items-center rounded-full px-3.5 text-sm font-bold transition-colors",
              platform === g.id ? "bg-ink text-page" : "border border-line bg-surface text-ink hover:bg-surface-2",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2.5">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-[15px] leading-snug">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-extrabold">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
