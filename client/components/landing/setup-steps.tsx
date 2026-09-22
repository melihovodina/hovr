"use client";

import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { headerHeight, prefersReducedMotion } from "@/lib/scroll";

type Step = { title: string; body: string };

// Explicit rows so the steps sit centred next to the panel (first and last row take the slack).
const ROW_START = ["lg:row-start-2", "lg:row-start-3", "lg:row-start-4"];

// Tailwind's lg breakpoint, where the steps become tabs with one panel on the right.
const DESKTOP = "(min-width: 64rem)";

// Room left between the sticky header and an opened step.
const STEP_GAP = 12;
// Matches the panel's grow/shrink, so the page and the panel move together.
const SCROLL_MS = 340;

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Eases a step up to the top of the page. Re-measuring on every frame keeps it on track
// while the panel above it shrinks and its own panel grows.
function scrollStepIntoPlace(el: HTMLElement) {
  const target = headerHeight() + STEP_GAP;
  if (prefersReducedMotion()) {
    window.scrollBy(0, el.getBoundingClientRect().top - target);
    return;
  }
  const from = el.getBoundingClientRect().top;
  const start = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / SCROLL_MS);
    const want = from + (target - from) * easeOut(t);
    window.scrollBy(0, el.getBoundingClientRect().top - want);
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// One step open at a time. Small screens: the panel sits under its step, and tapping the open step closes it.
// From lg one step always stays open and the grid puts its panel in the right column, inside one card.
export function SetupSteps({ steps, panels }: { steps: Step[]; panels: ReactNode[] }) {
  const [open, setOpen] = useState<number | null>(0);
  // The tapped step: held in place while the layout changes, then eased up to the top.
  const tapped = useRef<{ el: HTMLElement; top: number; opening: boolean } | null>(null);

  useLayoutEffect(() => {
    const step = tapped.current;
    tapped.current = null;
    if (!step) return;
    // Keep the step under the finger while the panels resize.
    window.scrollBy(0, step.el.getBoundingClientRect().top - step.top);
    if (step.opening && !matchMedia(DESKTOP).matches) scrollStepIntoPlace(step.el);
  }, [open]);

  function toggle(i: number, el: HTMLElement) {
    // On desktop the panel column would be left empty, so the open step stays open.
    const closing = open === i && !matchMedia(DESKTOP).matches;
    tapped.current = { el, top: el.getBoundingClientRect().top, opening: !closing };
    setOpen(closing ? null : i);
  }

  return (
    <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[1fr_auto_auto_auto_1fr] lg:gap-x-12 lg:rounded-4xl lg:border lg:border-line lg:bg-surface lg:p-18">
      {steps.map((s, i) => {
        const isOpen = open === i;
        return (
          <div
            key={s.title}
            className={cn(
              "rounded-[22px] bg-surface transition-shadow lg:contents",
              isOpen ? "shadow-[0_0_0_2px_var(--ink)]" : "shadow-[0_0_0_1px_var(--line)]",
            )}
          >
            <button
              id={`setup-step-${i}`}
              type="button"
              aria-expanded={isOpen}
              aria-controls={`setup-panel-${i}`}
              onClick={(e) => toggle(i, e.currentTarget)}
              className={cn(
                "flex w-full items-start gap-3 rounded-[22px] px-5.5 py-5 text-left lg:col-start-1 lg:transition-colors",
                ROW_START[i],
                isOpen ? "lg:bg-page lg:shadow-[0_0_0_2px_var(--ink)]" : "lg:hover:bg-page/60",
              )}
            >
              <span className="flex grow flex-col gap-1.5">
                <span className="text-[19px] font-extrabold tracking-[-0.01em]">{s.title}</span>
                <span className="text-[15px] leading-normal text-subtle">{s.body}</span>
              </span>
              <ChevronDown
                className={cn("mt-1 size-5 shrink-0 text-subtle transition-transform lg:hidden", isOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            {/* Small screens: the panel grows and shrinks in place under its step.
                From lg up it simply takes the right column, with nothing to animate. */}
            <div
              id={`setup-panel-${i}`}
              role="region"
              aria-labelledby={`setup-step-${i}`}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                "lg:col-start-2 lg:row-span-5 lg:row-start-1 lg:block",
                !isOpen && "lg:hidden",
              )}
            >
              <div className="overflow-hidden lg:overflow-visible">
                <div className="mx-2.5 mb-2.5 flex min-w-0 flex-col justify-center rounded-[18px] bg-page p-4 lg:m-0 lg:h-125 lg:rounded-3xl lg:p-10">
                  {panels[i]}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
