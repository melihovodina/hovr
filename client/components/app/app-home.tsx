"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Notice } from "@/components/auth/fields";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAccount, useSignOut } from "@/lib/session";
import { Welcome } from "./welcome";

// The app's home. For now one panel with the Welcome steps; the sidebar and bot switcher come with the app shell.
export function AppHome() {
  const router = useRouter();
  const signOut = useSignOut();
  const { account, error } = useAccount();
  const bot = account?.bots[0];

  useEffect(() => {
    if (account && !bot) router.replace("/onboarding");
  }, [account, bot, router]);

  // Nothing to show yet, or on the way to onboarding.
  if (!bot) {
    return <div className="min-h-dvh bg-app p-3">{error && <Notice tone="bad">{error}</Notice>}</div>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app p-3 text-ink">
      <main className="flex grow flex-col rounded-[26px] bg-surface shadow-[0_0_0_1px_var(--line)]">
        <header className="flex min-h-19 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-7">
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <h1 className="text-[22px] font-extrabold tracking-[-0.02em]">Welcome</h1>
            <p className="text-sm text-subtle">Your bot is almost ready. Three quick steps and it’s live.</p>
          </div>
          {bot.lastSeenHost && (
            <span className="flex h-10.5 items-center gap-2 rounded-full bg-surface-2 pr-4 pl-3 text-sm font-bold">
              <span className="size-2 rounded-full bg-online" aria-hidden="true" />
              Live on {bot.lastSeenHost}
            </span>
          )}
          <ThemeToggle />
          <button type="button" onClick={signOut} className="text-sm font-bold text-subtle hover:text-ink">
            Sign out
          </button>
        </header>
        <div className="flex grow flex-col px-5 pt-1 pb-5 sm:px-7 sm:pb-7">
          <Welcome bot={bot} />
        </div>
      </main>
    </div>
  );
}
