"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "cn";

type Step = { title: string; body: string };

const KEY_STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

// Tab switching only; the panels are server-rendered and passed in, all kept in the HTML.
export function SetupTabs({ steps, panels }: { steps: Step[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent) {
    const delta = KEY_STEP[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + steps.length) % steps.length;
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      <div className="flex shrink-0 flex-col gap-2.5 lg:w-[400px]" role="tablist" aria-label="Setup steps" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {steps.map((s, i) => (
          <button
            key={s.title}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`setup-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-controls={`setup-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              "flex flex-col gap-1.5 rounded-[20px] border-2 px-[22px] py-5 text-left transition-colors",
              active === i ? "border-ink bg-page" : "border-transparent hover:bg-page/60",
            )}
          >
            <span className="text-[19px] font-extrabold tracking-[-0.01em]">{s.title}</span>
            <span className="text-[15px] leading-normal text-subtle">{s.body}</span>
          </button>
        ))}
      </div>
      {panels.map((panel, i) => (
        <div
          key={i}
          id={`setup-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`setup-tab-${i}`}
          hidden={active !== i}
          className="min-h-[440px] grow flex-col justify-center rounded-3xl bg-page p-6 [&:not([hidden])]:flex sm:p-10"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
