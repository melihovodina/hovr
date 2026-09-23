"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/components/app/app-context";
import { Notice } from "@/components/auth/fields";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { getConversation } from "@/lib/chat";
import { timeAgo } from "@/lib/format";
import { getInboxItem } from "@/lib/inbox";
import type { InboxItem, Lead, Message } from "@/lib/types";
import { ItemActions, ReplyLink } from "./actions";
import { Thread } from "./thread";

// Loads a chat's messages; null while loading, and null messages when the chat is gone.
function useMessages(load: (signal: AbortSignal) => Promise<Message[] | null>, key: string) {
  const [result, setResult] = useState<{ key: string; messages?: Message[] | null; error?: string } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal)
      .then((messages) => setResult({ key, messages }))
      .catch((err) => {
        if (!ctrl.signal.aborted) setResult({ key, error: errorMessage(err) });
      });
    return () => ctrl.abort();
    // `load` is rebuilt every render; the key says when it points elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result : null;
}

// The chat on the left, what to do about it on the right (below it on narrower screens).
function Layout({ onBack, thread, actions }: { onBack: () => void; thread: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex min-h-0 grow flex-col overflow-y-auto xl:flex-row xl:overflow-hidden">
      <div className="flex min-w-0 grow flex-col gap-4 px-5 py-5 sm:px-8 sm:py-6 xl:overflow-y-auto">
        <button type="button" onClick={onBack} className="flex h-9 items-center gap-1.5 self-start text-sm font-bold text-subtle hover:text-ink lg:hidden">
          <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Back to the list
        </button>
        {thread}
      </div>
      <aside className="flex shrink-0 flex-col gap-4 border-t border-line bg-app p-5 xl:w-85 xl:overflow-y-auto xl:border-t-0 xl:border-l">{actions}</aside>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-2/3 rounded-lg" />
      <Skeleton className="h-11 w-1/2 self-end rounded-[22px]" />
      <Skeleton className="h-16 w-3/4 rounded-[22px]" />
    </div>
  );
}

function times(n: number): string {
  return n === 1 ? "once" : `${n} times`;
}

export function ItemDetail({ item, onBack, onChange }: { item: InboxItem; onBack: () => void; onChange: (item: InboxItem, taught: boolean) => void }) {
  const { bot } = useApp();
  const result = useMessages((signal) => getInboxItem(bot.id, item.id, signal).then((r) => r.messages), item.id);
  return (
    <Layout
      onBack={onBack}
      thread={
        result?.error ? (
          <Notice tone="bad">{result.error}</Notice>
        ) : !result ? (
          <Loading />
        ) : (
          <Thread
            title={item.question}
            meta={`Asked ${times(item.timesAsked)} · latest chat ${timeAgo(item.lastAskedAt)}`}
            messages={result.messages ?? null}
            email={item.visitorEmail}
          />
        )
      }
      actions={<ItemActions key={item.id} item={item} onChange={onChange} />}
    />
  );
}

export function LeadDetail({ lead, onBack }: { lead: Lead; onBack: () => void }) {
  const { bot } = useApp();
  const result = useMessages((signal) => getConversation(bot.id, lead.conversationId, signal).then((r) => r.messages), lead.conversationId);
  return (
    <Layout
      onBack={onBack}
      thread={
        result?.error ? (
          <Notice tone="bad">{result.error}</Notice>
        ) : !result ? (
          <Loading />
        ) : (
          <Thread
            title={lead.email}
            meta={`Chat started ${timeAgo(lead.createdAt)} · last message ${timeAgo(lead.lastMessageAt)}`}
            messages={result.messages ?? null}
            email={null}
          />
        )
      }
      actions={
        <>
          <p className="rounded-[20px] bg-surface p-4 text-sm leading-normal shadow-[0_0_0_1px_var(--line)]">
            {lead.missed
              ? "The bot couldn’t answer something in this chat, so the visitor left an email for the team."
              : "The visitor left an email for the team."}
          </p>
          <ReplyLink email={lead.email} question={lead.question || undefined} />
        </>
      }
    />
  );
}
