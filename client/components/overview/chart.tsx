import { cn } from "cn";
import type { Stats } from "@/lib/types";

type Day = Stats["daily"][number];

// "2026-09-23" is a day in the owner's timezone, so it's read as a local date, not UTC midnight.
function localDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Weekday names for a week; for longer periods every fifth day and the last one get a date.
export function dayLabel(date: string, index: number, count: number): string {
  const d = localDate(date);
  if (count <= 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  if (index % 5 === 0 || index === count - 1) return String(d.getDate());
  return "";
}

function describe(day: Day): string {
  const when = localDate(day.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return `${when}: ${day.answered} answered, ${day.missed} missed`;
}

// Answered vs missed per day, stacked. Each bar's height is relative to the busiest day.
export function Chart({ stats }: { stats: Stats }) {
  const { daily, days } = stats;
  const max = Math.max(1, ...daily.map((d) => d.answered + d.missed));
  const empty = daily.every((d) => d.answered + d.missed === 0);
  const week = days <= 7;
  const round = week ? "rounded-lg" : "rounded-sm";

  return (
    <section className="flex min-h-80 min-w-0 grow flex-col gap-4.5 rounded-[22px] p-6 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="grow text-[17px] font-extrabold">{days === 7 ? "Questions this week" : `Questions in the last ${days} days`}</h2>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-[13px] text-subtle">
            <span className="size-2.5 rounded-[3px] bg-ink" aria-hidden="true" />
            Answered
          </span>
          <span className="flex items-center gap-1.5 text-[13px] text-subtle">
            <span className="size-2.5 rounded-[3px] bg-lime" aria-hidden="true" />
            Missed
          </span>
        </div>
      </div>

      <div className="relative flex grow">
        {empty && (
          <p className="absolute inset-x-0 top-1/3 text-center text-sm text-subtle">
            No questions from visitors {week ? "this week" : "in this period"} yet.
          </p>
        )}
        <ul aria-label="Questions per day" className={cn("flex grow items-end pt-2.5", week ? "gap-2 sm:gap-4.5" : "gap-0.5 sm:gap-1")}>
          {daily.map((d, i) => {
            const total = d.answered + d.missed;
            return (
              <li key={d.date} aria-label={describe(d)} className="flex h-full min-w-0 grow basis-0 flex-col items-center justify-end gap-2">
                {week && <span className="text-xs font-bold text-subtle">{total}</span>}
                <div className="flex w-full grow flex-col justify-end" aria-hidden="true">
                  {total === 0 ? (
                    <div className="h-0.75 rounded-full bg-surface-2" />
                  ) : (
                    <div className="flex min-h-1.5 flex-col gap-0.75" style={{ height: `${(total / max) * 100}%` }}>
                      {d.missed > 0 && <div className={cn("min-h-0.75 bg-lime", round)} style={{ flex: `${d.missed} 1 0` }} />}
                      {d.answered > 0 && <div className={cn("min-h-0.75 bg-ink", round)} style={{ flex: `${d.answered} 1 0` }} />}
                    </div>
                  )}
                </div>
                <span className="h-4 text-xs font-bold whitespace-nowrap text-subtle" aria-hidden="true">
                  {dayLabel(d.date, i, daily.length)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
