import type { Metadata } from "next";
import { HomeScreen } from "@/components/app/home-screen";

export const metadata: Metadata = { title: "Overview" };

export default function AppPage() {
  return <HomeScreen />;
}
