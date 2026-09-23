"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { buttonVariants } from "@/components/ui/button";
import { WidgetPanel, type PreviewMessage } from "@/components/widget-panel";
import { ApiError, errorMessage } from "@/lib/api";
import { updateBot, type BotPatch } from "@/lib/bots";
import { chatColors } from "@/lib/chat-colors";
import { onColor } from "@/lib/format";
import type { Bot } from "@/lib/types";
import { Segmented } from "./controls";
import { InstallTab } from "./install-tab";
import { LookTab } from "./look-tab";
import { MessagesTab } from "./messages-tab";

type Tab = "look" | "messages" | "install";

// What Look and Messages change before "Save changes".
// The chat and bot colours always hold a color here: defaults fill in what the bot never picked.
export type Draft = Pick<Bot, "name" | "color" | "position" | "greeting" | "suggestedQuestions" | "showBadge" | "visitorMessageColor"> & {
  chatBackground: string;
  botMessageColor: string;
};

function draftOf(bot: Bot): Draft {
  return {
    name: bot.name,
    color: bot.color,
    position: bot.position,
    greeting: bot.greeting,
    suggestedQuestions: bot.suggestedQuestions,
    showBadge: bot.showBadge,
    ...chatColors(bot),
    visitorMessageColor: bot.visitorMessageColor,
  };
}

// Only the fields that differ from the saved bot.
export function changes(bot: Bot, draft: Draft): BotPatch {
  const patch: BotPatch = {};
  if (draft.name.trim() !== bot.name) patch.name = draft.name;
  if (draft.color !== bot.color) patch.color = draft.color;
  if (draft.position !== bot.position) patch.position = draft.position;
  if (draft.greeting.trim() !== bot.greeting) patch.greeting = draft.greeting;
  if (draft.suggestedQuestions.join("\n") !== bot.suggestedQuestions.join("\n")) patch.suggestedQuestions = draft.suggestedQuestions;
  if (draft.showBadge !== bot.showBadge) patch.showBadge = draft.showBadge;
  const saved = chatColors(bot);
  if (draft.chatBackground !== saved.chatBackground) patch.chatBackground = draft.chatBackground;
  if (draft.visitorMessageColor !== bot.visitorMessageColor) patch.visitorMessageColor = draft.visitorMessageColor;
  if (draft.botMessageColor !== saved.botMessageColor) patch.botMessageColor = draft.botMessageColor;
  return patch;
}

const TABS: { value: Tab; label: string }[] = [
  { value: "look", label: "Look" },
  { value: "messages", label: "Messages" },
  { value: "install", label: "Install" },
];

// Keyed by bot, so switching bots starts from that bot's saved settings.
export function WidgetScreen() {
  const { bot } = useApp();
  return <WidgetEditor key={bot.id} />;
}

