import type { Metadata } from "next";
import { NotYet } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Knowledge" };

export default function KnowledgePage() {
  return <NotYet title="Knowledge" sub="Everything the bot is allowed to answer from." />;
}
