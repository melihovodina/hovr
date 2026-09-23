"use client";

import { useApp } from "./app-context";
import { PageHeader } from "./page-header";
import { Welcome } from "./welcome";

// The app's home: the Welcome steps for now; the Overview numbers come in a later step.
export function HomeScreen() {
  const { bot } = useApp();
  return (
    <>
      <PageHeader
        title="Welcome"
        sub="Your bot is almost ready. Three quick steps and it’s live."
        aside={
          bot.lastSeenHost && (
            <span className="flex h-10.5 items-center gap-2 rounded-full bg-surface-2 pr-4 pl-3 text-sm font-bold">
              <span className="size-2 rounded-full bg-online" aria-hidden="true" />
              Live on {bot.lastSeenHost}
            </span>
          )
        }
      />
      <div className="flex grow flex-col overflow-y-auto px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
        <Welcome key={bot.id} bot={bot} />
      </div>
    </>
  );
}
