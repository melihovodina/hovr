import type { Metadata } from "next";
import { PlaygroundScreen } from "@/components/playground/playground-screen";

export const metadata: Metadata = { title: "Playground" };

export default function PlaygroundPage() {
  return <PlaygroundScreen />;
}
