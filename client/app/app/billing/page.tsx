import type { Metadata } from "next";
import { NotYet } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Billing" };

export default function BillingPage() {
  return <NotYet title="Billing" sub="Switch plans or cancel whenever you want." />;
}