function WidgetEditor() {
  const { bot, href, updateBot: setBot } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = TABS.some((t) => t.value === params.get("tab")) ? (params.get("tab") as Tab) : "look";
  const [draft, setDraft] = useState<Draft>(() => draftOf(bot));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(false);
  const [saved, setSaved] = useState(false);
  const [view, setView] = useState<View>("start");
  // Only colours the made-up site in the preview; kept in this browser, never saved to the bot.
  const [site, setSite] = useState(() => savedSiteColor() ?? "#16161A");

  function pickSite(color: string) {
    setSite(color);
    try {
      localStorage.setItem(SITE_KEY, color);
    } catch {}
  }

  const patch = changes(bot, draft);
  const dirty = Object.keys(patch).length > 0;

  function change(next: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...next }));
    setSaved(false);
    setError("");
  }

  function openTab(next: Tab) {
    const q = new URLSearchParams(params.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const next = await updateBot(bot.id, patch);
      setBot(next);
      setDraft(draftOf(next));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
      setUpgrade(err instanceof ApiError && err.upgradeRequired);
    }
    setPending(false);
  }

  return (
    <>
      <PageHeader
        title="Widget"
        sub={tab === "install" ? "Put it on your site. It takes about a minute." : "Change how it looks. What you see is what visitors get."}
      />
      <div className="flex min-h-0 grow border-t border-line">
        <Preview draft={draft} avatarUrl={bot.avatarUrl} site={site} view={view} onView={setView} />

        <div className="flex w-full min-w-0 flex-col lg:w-90 lg:shrink-0 lg:border-l lg:border-line">
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-5.5">
            <Segmented label="Widget settings" options={TABS} value={tab} onChange={openTab} />
            {tab === "look" && (
              <LookTab
                draft={draft}
                site={site}
                onSite={pickSite}
                onChange={(next) => {
                  change(next);
                  // Message colours only show in a chat.
                  if ("visitorMessageColor" in next || "botMessageColor" in next) setView("chat");
                }}
              />
            )}
            {tab === "messages" && <MessagesTab draft={draft} onChange={change} />}
            {tab === "install" && <InstallTab />}
          </div>

          {tab !== "install" && (
            <div className="flex shrink-0 flex-col gap-2.5 border-t border-line px-5 py-4 sm:px-5.5">
              {error && (
                <Notice tone="bad">
                  {error}{" "}
                  {upgrade && (
                    <Link href={href("/app/billing")} className="underline">
                      See plans
                    </Link>
                  )}
                </Notice>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={!dirty || pending}
                  className={cn(buttonVariants(), "h-11.5 grow text-sm disabled:opacity-40")}
                >
                  {pending ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}
                </button>
                <button type="button" onClick={() => openTab("install")} className="h-11.5 rounded-full bg-app px-4.5 text-sm font-bold hover:bg-surface-2">
                  Get code
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const SITE_KEY = "hovr-preview-site";

// The preview site's colour is only for the owner's eyes, so it stays in this browser.
function savedSiteColor(): string | null {
  try {
    return localStorage.getItem(SITE_KEY);
  } catch {
    return null;
  }
}

// A made-up page in the owner's site colour: its bar, dots and text blocks are shades of it.
function siteColors(bg: string) {
  const ink = onColor(bg);
  const mix = (share: number) => `color-mix(in srgb, ${ink} ${share}%, ${bg})`;
  return { page: bg, bar: mix(6), dot: mix(18), skel: mix(10), text: mix(55) };
}

// A short chat so the message colours can be seen.
const SAMPLE: PreviewMessage[] = [
  { kind: "user", text: "Do you deliver on weekends?" },
  { kind: "bot", text: "Yes, every day of the week. Orders placed before noon go out the same day." },
  { kind: "source", text: "Delivery.pdf" },
];

type View = "start" | "chat";

// The customer's page with the widget open in its corner, drawn from the unsaved settings.
function Preview({ draft, avatarUrl, site, view, onView }: { draft: Draft; avatarUrl: string | null; site: string; view: View; onView: (v: View) => void }) {
  const { bot } = useApp();
  const c = siteColors(site);

  return (
    <div className="hidden min-w-0 grow flex-col gap-3 bg-app bg-[radial-gradient(var(--dot)_1px,transparent_1px)] bg-size-[18px_18px] p-5 lg:flex">
      <div className="w-40">
        <Segmented
          label="Preview"
          value={view}
          onChange={onView}
          options={[
            { value: "start", label: "Start" },
            { value: "chat", label: "Chat" },
          ]}
        />
      </div>
      <div
        className="relative min-h-0 grow overflow-hidden rounded-[20px] shadow-[0_0_0_1px_var(--line),0_20px_50px_-30px_rgba(0,0,0,0.4)] transition-colors duration-300"
        style={{ background: c.page }}
        aria-label="Preview"
        role="img"
      >
        <div className="flex h-9 items-center gap-1.5 px-3.5" style={{ background: c.bar }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.25 rounded-full" style={{ background: c.dot }} />
          ))}
          <span className="ml-2.5 text-xs" style={{ color: c.text }}>
            {bot.lastSeenHost ?? bot.allowedDomains[0] ?? "yourstore.com"}
          </span>
        </div>
        <div className="flex flex-col gap-3 p-7">
          <span className="h-3.5 w-45 rounded-md" style={{ background: c.skel }} />
          <span className="h-7 w-75 rounded-lg" style={{ background: c.skel }} />
          <span className="h-3 w-60 rounded-md" style={{ background: c.skel }} />
        </div>
        {/* The live panel's size: widget.js opens a 396×700 iframe with 8px around the panel. */}
        <div className={cn("absolute bottom-5 h-[min(42.75rem,calc(100%-5.5rem))] w-95 max-w-[calc(100%-2.5rem)]", draft.position === "left" ? "left-5" : "right-5")}>
          <WidgetPanel
            name={draft.name || bot.name}
            avatar={(draft.name || bot.name).charAt(0).toUpperCase()}
            avatarUrl={avatarUrl}
            color={draft.color}
            greeting={draft.greeting}
            suggestions={draft.suggestedQuestions}
            showBadge={draft.showBadge}
            messages={view === "chat" ? SAMPLE : []}
            chatBackground={draft.chatBackground}
            visitorMessageColor={draft.visitorMessageColor}
            botMessageColor={draft.botMessageColor}
          />
        </div>
      </div>
    </div>
  );
}
