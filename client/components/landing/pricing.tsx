import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "cn";
import { PLANS, PRICING_ROWS, type Cell } from "@/lib/landing";

type Plan = (typeof PLANS)[number];

const row = "flex h-14 items-center border-t border-line text-[15px] font-semibold";

function CellView({ cell }: { cell: Cell }) {
  if (cell.kind === "yes") return <Check className="size-5 text-lime-ink" strokeWidth={2.6} aria-label="Included" />;
  if (cell.kind === "no") return <span className="h-0.5 w-3.5 rounded-sm bg-dot" role="img" aria-label="Not included" />;
  return <span>{cell.text}</span>;
}

function PlanHead({ plan }: { plan: Plan }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-lg font-extrabold">{plan.name}</span>
        {plan.tag && (
          <span className="flex h-6 items-center rounded-full bg-lime px-2.5 text-xs font-extrabold text-on-lime">{plan.tag}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[44px] font-extrabold tracking-[-0.04em]">{plan.price}</span>
        <span className="text-[15px] text-subtle">a month</span>
      </div>
      <Link
        href="/signup"
        className={cn(
          "flex h-11.5 items-center justify-center rounded-full text-[15px] font-extrabold transition-opacity hover:opacity-85",
          plan.featured ? "bg-ink text-page" : "border border-line text-ink",
        )}
      >
        {plan.cta}
      </Link>
    </>
  );
}

// Desktop: one comparison table, feature names on the left.
function PricingTable() {
  return (
    <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr] lg:grid">
      <div className="flex flex-col pt-53">
        {PRICING_ROWS.map((r) => (
          <div key={r} className={row}>
            {r}
          </div>
        ))}
      </div>
      {PLANS.map((p) => (
        <div key={p.name} className={cn("flex flex-col rounded-3xl px-6", p.featured && "bg-surface shadow-[0_0_0_2px_var(--ink)]")}>
          <div className="flex h-53 flex-col gap-2.5 pt-6.5">
            <PlanHead plan={p} />
          </div>
          {p.cells.map((c, i) => (
            <div key={i} className={row}>
              <CellView cell={c} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Phones and tablets: one card per plan, each listing its own features.
function PricingCards() {
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {PLANS.map((p) => (
        <div
          key={p.name}
          className={cn(
            "flex flex-col gap-2.5 rounded-[26px] bg-surface p-5 sm:p-6",
            p.featured ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)]",
          )}
        >
          <PlanHead plan={p} />
          <dl className="mt-2.5 flex flex-col">
            {PRICING_ROWS.map((label, i) => (
              <div key={label} className="flex min-h-12 items-center justify-between gap-4 border-t border-line py-2 text-[15px]">
                <dt className="text-subtle">{label}</dt>
                <dd className="flex shrink-0 font-bold">
                  <CellView cell={p.cells[i]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-28 px-4 pb-16 sm:px-8 md:pb-24 lg:px-16 lg:pb-35">
      <div className="mx-auto flex max-w-328 flex-col gap-7 lg:gap-10">
        <h2 className="max-w-175 text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]">
          Start free, upgrade when you need more
        </h2>
        <PricingTable />
        <PricingCards />
      </div>
    </section>
  );
}
