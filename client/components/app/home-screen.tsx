"use client";

import { Overview } from "@/components/overview/overview";
import { useApp } from "./app-context";
import { PageHeader } from "./page-header";
import { Welcome } from "./welcome";

// The app's home: the Welcome steps until the widget has shown up on a site, then the Overview numbers.
export function HomeScreen() {
  const { bot } = useApp();
  if (bot.lastSeenAt) return <Overview key={bot.id} />;
  return (
    <>
      <PageHeader title="Welcome" sub="Your bot is almost ready. Three quick steps and it’s live." />
      <div className="flex min-h-0 grow flex-col overflow-y-auto px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
        <Welcome key={bot.id} bot={bot} />
      </div>
    </>
  );
}
