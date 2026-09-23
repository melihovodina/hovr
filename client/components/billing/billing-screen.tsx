"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app/app-context";
import { PageHeader } from "@/components/app/page-header";
import { Notice } from "@/components/auth/fields";
import { errorMessage } from "@/lib/api";
import { confirmCheckout } from "@/lib/billing";
import { PlanPicker } from "./plan-picker";
import { UsageCard } from "./usage-card";

type Result = { tone: "ok" | "bad" | "info"; text: string };

// Stripe sends people back with ?checkout=<session id>, or ?checkout=cancelled.
function useCheckoutReturn(): Result | null {
  const { href, reload } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  // Read once: the address is cleaned right away so a reload doesn't confirm the same id again.
  const [session] = useState(() => params.get("checkout"));
  const [outcome, setOutcome] = useState<Result | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!session || started.current) return;
    started.current = true;
    router.replace(href("/app/billing"), { scroll: false });
    if (session === "cancelled") return;
    confirmCheckout(session)
      .then(({ planName }) => {
        setOutcome({ tone: "ok", text: `You’re on ${planName} now. Thanks!` });
        reload();
      })
      .catch((err) => setOutcome({ tone: "bad", text: errorMessage(err) }));
  }, [session, href, reload, router]);

  if (!session) return null;
  if (session === "cancelled") return { tone: "info", text: "Checkout cancelled. Nothing was charged." };
  return outcome ?? { tone: "info", text: "Confirming your payment…" };
}

export function BillingScreen() {
  const { billing } = useApp();
  const result = useCheckoutReturn();

  return (
    <>
      <PageHeader title="Billing" sub="Switch plans or cancel whenever you want." />
      <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
        {result && <Notice tone={result.tone}>{result.text}</Notice>}
        {!billing ? (
          <Notice tone="bad">Your plan couldn’t be loaded. Reload the page to try again.</Notice>
        ) : (
          <div className="flex grow flex-col gap-5 lg:flex-row">
            <div className="flex shrink-0 flex-col gap-4 lg:w-100">
              <UsageCard billing={billing} />
              <section className="flex grow flex-col gap-2.5 rounded-3xl px-6 py-5 shadow-[0_0_0_1px_var(--line)]">
                <h2 className="text-base font-extrabold">Invoices</h2>
                <p className="text-sm leading-normal text-subtle">
                  {billing.hasSubscription
                    ? "Your invoices and card are in the Stripe billing portal. Open it from the plan you’re on."
                    : "Nothing here yet. Invoices show up after your first payment, and you can download them from the Stripe billing portal."}
                </p>
              </section>
            </div>
            <PlanPicker key={billing.plan} billing={billing} />
          </div>
        )}
      </div>
    </>
  );
}
