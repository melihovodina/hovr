import type { Metadata } from "next";
import { NotYet } from "@/components/app/page-header";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return <NotYet title="Playground" sub="Ask what your customers would ask. Test chats are free." />;
}
