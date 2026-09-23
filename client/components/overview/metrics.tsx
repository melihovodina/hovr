import { cn } from "cn";
import type { Stats } from "@/lib/types";

// "last week" for 7 days, "the 30 days before" otherwise.
export function previousLabel(days: number): string {
  return days === 7 ? "last week" : `the ${days} days before`;
}

// How a count moved against the previous period, and whether that's up.
export function change(cur: number, prev: number, days: number): { text: string; up: boolean } {
  const label = previousLabel(days);
  if (prev === 0) return { text: cur === 0 ? `None ${label} either` : `None ${label}`, up: cur > 0 };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { text: `Same as ${label}`, up: false };
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}% on ${label}`, up: pct > 0 };
}

function Metric({ label, value, note, up }: { label: string; value: string; note: string; up: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 border-line px-5 py-4 not-first:border-t sm:px-6 sm:py-5 sm:not-first:border-t-0 sm:not-first:border-l">
      <span className="text-sm font-semibold text-subtle">{label}</span>
      <span className="text-[30px] leading-tight sm:text-[38px] font-extrabold tracking-[-0.04em]">{value}</span>
      <span className={cn("text-[13px] font-bold", up ? "text-lime-ink" : "text-subtle")}>{note}</span>
    </div>
  );
}

// The three numbers at the top: questions, answered on its own, emails collected.
export function Metrics({ stats }: { stats: Stats }) {
  const { current: cur, previous: prev, days } = stats;
  const questions = change(cur.questions, prev.questions, days);
  const leads = change(cur.leads, prev.leads, days);
  const replies = cur.answered + cur.missed;
  return (
    <div className="grid rounded-[22px] bg-app sm:grid-cols-3">
      <Metric label="Questions" value={String(cur.questions)} note={questions.text} up={questions.up} />
      <Metric
        label="Answered on its own"
        value={cur.answeredRate === null ? "—" : `${Math.round(cur.answeredRate * 100)}%`}
        note={replies === 0 ? "Nothing to answer yet" : `${cur.answered} of ${replies}`}
        up={false}
      />
      <Metric label="Emails collected" value={String(cur.leads)} note={leads.text} up={leads.up} />
    </div>
  );
}
