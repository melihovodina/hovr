import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app/shell";

export const metadata: Metadata = {
  robots: { index: false },
};

// The shell reads ?bot=, so it renders in the browser (a static export has no request to read it from).
export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
