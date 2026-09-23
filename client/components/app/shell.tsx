"use client";

import { Menu, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { isSignedOut } from "@/lib/session";
import { readLocal, writeLocal } from "@/lib/storage";
import type { Billing, Bot, InboxItem, Me } from "@/lib/types";
import { AppContext, type AppState } from "./app-context";
import { LoadError } from "./load-error";
import { Sidebar } from "./sidebar";

const LAST_BOT_KEY = "hovr-bot";

// Sidebar plus the floating main panel. Loads the account once and keeps the selected bot in ?bot=.
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [inboxOpen, setInboxOpen] = useState(0);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [menu, setMenu] = useState<"closed" | "open" | "closing">("closed");
  const closeMenu = useCallback(() => setMenu((m) => (m === "open" ? "closing" : m)), []);

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    Promise.all([api<Me>("/me", { signal }), api<{ bots: Bot[] }>("/bots", { signal }), api<Billing>("/billing", { signal })])
      .then(([m, { bots: list }, b]) => {
        setMe(m);
        setBots(list);
        setBilling(b);
      })
      .catch((err) => {
        if (signal.aborted) return;
        if (isSignedOut(err)) router.replace("/signin");
        else setError(errorMessage(err));
      });
    return () => ctrl.abort();
  }, [router, version]);

  const wanted = params.get("bot") ?? readLocal(LAST_BOT_KEY);
  const bot = bots?.find((b) => b.id === wanted) ?? bots?.[0] ?? null;

  useEffect(() => {
    if (bots && bots.length === 0) router.replace("/onboarding");
  }, [bots, router]);

  useEffect(() => {
    if (!bot) return;
    writeLocal(LAST_BOT_KEY, bot.id);
    const ctrl = new AbortController();
    api<{ items: InboxItem[] }>(`/bots/${bot.id}/inbox?status=open`, { signal: ctrl.signal })
      .then(({ items }) => setInboxOpen(items.length))
      .catch(() => {});
    return () => ctrl.abort();
  }, [bot, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const updateBot = useCallback((next: Bot) => setBots((list) => list?.map((b) => (b.id === next.id ? next : b)) ?? null), []);

  const state = useMemo<AppState | null>(() => {
    if (!me || !bots || !bot) return null;
    return {
      me,
      bots,
      bot,
      billing,
      inboxOpen,
      href: (path) => `${path}?bot=${bot.id}`,
      reload,
      updateBot,
    };
  }, [me, bots, bot, billing, inboxOpen, reload, updateBot]);

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-app p-6">
        <Wordmark />
        <div className="w-full max-w-110">
          <LoadError
            message={error}
            onRetry={() => {
              setError("");
              reload();
            }}
          />
        </div>
      </div>
    );
  }
  if (!state) return <ShellSkeleton />;

  return (
    <AppContext.Provider value={state}>
      <div className="flex h-dvh bg-app text-ink lg:gap-3 lg:p-3">
        <aside className="hidden w-58 shrink-0 lg:flex">
          <Sidebar />
        </aside>

        {/* Phones and tablets: a top bar, and the same sidebar in a sheet that slides in from the left. */}
        {menu !== "closed" && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              aria-label="Close menu"
              className={cn("absolute inset-0 bg-black/30 duration-300", menu === "closing" ? "animate-out fade-out-0" : "animate-in fade-in-0")}
              onClick={closeMenu}
            />
            <div
              className={cn(
                "relative flex h-full w-72 max-w-[85vw] bg-app p-3 shadow-[0_0_60px_rgba(0,0,0,0.35)] duration-300 ease-out",
                menu === "closing" ? "animate-out slide-out-to-left" : "animate-in slide-in-from-left",
              )}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && menu === "closing") setMenu("closed");
              }}
            >
              <Sidebar onNavigate={closeMenu} />
            </div>
          </div>
        )}

        <div className="flex min-h-0 min-w-0 grow flex-col">
          <div className="flex h-16 shrink-0 items-center justify-between px-4 lg:hidden">
            <Wordmark />
            <button
              type="button"
              onClick={() => setMenu("open")}
              aria-label="Open menu"
              className="flex size-11 items-center justify-center rounded-full bg-ink text-page"
            >
              {menu === "open" ? <X className="size-5" /> : <Menu className="size-5" strokeWidth={2.2} />}
            </button>
          </div>
          <main className="mx-3 mb-3 flex min-h-0 grow flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_0_0_1px_var(--line)] lg:m-0">
            {/* Keyed by screen and bot, so each one rises in when it opens. */}
            <div key={`${pathname}:${state.bot.id}`} className="flex min-h-0 grow animate-rise flex-col">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}

// The shell's outline while the account loads, so the page doesn't flash empty.
function ShellSkeleton() {
  return (
    <div className="flex h-dvh bg-app lg:gap-3 lg:p-3" aria-busy="true" aria-label="Loading">
      <div className="hidden w-58 shrink-0 flex-col gap-3 py-1 lg:flex">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="mt-3 h-12 rounded-full" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 rounded-full" />
        ))}
        <Skeleton className="mt-auto h-28 rounded-[22px]" />
      </div>
      <div className="flex min-w-0 grow flex-col pt-16 lg:pt-0">
        <div className="mx-3 mb-3 flex grow flex-col gap-4 rounded-[26px] bg-surface p-5 shadow-[0_0_0_1px_var(--line)] sm:p-7 lg:m-0">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
          <Skeleton className="mt-3 h-40 rounded-[22px]" />
          <Skeleton className="grow rounded-[22px]" />
        </div>
      </div>
    </div>
  );
}
