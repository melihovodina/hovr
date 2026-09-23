import type { Metadata } from "next";
import { BillingScreen } from "@/components/billing/billing-screen";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <BillingScreen />;
}
