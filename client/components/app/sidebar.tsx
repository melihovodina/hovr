"use client";

import { BookOpen, Check, ChevronDown, Home, Inbox, LogOut, MessageSquare, Palette, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { onColor, resetDate } from "@/lib/format";
import { useSignOut } from "@/lib/session";
import type { Billing, Bot } from "@/lib/types";
import { useApp } from "./app-context";

const NAV = [
  { path: "/app", label: "Overview", icon: Home },
  { path: "/app/playground", label: "Playground", icon: MessageSquare },
  { path: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { path: "/app/inbox", label: "Inbox", icon: Inbox },
  { path: "/app/widget", label: "Widget", icon: Palette },
];

export function BotAvatar({ bot, size = 32 }: { bot: Bot; size?: number }) {
  if (bot.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- a remote logo in a static export
    return <img src={bot.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      style={{ width: size, height: size, background: bot.color, color: onColor(bot.color) }}
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
      aria-hidden="true"
    >
      {bot.name.charAt(0).toUpperCase()}
    </span>
  );
}

function BotSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { bot, bots } = useApp();
  const pathname = usePathname();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="group flex h-12 w-full items-center gap-2.5 rounded-full bg-surface px-2 text-left shadow-[0_0_0_1px_var(--line)] outline-none focus-visible:ring-3 focus-visible:ring-ink/25">
        <BotAvatar bot={bot} />
        <span className="min-w-0 grow truncate text-sm font-bold">{bot.name}</span>
        <ChevronDown
          className="mr-1 size-4 shrink-0 text-subtle transition-transform duration-200 group-data-[state=open]:rotate-180"
          strokeWidth={2}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) rounded-[20px]">
        {bots.map((b) => (
          <DropdownMenuItem key={b.id} asChild>
            <Link href={`${pathname}?bot=${b.id}`} onClick={onNavigate}>
              <BotAvatar bot={b} size={24} />
              <span className="min-w-0 grow truncate">{b.name}</span>
              {b.id === bot.id && <Check className="size-4 text-subtle" strokeWidth={2.4} />}
            </Link>
          </DropdownMenuItem>
        ))}
        <div className="mx-2 my-1.5 h-px bg-line" />
        <DropdownMenuItem asChild>
          <Link href="/onboarding?new=1" onClick={onNavigate}>
            <span className="flex size-6 items-center justify-center rounded-full bg-surface-2">
              <Plus className="size-3.5" strokeWidth={2.4} />
            </span>
            Add a bot
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NEXT_PLAN: Record<string, string> = {
  free: "Pro gives you 2,000.",
  pro: "Business gives you 10,000.",
};

function PlanCard({ billing, onNavigate }: { billing: Billing; onNavigate?: () => void }) {
  const { href } = useApp();
  const used = billing.usage.messages;
  const limit = billing.limits.messagesPerMonth;
  const share = Math.min(100, Math.round((used / limit) * 100));
  return (
    <Link
      href={href("/app/billing")}
      onClick={onNavigate}
      aria-label={`${billing.planName} plan: ${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} messages used this month. Open billing`}
      className="flex flex-col gap-2.5 rounded-[22px] bg-ink p-4 text-page transition-opacity hover:opacity-95"
    >
      <span className="flex justify-between text-[13px] font-bold">
        <span>{billing.planName} plan</span>
        <span className="opacity-70">
          {used.toLocaleString("en-US")} of {limit.toLocaleString("en-US")}
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-page/20">
        <span className="block h-full origin-left animate-grow-right rounded-full bg-lime transition-[width] duration-500" style={{ width: `${share}%` }} />
      </span>
      <span className="text-[13px] leading-snug opacity-80">
        Messages reset on {resetDate()}. {NEXT_PLAN[billing.plan] ?? ""}
      </span>
    </Link>
  );
}

function UserRow() {
  const { me } = useApp();
  const signOut = useSignOut();
  return (
    <div className="flex items-center gap-1 pl-2">
      <span className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-extrabold uppercase">
        {me.email.slice(0, 2)}
      </span>
      <span className="ml-1.5 min-w-0 grow truncate text-xs text-subtle" title={me.email}>
        {me.email}
      </span>
      <ThemeToggle className="size-9" />
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <LogOut className="size-4" strokeWidth={1.9} />
      </button>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { href, inboxOpen, billing } = useApp();
  const pathname = usePathname();
  const current = NAV.findIndex(({ path }) => pathname === path || pathname === `${path}/`);
  return (
    <div className="flex w-full flex-col gap-5.5 px-1.5 py-3">
      <div className="px-2.5">
        <Wordmark />
      </div>
      <BotSwitcher onNavigate={onNavigate} />
      <nav className="relative flex flex-col gap-0.5" aria-label="App">
        {/* One highlight for the current screen that glides between items (each 2.625rem + a 0.125rem gap). */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-x-0 top-0 h-10.5 rounded-full bg-surface shadow-[0_0_0_1px_var(--line)] transition-[transform,opacity] duration-300 ease-out",
            current < 0 && "opacity-0",
          )}
          style={{ transform: `translateY(${Math.max(current, 0) * 2.75}rem)` }}
        />
        {NAV.map(({ path, label, icon: Icon }, i) => {
          const active = i === current;
          return (
            <Link
              key={path}
              href={href(path)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={label === "Inbox" && inboxOpen > 0 ? `Inbox, ${inboxOpen} open` : undefined}
              className={cn(
                "relative flex h-10.5 items-center gap-3 rounded-full px-3.5 text-sm font-bold transition-colors duration-300",
                active ? "text-ink" : "text-subtle hover:text-ink",
              )}
            >
              <Icon className="size-4.5" strokeWidth={1.9} aria-hidden="true" />
              <span className="grow">{label}</span>
              {label === "Inbox" && inboxOpen > 0 && (
                <span className="flex h-5.5 min-w-5.5 animate-in items-center justify-center rounded-full bg-lime px-1.75 text-xs font-extrabold text-on-lime duration-300 zoom-in-50">
                  {inboxOpen}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="grow" />
      {billing && <PlanCard billing={billing} onNavigate={onNavigate} />}
      <UserRow />
    </div>
  );
}
