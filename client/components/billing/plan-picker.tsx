"use client";

import { useState } from "react";
import { cn } from "cn";
import { Notice } from "@/components/auth/fields";
import { errorMessage } from "@/lib/api";
import { openPortal, startCheckout } from "@/lib/billing";
import { PLANS } from "@/lib/landing";
import type { Billing, Plan } from "@/lib/types";

const EXTRAS: Record<Plan, string> = {
  free: "",
  pro: ", no hovr badge",
  business: ", no hovr badge, lead export",
};

// The pricing table's plans, keyed like the API ("free", "pro", "business").
export const CHOICES = PLANS.map((p) => {
  const value = p.name.toLowerCase() as Plan;
  const [bots, messages, sources] = p.cells.map((c) => (c.kind === "text" ? c.text : ""));
  return {
    value,
    name: p.name,
    price: p.price,
    desc: `${bots} ${bots === "1" ? "bot" : "bots"}, ${messages} messages a month, ${sources} sources${EXTRAS[value]}`,
  };
});

const NEXT: Record<Plan, Plan> = { free: "pro", pro: "business", business: "business" };

type Action = { kind: "checkout"; plan: Exclude<Plan, "free"> } | { kind: "portal" } | { kind: "none" };

// What the button does for the picked plan. A running subscription changes (or cancels) in
// Stripe's portal, since a second Checkout would start a second subscription.
export function planAction(billing: Billing, picked: Plan): { title: string; note: string; action: Action; button: string } {
  const choice = CHOICES.find((c) => c.value === picked)!;
  if (billing.hasSubscription) {
    if (picked === billing.plan) {
      return { title: `You’re on ${choice.name}`, note: "Change your card, get invoices or cancel in the billing portal.", action: { kind: "portal" }, button: "Open billing portal" };
    }
    if (picked === "free") {
      return { title: "Back to Free", note: "Cancel in the billing portal. You go back to Free when the month ends.", action: { kind: "portal" }, button: "Open billing portal" };
    }
    return { title: `${choice.name}, ${choice.price} a month`, note: "Switch plans in the billing portal.", action: { kind: "portal" }, button: "Open billing portal" };
  }
  if (picked === "free" || picked === billing.plan) {
    return { title: `You’re on ${billing.planName}`, note: "Pick a paid plan to see what you’d pay.", action: { kind: "none" }, button: "Continue to checkout" };
  }
  return { title: `${choice.name}, ${choice.price} a month`, note: "Charged today, then monthly. Cancel whenever.", action: { kind: "checkout", plan: picked }, button: "Continue to checkout" };
}

export function PlanPicker({ billing }: { billing: Billing }) {
  const [picked, setPicked] = useState<Plan>(NEXT[billing.plan]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { title, note, action, button } = planAction(billing, picked);

  async function go() {
    if (action.kind === "none") return;
    setPending(true);
    setError("");
    try {
      const url = action.kind === "checkout" ? await startCheckout(action.plan) : await openPortal();
      window.location.assign(url);
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="change-plan" className="flex min-w-0 grow flex-col gap-3">
      <h2 id="change-plan" className="text-base font-extrabold">
        Change plan
      </h2>
      <div role="radiogroup" aria-labelledby="change-plan" className="flex flex-col gap-3">
        {CHOICES.map((c) => {
          const on = c.value === picked;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(c.value)}
              className={cn(
                "flex items-center gap-4 rounded-[22px] bg-surface px-5 py-4.5 text-left",
                on ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--subtle)]",
              )}
            >
              <span className={cn("size-5.5 shrink-0 rounded-full", on ? "border-7 border-ink" : "border-2 border-line")} aria-hidden="true" />
              <span className="flex min-w-0 grow flex-col gap-0.75">
                <span className="flex items-center gap-2 text-base font-extrabold">
                  {c.name}
                  {c.value === billing.plan && <span className="flex h-5.5 items-center rounded-full bg-surface-2 px-2 text-[11px] font-extrabold">Current</span>}
                </span>
                <span className="text-sm text-subtle">{c.desc}</span>
              </span>
              <span className="text-[22px] font-extrabold tracking-[-0.03em]">{c.price}</span>
            </button>
          );
        })}
      </div>

      {error && <Notice tone="bad">{error}</Notice>}

      <div className="mt-auto flex flex-col gap-4 rounded-3xl bg-ink px-6 py-5 text-page sm:flex-row sm:items-center sm:gap-5">
        <span className="flex grow flex-col gap-1">
          <span className="text-lg font-extrabold">{title}</span>
          <span className="text-[13px] opacity-75">{note}</span>
        </span>
        <button
          type="button"
          onClick={go}
          disabled={pending || action.kind === "none"}
          className="h-12.5 shrink-0 rounded-full bg-lime px-6 text-[15px] font-extrabold text-on-lime transition-opacity disabled:opacity-40"
        >
          {pending ? "Opening Stripe…" : button}
        </button>
      </div>
      <p className="text-xs text-subtle">Payments go through Stripe. This is test mode, so use card 4242 4242 4242 4242 with any future date.</p>
    </section>
  );
}
