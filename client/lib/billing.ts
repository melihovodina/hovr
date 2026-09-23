import { api } from "./api";
import type { Plan } from "./types";

// Stripe Checkout and the billing portal (/api/billing). Both answer with a URL to open.

export async function startCheckout(plan: Exclude<Plan, "free">): Promise<string> {
  const { url } = await api<{ url: string }>("/billing/checkout", { method: "POST", body: { plan } });
  return url;
}

// Applies the plan on the way back from Checkout, without waiting for Stripe's webhook.
export function confirmCheckout(sessionId: string) {
  return api<{ plan: Plan; planName: string }>("/billing/confirm", { method: "POST", body: { sessionId } });
}

export async function openPortal(): Promise<string> {
  const { url } = await api<{ url: string }>("/billing/portal", { method: "POST" });
  return url;
}
