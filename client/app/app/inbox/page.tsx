import type { Metadata } from "next";
import { NotYet } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return <NotYet title="Inbox" sub="Questions it couldn’t answer, and people who left an email." />;
}
