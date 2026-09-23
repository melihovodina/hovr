"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { buttonVariants } from "@/components/ui/button";
import { WidgetPanel } from "@/components/widget-panel";
import { ApiError, errorMessage } from "@/lib/api";
import { updateBot, type BotPatch } from "@/lib/bots";
import type { Bot } from "@/lib/types";
import { Segmented } from "./controls";
import { InstallTab } from "./install-tab";
import { LookTab } from "./look-tab";
import { MessagesTab } from "./messages-tab";

type Tab = "look" | "messages" | "install";

// What Look and Messages change before "Save changes".
export type Draft = Pick<Bot, "name" | "color" | "position" | "greeting" | "suggestedQuestions" | "showBadge">;

function draftOf(bot: Bot): Draft {
  return {
    name: bot.name,
    color: bot.color,
    position: bot.position,
    greeting: bot.greeting,
    suggestedQuestions: bot.suggestedQuestions,
    showBadge: bot.showBadge,
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
        <Preview draft={draft} avatarUrl={bot.avatarUrl} />

        <div className="flex w-full min-w-0 flex-col lg:w-90 lg:shrink-0 lg:border-l lg:border-line">
          <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-5.5">
            <Segmented label="Widget settings" options={TABS} value={tab} onChange={openTab} />
            {tab === "look" && <LookTab draft={draft} onChange={change} />}
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
              {dirty && !pending && (
                <span className="text-xs text-subtle">Visitors see the changes once you save.</span>
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

// The customer's page with the widget open in its corner, drawn from the unsaved settings.
function Preview({ draft, avatarUrl }: { draft: Draft; avatarUrl: string | null }) {
  const { bot } = useApp();
  return (
    <div className="hidden min-w-0 grow items-center justify-center bg-app bg-[radial-gradient(var(--dot)_1px,transparent_1px)] bg-size-[18px_18px] p-5 lg:flex">
      <div className="relative size-full overflow-hidden rounded-[20px] bg-site shadow-[0_0_0_1px_var(--line),0_20px_50px_-30px_rgba(0,0,0,0.4)]" aria-label="Preview" role="img">
        <div className="flex h-9 items-center gap-1.5 bg-site-bar px-3.5">
          <span className="size-2.25 rounded-full bg-site-dot" />
          <span className="size-2.25 rounded-full bg-site-dot" />
          <span className="size-2.25 rounded-full bg-site-dot" />
          <span className="ml-2.5 text-xs text-site-ink">{bot.lastSeenHost ?? bot.allowedDomains[0] ?? "yourstore.com"}</span>
        </div>
        <div className="flex flex-col gap-3 p-7">
          <span className="h-3.5 w-45 rounded-md bg-site-skel" />
          <span className="h-7 w-75 rounded-lg bg-site-skel" />
          <span className="h-3 w-60 rounded-md bg-site-skel" />
        </div>
        <div className={cn("absolute bottom-5 h-[min(37.5rem,calc(100%-5.5rem))] w-90 max-w-[calc(100%-2.5rem)]", draft.position === "left" ? "left-5" : "right-5")}>
          <WidgetPanel
            name={draft.name || bot.name}
            avatar={(draft.name || bot.name).charAt(0).toUpperCase()}
            avatarUrl={avatarUrl}
            color={draft.color}
            greeting={draft.greeting}
            suggestions={draft.suggestedQuestions}
            showBadge={draft.showBadge}
          />
        </div>
      </div>
    </div>
  );
}
