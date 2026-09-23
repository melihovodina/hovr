import type { Metadata } from "next";
import { NotYet } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Widget" };

export default function WidgetPage() {
  return <NotYet title="Widget" sub="Change how it looks. What you see is what visitors get." />;
}
