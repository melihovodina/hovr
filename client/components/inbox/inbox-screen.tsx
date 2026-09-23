"use client";

import { Download, Inbox as InboxIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { useApp } from "@/components/app/app-context";
import { LoadError } from "@/components/app/load-error";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/format";
import { leadsCsvUrl } from "@/lib/inbox";
import type { InboxItem } from "@/lib/types";
import { useSetQuery } from "@/lib/use-set-query";
import { ItemDetail, LeadDetail } from "./details";
import { useInbox, type InboxData } from "./use-inbox";

type Tab = "open" | "leads" | "done";

const TABS: { value: Tab; label: string }[] = [
  { value: "open", label: "Needs an answer" },
  { value: "leads", label: "Leads" },
  { value: "done", label: "Done" },
];

const EMPTY: Record<Tab, string> = {
  open: "Nothing to answer. When the bot can’t answer a visitor, the question shows up here.",
  leads: "No emails yet. Visitors can leave one when the bot can’t help them.",
  done: "Questions you answered or marked as done show up here.",
};

function count(data: InboxData, tab: Tab): number {
  return tab === "open" ? data.open.length : tab === "leads" ? data.leads.length : data.done.length;
}

// Questions the bot couldn't answer (to teach it) and visitors who left an email (to reply).
export function InboxScreen() {
  const { bot, href, reload: reloadApp } = useApp();
  const params = useSearchParams();
  const setQuery = useSetQuery();
  const { data, error, reload } = useInbox(bot.id);
  const [flash, setFlash] = useState("");

  const tab: Tab = TABS.some((t) => t.value === params.get("tab")) ? (params.get("tab") as Tab) : "open";
  const selected = params.get("item");

  function go(next: { tab?: Tab; item?: string | null }) {
    setFlash("");
    setQuery({ ...(next.tab && { tab: next.tab }), item: next.item ?? null });
  }

  function changed(item: InboxItem, taught: boolean) {
    // Leave the list it left, and open the next question that still needs an answer.
    const list = tab === "done" ? data!.done : data!.open;
    const rest = list.filter((i) => i.id !== item.id);
    const index = list.findIndex((i) => i.id === item.id);
    go({ item: rest[Math.min(index, rest.length - 1)]?.id ?? null });
    setFlash(
      taught
        ? "Saved to your knowledge. The bot uses it as soon as it’s been read."
        : item.status === "done"
          ? "Marked as done."
          : "Moved back to Needs an answer.",
    );
    reload();
    reloadApp();
  }

  const items = data ? (tab === "done" ? data.done : data.open) : [];
  const item = tab !== "leads" ? (items.find((i) => i.id === selected) ?? null) : null;
  const lead = tab === "leads" ? (data?.leads.find((l) => l.conversationId === selected) ?? null) : null;
  const open = item !== null || lead !== null;

  return (
    <>
      <PageHeader title="Inbox" sub="Questions it couldn’t answer, and people who left an email." />
      {flash && (
        <div className="px-5 pb-4 sm:px-7">
          <Notice tone="ok">{flash}</Notice>
        </div>
      )}
      {error ? (
        <div className="px-5 sm:px-7">
          <LoadError message={error} onRetry={reload} />
        </div>
      ) : (
        <div className="flex min-h-0 grow border-t border-line">
          <div className={cn("min-h-0 w-full shrink-0 flex-col gap-1.5 overflow-y-auto border-line px-3 py-3.5 lg:flex lg:w-82 lg:border-r", open ? "hidden" : "flex")}>
            <div role="tablist" aria-label="Inbox" className="flex flex-wrap gap-1.5 px-0.5 pb-2">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={t.value === tab}
                  onClick={() => go({ tab: t.value, item: null })}
                  className={cn(
                    "flex h-8 items-center rounded-full px-3 text-[13px] transition-colors duration-200",
                    t.value === tab ? "bg-ink font-extrabold text-page" : "bg-app font-bold text-ink hover:bg-surface-2",
                  )}
                >
                  {t.label}
                  {data && t.value !== "done" && ` · ${count(data, t.value)}`}
                </button>
              ))}
            </div>
            {!data ? (
              <ListSkeleton />
            ) : (
              <List data={data} tab={tab} selected={selected} onSelect={(id) => go({ item: id })} />
            )}
            {data && tab === "leads" && data.leads.length > 0 && <Export botId={bot.id} canExport={data.canExport} billingHref={href("/app/billing")} />}
            {data && data.historyDays > 0 && (
              <p className="px-3 pt-2 text-xs leading-normal text-subtle">
                Your plan shows the last {data.historyDays} days.{" "}
                <Link href={href("/app/billing")} className="font-bold text-ink underline">
                  Keep everything
                </Link>
              </p>
            )}
          </div>

          <div className={cn("min-h-0 min-w-0 grow flex-col lg:flex", open ? "flex" : "hidden")}>
            {item ? (
              <ItemDetail key={item.id} item={item} onBack={() => go({ item: null })} onChange={changed} />
            ) : lead ? (
              <LeadDetail key={lead.conversationId} lead={lead} onBack={() => go({ item: null })} />
            ) : (
              <div className="flex grow flex-col items-center justify-center gap-2 p-8 text-center">
                <InboxIcon className="size-7 text-subtle" strokeWidth={1.8} aria-hidden="true" />
                {data && (
                  <span className="text-sm text-subtle">
                    {count(data, tab) > 0 ? "Pick something from the list." : tab === "open" ? "All caught up." : "Nothing here yet."}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1.5" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function Row({ active, unread, title, meta, onClick }: { active: boolean; unread: boolean; title: string; meta: string; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={active || undefined}
        onClick={onClick}
        className={cn("flex w-full animate-rise gap-2.5 rounded-2xl p-3 text-left transition-colors", active ? "bg-app" : "hover:bg-app")}
      >
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread && "bg-lime shadow-[0_0_0_1px_var(--ink)]")}
          aria-hidden="true"
        />
        <span className="flex min-w-0 flex-col gap-0.75">
          <span className="text-sm leading-snug font-bold break-words">{title}</span>
          <span className="truncate text-xs text-subtle">{meta}</span>
        </span>
      </button>
    </li>
  );
}

function List({ data, tab, selected, onSelect }: { data: InboxData; tab: Tab; selected: string | null; onSelect: (id: string) => void }) {
  if (count(data, tab) === 0) return <p className="px-3 py-2 text-sm leading-normal text-subtle">{EMPTY[tab]}</p>;

  if (tab === "leads") {
    return (
      <ul className="flex flex-col gap-0.5">
        {data.leads.map((l) => (
          <Row
            key={l.conversationId}
            active={l.conversationId === selected}
            unread={false}
            title={l.email}
            meta={`${l.question || "No question"} · ${timeAgo(l.createdAt)}`}
            onClick={() => onSelect(l.conversationId)}
          />
        ))}
      </ul>
    );
  }

  const items = tab === "open" ? data.open : data.done;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((i) => (
        <Row
          key={i.id}
          active={i.id === selected}
          unread={i.status === "open"}
          title={i.question}
          meta={[
            i.status === "done" ? (i.answerSourceId ? "Answered · added to knowledge" : "Marked as done") : i.timesAsked === 1 ? "Once" : `${i.timesAsked} times`,
            i.visitorEmail ?? (i.status === "open" ? "no email" : null),
            timeAgo(i.lastAskedAt),
          ]
            .filter(Boolean)
            .join(" · ")}
          onClick={() => onSelect(i.id)}
        />
      ))}
    </ul>
  );
}

// CSV of the leads on Business; on other plans a pointer to it.
function Export({ botId, canExport, billingHref }: { botId: string; canExport: boolean; billingHref: string }) {
  if (canExport) {
    return (
      <a
        href={leadsCsvUrl(botId)}
        download
        className="mx-1 mt-2 flex h-10 items-center justify-center gap-2 rounded-full text-sm font-extrabold shadow-[0_0_0_1px_var(--line)] hover:bg-app"
      >
        <Download className="size-4" strokeWidth={2.2} aria-hidden="true" />
        Export to CSV
      </a>
    );
  }
  return (
    <p className="px-3 pt-2 text-xs leading-normal text-subtle">
      Exporting leads to CSV comes with Business.{" "}
      <Link href={billingHref} className="font-bold text-ink underline">
        See plans
      </Link>
    </p>
  );
}
