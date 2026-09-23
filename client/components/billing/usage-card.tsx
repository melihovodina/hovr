import { cn } from "cn";
import { resetDate } from "@/lib/format";
import type { Billing } from "@/lib/types";

const RADIUS = 15.9; // about 100 around, so the dash reads as a percentage

function Ring({ label, used, limit, percent }: { label: string; used: number; limit: number; percent?: boolean }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const full = used >= limit;
  const value = percent ? `${Math.round(share * 100)}%` : `${used}/${limit}`;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-21">
        <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r={RADIUS} fill="none" strokeWidth="3.2" className="stroke-surface-2" />
          {share > 0 && (
            <circle
              cx="18"
              cy="18"
              r={RADIUS}
              fill="none"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray={`${share * 2 * Math.PI * RADIUS} 100`}
              className={cn("animate-ring", full ? "stroke-bad" : "stroke-ink")}
            />
          )}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">{value}</span>
      </div>
      <span className={cn("text-[13px] font-bold", full ? "text-bad" : "text-subtle")}>
        <span className="sr-only">
          {label}: {used.toLocaleString("en-US")} of {limit.toLocaleString("en-US")} used
        </span>
        <span aria-hidden="true">{label}</span>
      </span>
    </div>
  );
}

// "You've used your only bot slot. Messages reset on October 1."
export function usageNote(billing: Billing, now = new Date()): string {
  const { usage, limits } = billing;
  const notes: string[] = [];
  if (usage.bots >= limits.bots) notes.push(limits.bots === 1 ? "You’ve used your only bot slot." : `You’ve used all ${limits.bots} bot slots.`);
  if (usage.sources >= limits.sources) notes.push(`You’ve used all ${limits.sources} knowledge sources.`);
  if (usage.messages >= limits.messagesPerMonth) notes.push("You’ve used this month’s messages, so the bot can’t answer visitors until they reset.");
  notes.push(`Messages reset on ${resetDate("long", now)}.`);
  if (billing.periodEnd) {
    const end = new Date(billing.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    notes.push(`This billing period ends on ${end}.`);
  }
  return notes.join(" ");
}

export function UsageCard({ billing }: { billing: Billing }) {
  const { usage, limits } = billing;
  return (
    <section aria-label="Your plan" className="flex flex-col gap-5 rounded-3xl bg-app p-6">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold text-subtle">You’re on</span>
        <span className="text-[34px] leading-tight font-extrabold tracking-[-0.04em]">{billing.planName}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Ring label="Messages" used={usage.messages} limit={limits.messagesPerMonth} percent />
        <Ring label="Bots" used={usage.bots} limit={limits.bots} />
        <Ring label="Sources" used={usage.sources} limit={limits.sources} />
      </div>
      <p className="text-sm leading-normal text-subtle">{usageNote(billing)}</p>
    </section>
  );
}
