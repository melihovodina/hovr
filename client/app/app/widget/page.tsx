import type { Metadata } from "next";
import { WidgetScreen } from "@/components/widget-editor/widget-screen";

export const metadata: Metadata = { title: "Widget" };

export default function WidgetPage() {
  return <WidgetScreen />;
}
