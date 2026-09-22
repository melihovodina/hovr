"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { cn } from "cn";
import { ArrowBadge, Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_LINKS } from "@/lib/landing";
import { prefersReducedMotion, smoothstep } from "@/lib/scroll";
import { MobileMenu } from "./mobile-menu";

// The pill settles over the first SHRINK_DISTANCE px of the page.
const SHRINK_DISTANCE = 340;
// Time constant of the approach to the target: ~90ms for 63% of the way, ~270ms for 95%.
const TAU = 0.09;
// Below this the remaining move is under a pixel: done, and worth stopping the loop for.
const SETTLED = 0.0005;
// A section counts as current while this line (just under the header) is inside it.
const ACTIVE_LINE = 140;

const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1));

// Writes the scroll progress (0 at the top, 1 once settled) to --header-p on the pill; the CSS in
// globals.css derives the width, background and shadow from it. The applied value eases towards the
// target instead of following scrollY, so a 100px wheel notch glides rather than jumps. Under reduced
// motion it snaps, and the CSS keeps the pill full width.
function useHeaderProgress(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let applied = 0;
    let frame = 0;
    let lastFrameAt = 0;

    const target = () => smoothstep(Math.max(window.scrollY, 0) / SHRINK_DISTANCE);
    const paint = (p: number) => ref.current?.style.setProperty("--header-p", p.toFixed(4));

    const tick = (now: number) => {
      const dt = Math.min((now - lastFrameAt) / 1000, 0.05);
      lastFrameAt = now;
      const goal = target();
      applied += (goal - applied) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(goal - applied) < SETTLED) {
        applied = goal;
        frame = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
      paint(applied);
    };

    const wake = () => {
      if (prefersReducedMotion()) {
        applied = target();
        paint(applied);
        return;
      }
      if (frame) return;
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(tick);
    };

    // A reload or back/forward restores the scroll position: start there instead of gliding in.
    applied = target();
    paint(applied);
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
    };
  }, [ref]);
}

// The nav's section currently under the header, or null (hero, closing CTA).
function useActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const current = SECTION_IDS.find((id) => {
        const rect = document.getElementById(id)?.getBoundingClientRect();
        return rect && rect.top <= ACTIVE_LINE && rect.bottom > ACTIVE_LINE;
      });
      setActive(current ?? null);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return active;
}

export function LandingHeader() {
  const pill = useRef<HTMLDivElement>(null);
  useHeaderProgress(pill);
  const active = useActiveSection();

  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-center px-3 sm:px-8 lg:h-28 lg:px-16">
      <div
        ref={pill}
        className="landing-pill flex h-14 items-center gap-1.5 rounded-full border border-line pr-1.5 pl-4 backdrop-blur-md lg:h-16 lg:pr-2 lg:pl-5"
      >
        <Logo href="#top" />
        <nav className="hidden grow justify-center gap-0.5 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => {
            const isActive = active === l.href.slice(1);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "flex h-10 items-center rounded-full px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors hover:bg-surface-2 hover:text-ink",
                  isActive ? "text-ink" : "text-subtle",
                )}
              >
                <span className="relative">
                  {l.label}
                  {/* Out of flow, 2px under the label, so it doesn't push the label off the row's centre. */}
                  <span
                    className={cn(
                      "absolute top-full left-1/2 mt-0.5 h-0.5 w-6 -translate-x-1/2 rounded-full bg-ink transition-opacity duration-150",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                </span>
              </a>
            );
          })}
        </nav>
        <span className="grow lg:hidden" />
        <ThemeToggle />
        <span className="mx-1 hidden h-6 w-px bg-line lg:block" />
        <Link href="/signin" className="hidden h-11 items-center px-3.5 text-[15px] font-bold whitespace-nowrap text-ink hover:opacity-75 lg:flex">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="hidden h-12 items-center gap-3 rounded-full bg-ink pr-1.5 pl-5 text-[15px] font-extrabold whitespace-nowrap text-page transition-opacity hover:opacity-90 lg:flex"
        >
          Get started
          <ArrowBadge />
        </Link>
        <div className="lg:hidden">
          <MobileMenu active={active} />
        </div>
      </div>
    </header>
  );
}
