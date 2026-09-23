import type { Metadata } from "next";
import { Suspense } from "react";
import { Onboarding } from "@/components/onboarding/onboarding";

export const metadata: Metadata = {
  title: "Set up your bot",
  robots: { index: false },
};

export default function OnboardingPage() {
  // Onboarding reads ?new=, which only exists in the browser.
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app" />}>
      <Onboarding />
    </Suspense>
  );
}
