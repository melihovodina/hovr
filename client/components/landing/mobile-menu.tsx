"use client";

import Link from "next/link";
import { ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { ArrowBadge } from "@/components/brand";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NAV_LINKS } from "@/lib/landing";

// Section links plus sign in / get started, for screens without room for the full header.
// `active` is the id of the section under the header; its link is highlighted.
export function MobileMenu({ active }: { active: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-page outline-none focus-visible:ring-3 focus-visible:ring-ink/25"
      >
        {open ? <X className="size-5" strokeWidth={2.2} /> : <Menu className="size-5" strokeWidth={2.2} />}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={14}
        alignOffset={-8}
        className="w-[calc(100vw-24px)] max-w-105 rounded-3xl p-2"
      >
        {NAV_LINKS.map((l) => {
          const isActive = active === l.href.slice(1);
          return (
            <DropdownMenuItem
              key={l.href}
              asChild
              className={cn("h-13 justify-between rounded-[18px] px-4 text-[17px]", isActive && "bg-surface-2 font-extrabold")}
            >
              <a href={l.href} aria-current={isActive ? "location" : undefined}>
                {l.label}
                <ChevronRight className="size-4.5 text-subtle" />
              </a>
            </DropdownMenuItem>
          );
        })}
        <div className="mx-3 my-2 h-px bg-line" />
        <div className="flex flex-col gap-2 p-1">
          <DropdownMenuItem asChild className="h-13 justify-center rounded-full bg-surface text-base font-extrabold shadow-[0_0_0_1px_var(--line)] focus:bg-surface-2">
            <Link href="/signin">Sign in</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="h-14 justify-between rounded-full bg-ink pr-1.5 pl-5.5 text-base font-extrabold text-page focus:bg-ink focus:text-page focus:opacity-90">
            <Link href="/signup">
              Get started
              <ArrowBadge />
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
