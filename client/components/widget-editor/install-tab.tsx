"use client";

import { Check, Copy, X } from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { Notice } from "@/components/auth/fields";
import { buttonVariants } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { embedCode, MAX_DOMAINS, updateBot } from "@/lib/bots";
import { timeAgo } from "@/lib/format";
import { INSTALL_GUIDES } from "@/lib/landing";
import { SITE_URL } from "@/lib/site";
import { fieldClass, Group } from "./controls";

const noSubscribe = () => () => {};

// The address the widget script is served from: the app's own origin (the canonical URL while prerendering).
function useOrigin(): string {
  return useSyncExternalStore(noSubscribe, () => window.location.origin, () => SITE_URL);
}

function Status() {
  const { bot } = useApp();
  if (bot.lastSeenHost && bot.lastSeenAt) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl bg-ok-soft px-3.5 py-3 text-[13px] font-extrabold text-ok" role="status">
        <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
        Working on {bot.lastSeenHost}. Last seen {timeAgo(bot.lastSeenAt)}.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-idle-soft px-3.5 py-3 text-[13px] font-extrabold text-idle" role="status">
      <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
      Not on a site yet. Paste the code, then open your site.
    </div>
  );
}

function Code() {
  const { bot } = useApp();
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const code = embedCode(origin, bot.publicKey);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is selectable, so it can still be copied by hand.
    }
  }

  return (
    <Group label="Your code">
      <pre className="rounded-2xl bg-night px-4 py-3.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-code-ink">
        {`<script src="${origin}/widget.js"\n  data-bot="`}
        <span className="text-lime">{bot.publicKey}</span>
        {`" defer></script>`}
      </pre>
      <button type="button" onClick={copy} className={cn(buttonVariants(), "h-10.5 gap-2 text-sm")}>
        {copied ? <Check className="size-4" strokeWidth={2.4} /> : <Copy className="size-4" strokeWidth={2.2} />}
        {copied ? "Copied" : "Copy code"}
      </button>
    </Group>
  );
}

function Guides() {
  const [platform, setPlatform] = useState(INSTALL_GUIDES[0].id);
  const guide = INSTALL_GUIDES.find((g) => g.id === platform) ?? INSTALL_GUIDES[0];
  return (
    <Group label="Where to paste it">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Where your site is built">
        {INSTALL_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={platform === g.id}
            onClick={() => setPlatform(g.id)}
            className={cn(
              "h-8 rounded-full px-3 text-[13px] font-bold transition-colors",
              platform === g.id ? "bg-ink text-page" : "bg-app text-ink hover:bg-surface-2",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <ol className="flex flex-col gap-2">
        {guide.steps.map((step, i) => (
          <li key={step} className="flex gap-2.5 text-[13px] leading-snug">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-app text-[11px] font-extrabold">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </Group>
  );
}

// Saved right away: the server cleans each entry up to a hostname and refuses anything else.
function AllowedSites() {
  const { bot, updateBot: setBot } = useApp();
  const [site, setSite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save(domains: string[]) {
    setPending(true);
    setError("");
    try {
      setBot(await updateBot(bot.id, { allowedDomains: domains }));
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!site.trim()) return;
    if (await save([...bot.allowedDomains, site.trim()])) setSite("");
  }

  return (
    <Group
      label="Allowed websites"
      htmlFor="allowed"
      hint="The bot only answers on these sites and their subdomains, so nobody can copy your code and use up your messages. With none added, it works anywhere."
    >
      {bot.allowedDomains.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {bot.allowedDomains.map((d) => (
            <li key={d} className="flex h-7.5 items-center gap-1 rounded-full bg-app pr-1 pl-3 text-[13px] font-bold">
              {d}
              <button
                type="button"
                disabled={pending}
                aria-label={`Remove ${d}`}
                onClick={() => save(bot.allowedDomains.filter((x) => x !== d))}
                className="flex size-6 items-center justify-center rounded-full text-subtle hover:text-ink"
              >
                <X className="size-3" strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          id="allowed"
          value={site}
          disabled={pending || bot.allowedDomains.length >= MAX_DOMAINS}
          onChange={(e) => setSite(e.target.value)}
          placeholder={bot.allowedDomains.length > 0 ? "Add another, like example.com" : "Like example.com"}
          className={cn(fieldClass, "h-10 rounded-full")}
        />
        <button type="submit" disabled={pending || !site.trim()} className={cn(buttonVariants(), "h-10 px-4 text-[13px] disabled:opacity-40")}>
          Add
        </button>
      </form>
      {error && <Notice tone="bad">{error}</Notice>}
    </Group>
  );
}

export function InstallTab() {
  return (
    <>
      <Status />
      <Code />
      <Guides />
      <AllowedSites />
    </>
  );
}
