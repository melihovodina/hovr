import type { Metadata } from "next";
import { AppHome } from "@/components/app/app-home";

export const metadata: Metadata = {
  title: "Your bot",
  robots: { index: false },
};

export default function AppPage() {
  return <AppHome />;
}
