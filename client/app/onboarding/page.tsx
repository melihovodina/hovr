import type { Metadata } from "next";
import { Onboarding } from "@/components/onboarding/onboarding";

export const metadata: Metadata = {
  title: "Set up your bot",
  robots: { index: false },
};

export default function OnboardingPage() {
  return <Onboarding />;
}
