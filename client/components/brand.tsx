"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { useTheme } from "@/lib/theme";

export function LogoMark({ size = 28, shadow = true }: { size?: number; shadow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
      <rect x="3" y="2" width="22" height="15" rx="7.5" fill="#C8F547" />
      <circle cx="9.5" cy="9.5" r="1.7" fill="#0D0E11" />
      <circle cx="14" cy="9.5" r="1.7" fill="#0D0E11" />
      <circle cx="18.5" cy="9.5" r="1.7" fill="#0D0E11" />
      {shadow && <ellipse cx="14" cy="24.5" rx="7" ry="1.8" fill="currentColor" opacity="0.2" />}
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 text-ink", className)} aria-label="hovr home">
      <LogoMark />
      <span className="text-[22px] font-extrabold tracking-[-0.03em]">hovr</span>
    </Link>
  );
}

export function ThemeToggle({ className, size = 44 }: { className?: string; size?: number }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ width: size, height: size }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      {dark ? <Sun className="size-[18px]" strokeWidth={1.8} /> : <Moon className="size-[18px]" strokeWidth={1.8} />}
    </button>
  );
}

export function ArrowBadge({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-lime text-on-lime", className)}
    >
      <svg width={size * 0.44} height={size * 0.44} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </span>
  );
}
