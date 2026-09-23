import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatWidget } from "@/components/widget/chat-widget";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false },
};

// Loaded by widget.js in an iframe on the customer's site (/widget?key=pub_...).
export default function WidgetPage() {
  return (
    <div className="hovr-widget-root">
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}
