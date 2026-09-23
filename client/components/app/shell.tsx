"use client";

import { Menu, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand";
import { Notice } from "@/components/auth/fields";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { Billing, Bot, InboxItem, Me } from "@/lib/types";
import { AppContext, type AppState } from "./app-context";
import { Sidebar } from "./sidebar";

const LAST_BOT_KEY = "hovr-bot";

function rememberedBot(): string | null {
  try {
    return localStorage.getItem(LAST_BOT_KEY);
  } catch {
    return null;
  }
}

// Sidebar plus the floating main panel. Loads the account once and keeps the selected bot in ?bot=.
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [bots, setBots] = useState<Bot[] | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [inboxOpen, setInboxOpen] = useState(0);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

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
        if (err instanceof ApiError && err.status === 401) router.replace("/signin");
        else setError(errorMessage(err));
      });
    return () => ctrl.abort();
  }, [router, version]);

  const wanted = params.get("bot") ?? rememberedBot();
  const bot = bots?.find((b) => b.id === wanted) ?? bots?.[0] ?? null;

  useEffect(() => {
    if (bots && bots.length === 0) router.replace("/onboarding");
  }, [bots, router]);

  useEffect(() => {
    if (!bot) return;
    try {
      localStorage.setItem(LAST_BOT_KEY, bot.id);
    } catch {}
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
      <div className="min-h-dvh bg-app p-6">
        <Notice tone="bad">{error}</Notice>
      </div>
    );
  }
  if (!state) return <div className="min-h-dvh bg-app" />;

  return (
    <AppContext.Provider value={state}>
      <div className="flex min-h-dvh bg-app text-ink lg:h-dvh lg:gap-3 lg:p-3">
        <aside className="hidden w-58 shrink-0 lg:flex">
          <Sidebar />
        </aside>

        {/* Phones and tablets: a top bar, and the same sidebar in a sheet. */}
        {menuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex w-72 max-w-[85vw] bg-app p-3 shadow-[0_0_60px_rgba(0,0,0,0.35)]">
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </div>
            <button type="button" aria-label="Close menu" className="grow bg-black/30" onClick={() => setMenuOpen(false)} />
          </div>
        )}

        <div className="flex min-w-0 grow flex-col">
          <div className="flex h-16 items-center justify-between px-4 lg:hidden">
            <Logo href={state.href("/app")} />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="flex size-11 items-center justify-center rounded-full bg-ink text-page"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" strokeWidth={2.2} />}
            </button>
          </div>
          <main className="mx-3 mb-3 flex min-h-0 grow flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_0_0_1px_var(--line)] lg:m-0">
            {children}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
