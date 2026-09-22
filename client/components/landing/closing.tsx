import Link from "next/link";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { FAQS, FOOTER_LINKS } from "@/lib/landing";
import { GUTTERS, LandingSection } from "./section";

export function Faq() {
  return (
    <LandingSection id="faq" title="Things people usually ask us">
      <div className="grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-10">
        {FAQS.map((f) => (
          <div key={f.q} className="flex flex-col gap-2.5 border-t-2 border-ink pt-5.5">
            <h3 className="text-[19px] leading-[1.3] font-extrabold tracking-[-0.01em]">{f.q}</h3>
            <p className="text-base leading-relaxed text-subtle">{f.a}</p>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}

export function FinalCta() {
  return (
    <section className={GUTTERS}>
      <div className="mx-auto flex max-w-328 flex-col items-center gap-6 rounded-4xl bg-lime px-6 py-16 text-center text-on-lime sm:px-16 lg:py-24">
        <h2 className="text-[40px] leading-[1.04] font-extrabold tracking-[-0.045em] sm:text-[52px] lg:text-[60px]">
          Try it with your own docs
        </h2>
        <p className="max-w-140 text-[17px] leading-[1.55] text-on-lime/72 sm:text-[19px]">
          Upload a file or paste some text. In a couple of minutes you’ll be chatting with a bot that knows your stuff.
        </p>
        <Link
          href="/signup"
          className={cn(buttonVariants({ variant: "night", size: "xl" }), "shadow-[0_20px_50px_-24px_rgba(13,14,17,0.5)]")}
        >
          Build your bot
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  // Phones: the wordmark fills the width between the gutters with its baseline on the bottom edge (Manrope 800,
  // -0.07em: ink 1.919em wide, 0.72em tall, 0.069em inset, baseline 0.117em up). From lg: 8px left of the content.
  return (
    <footer
      className={cn(
        "@container relative flex h-[max(12.5rem,calc((100vw-2rem)/1.919*0.72+2.5rem))] flex-col justify-end overflow-hidden pb-4.5 sm:h-50",
        GUTTERS,
      )}
    >
      <div
        className="pointer-events-none absolute bottom-[-0.117em] left-[calc(1rem-0.069em)] text-[calc(100cqw/1.919)] leading-none font-extrabold tracking-[-0.07em] text-surface-2 select-none sm:-top-1.5 sm:bottom-auto sm:left-7 sm:text-[240px] lg:left-[max(3.5rem,calc((100%-82rem)/2-0.5rem))]"
        aria-hidden="true"
      >
        hovr
      </div>
      <div className="relative mx-auto flex w-full max-w-328 flex-wrap items-center gap-x-7 gap-y-2">
        <span className="grow text-sm font-semibold text-subtle">© 2026 hovr</span>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm font-bold text-ink hover:opacity-75">
            {l.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
