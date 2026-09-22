"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "cn";
import { toggleTheme } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-ink",
        className,
      )}
    >
      <Moon className="size-[18px] dark:hidden" strokeWidth={1.8} aria-hidden="true" />
      <Sun className="hidden size-[18px] dark:block" strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
