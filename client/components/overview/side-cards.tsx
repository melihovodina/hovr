import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import type { Billing, Source, Stats } from "@/lib/types";

interface Todo {
  key: string;
  text: string;
  meta?: string;
  href: string;
  dot: string;
}

// Share of the monthly messages after which the plan shows up in "Needs you".
const USAGE_WARNING = 0.8;

export function todos(stats: Stats, sources: Source[], billing: Billing | null, href: (path: string) => string): Todo[] {
  const list: Todo[] = stats.needsYou.map((q) => ({
    key: q.id,
    text: `“${q.question}”`,
    meta: q.timesAsked === 1 ? "It couldn’t answer this" : `Asked ${q.timesAsked} times, it couldn’t answer`,
    href: `${href("/app/inbox")}&item=${q.id}`,
    dot: "bg-lime",
  }));
  const more = stats.openQuestions - stats.needsYou.length;
  if (more > 0) {
    list.push({ key: "more", text: `${more} more ${more === 1 ? "question" : "questions"} in the Inbox`, href: href("/app/inbox"), dot: "bg-lime" });
  }
  for (const s of sources.filter((s) => s.status === "failed")) {
    list.push({ key: s.id, text: `${s.title} didn’t import`, href: href("/app/knowledge"), dot: "bg-bad" });
  }
  if (billing) {
    const { messages } = billing.usage;
    const limit = billing.limits.messagesPerMonth;
    if (limit > 0 && messages >= limit * USAGE_WARNING) {
      list.push({ key: "usage", text: `${messages} of ${limit} messages used this month`, href: href("/app/billing"), dot: "bg-subtle" });
    }
  }
  return list;
}

export function NeedsYou({ items }: { items: Todo[] }) {
  return (
    <section className="flex flex-col gap-1 rounded-[22px] p-5 shadow-[0_0_0_1px_var(--line)]">
      <h2 className="mb-2 text-[17px] font-extrabold">Needs you</h2>
      {items.length === 0 ? (
        <p className="px-2 pb-1 text-sm leading-normal text-subtle">All clear. Nothing is waiting for you.</p>
      ) : (
        items.map((t) => (
          <Link key={t.key} href={t.href} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-app">
            <span className={cn("size-2.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
            <span className="flex min-w-0 grow flex-col gap-0.5">
              <span className="text-sm leading-snug">{t.text}</span>
              {t.meta && <span className="text-xs text-subtle">{t.meta}</span>}
            </span>
            <ChevronRight className="size-4 shrink-0 text-subtle" strokeWidth={2} aria-hidden="true" />
          </Link>
        ))
      )}
    </section>
  );
}

export function TopQuestions({ questions }: { questions: Stats["topQuestions"] }) {
  const max = Math.max(1, ...questions.map((q) => q.count));
  return (
    <section className="flex grow flex-col gap-3 rounded-[22px] p-5 shadow-[0_0_0_1px_var(--line)]">
      <h2 className="text-[17px] font-extrabold">What people ask most</h2>
      {questions.length === 0 ? (
        <p className="text-sm leading-normal text-subtle">Nothing asked yet. The most common questions show up here.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {questions.map((q) => (
            <li key={q.question} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2.5 text-sm">
                <span className="min-w-0 break-words">{q.question}</span>
                <span className="shrink-0 font-extrabold" aria-label={`asked ${q.count} ${q.count === 1 ? "time" : "times"}`}>
                  {q.count}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2" aria-hidden="true">
                <div className="h-full rounded-full bg-ink" style={{ width: `${(q.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
