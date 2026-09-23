import { ArrowUp } from "lucide-react";
import type { FormEvent } from "react";
import { cn } from "cn";
import type { Citation, Message } from "@/lib/types";

// One chip per source the answer used, in the order they were cited.
export function SourceChips({ citations }: { citations: Citation[] }) {
  const titles = [...new Set(citations.map((c) => c.sourceTitle))];
  if (titles.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {titles.map((t) => (
        <span key={t} className="flex h-7 max-w-full items-center truncate rounded-full px-2.5 text-xs font-bold shadow-[0_0_0_1px_var(--line)]">
          {t}
        </span>
      ))}
    </div>
  );
}

function verdict(m: Message): { label: string; className: string; note: string } {
  if (m.answered === false) {
    return {
      label: "It didn’t know",
      className: "bg-bad-soft text-bad",
      note: "Nothing in your content answers this. On your site, the question would land in your Inbox so you can teach the bot.",
    };
  }
  if (m.citations.length === 0) {
    return {
      label: "No sources needed",
      className: "bg-idle-soft text-idle",
      note: "Small talk or a general reply, so it didn’t use your content.",
    };
  }
  const best = Math.max(...m.citations.map((c) => c.score));
  return best >= 0.7
    ? { label: "Strong match, answered", className: "bg-ok-soft text-ok", note: "" }
    : { label: "Answered", className: "bg-info-soft text-info", note: "" };
}

// The parts of the owner's content behind one answer, with how closely each matched the question.
export function WhyItSaidThat({ message }: { message: Message | null }) {
  if (!message) {
    return <p className="text-[13px] leading-normal text-subtle">Ask something, then pick an answer to see which parts of your content it used.</p>;
  }
  const v = verdict(message);
  const chunks = [...message.citations].sort((a, b) => b.score - a.score);
  return (
    <>
      <span className={cn("flex h-6.5 w-fit items-center rounded-full px-2.5 text-xs font-extrabold", v.className)}>{v.label}</span>
      {v.note && <p className="text-[13px] leading-normal text-subtle">{v.note}</p>}
      {chunks.map((c) => {
        const pct = Math.round(c.score * 100);
        return (
          <div key={c.n} className="flex flex-col gap-2 rounded-2xl bg-surface p-3.5 shadow-[0_0_0_1px_var(--line)]">
            <div className="flex justify-between gap-2 text-xs font-extrabold">
              <span className="min-w-0 truncate">
                [{c.n}] {c.sourceTitle}
              </span>
              <span className="shrink-0 text-subtle">{pct}% match</span>
            </div>
            <div className="h-1 rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[13px] leading-normal text-subtle">{c.excerpt}</p>
          </div>
        );
      })}
    </>
  );
}

export function Composer({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!disabled && value.trim()) onSubmit();
  }
  return (
    <form onSubmit={submit} className="flex h-14 items-center gap-2 rounded-full bg-app pr-2 pl-5.5 focus-within:shadow-[0_0_0_2px_var(--ink)]">
      <label htmlFor="pg-q" className="sr-only">
        Ask your bot
      </label>
      <input
        id="pg-q"
        autoComplete="off"
        maxLength={2000}
        placeholder="Ask what a customer would ask…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 grow bg-transparent text-[15px] text-ink outline-none placeholder:text-subtle"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={disabled || !value.trim()}
        className="flex size-10.5 shrink-0 items-center justify-center rounded-full bg-lime text-on-lime transition-opacity disabled:opacity-40"
      >
        <ArrowUp className="size-4.5" strokeWidth={2.4} />
      </button>
    </form>
  );
}
