import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "cn";
import { PLANS, PRICING_ROWS, type Cell } from "@/lib/landing";

const row = "flex h-14 items-center border-t border-line text-[15px] font-semibold";

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "yes") return <Check className="size-5 text-lime-ink" strokeWidth={2.6} aria-label="Included" />;
  if (cell.kind === "no")
    return (
      <span className="h-0.5 w-3.5 rounded-sm bg-dot" role="img" aria-label="Not included" />
    );
  return <span>{cell.text}</span>;
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-28 px-4 pb-24 sm:px-8 lg:px-16 lg:pb-[140px]">
      <div className="mx-auto flex max-w-[1312px] flex-col gap-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-10">
          <h2 className="max-w-[700px] text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]">
            Start on the free plan. Upgrade if it’s worth it to you.
          </h2>
          <p className="max-w-[340px] text-base leading-relaxed text-subtle">
            Monthly, cancel whenever you like. One message means one visitor question and the bot’s reply.
          </p>
        </div>
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[820px] grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div className="flex flex-col pt-[212px]">
              {PRICING_ROWS.map((r) => (
                <div key={r} className={row}>
                  {r}
                </div>
              ))}
            </div>
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={cn("flex flex-col rounded-3xl px-6", p.featured && "bg-surface shadow-[0_0_0_2px_var(--ink)]")}
              >
                <div className="flex h-[212px] flex-col gap-2.5 pt-[26px]">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-extrabold">{p.name}</span>
                    {p.tag && (
                      <span className="flex h-6 items-center rounded-full bg-lime px-2.5 text-xs font-extrabold text-on-lime">{p.tag}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[44px] font-extrabold tracking-[-0.04em]">{p.price}</span>
                    <span className="text-[15px] text-subtle">a month</span>
                  </div>
                  <Link
                    href="/signup"
                    className={cn(
                      "flex h-[46px] items-center justify-center rounded-full text-[15px] font-extrabold transition-opacity hover:opacity-85",
                      p.featured ? "bg-ink text-page" : "border border-line text-ink",
                    )}
                  >
                    {p.cta}
                  </Link>
                </div>
                {p.cells.map((c, i) => (
                  <div key={i} className={row}>
                    <CellView cell={c} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
