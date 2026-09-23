import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/shell";
import { AppStub } from "./stub";

export const metadata: Metadata = {
  title: "Your bots",
  robots: { index: false },
};

// Placeholder until the app shell (sidebar and screens) lands.
export default function AppPage() {
  return (
    <AuthShell>
      <AppStub />
    </AuthShell>
  );
}
