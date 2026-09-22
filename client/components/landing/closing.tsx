import Link from "next/link";
import { FAQS } from "@/lib/landing";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 px-4 pb-16 sm:px-8 md:pb-24 lg:px-16 lg:pb-35">
      <div className="mx-auto flex max-w-328 flex-col gap-7 lg:gap-12">
        <h2 className="text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]">
          Things people usually ask us
        </h2>
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-10">
          {FAQS.map((f) => (
            <div key={f.q} className="flex flex-col gap-2.5 border-t-2 border-ink pt-5.5">
              <h3 className="text-[19px] leading-[1.3] font-extrabold tracking-[-0.01em]">{f.q}</h3>
              <p className="text-base leading-relaxed text-subtle">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-4 sm:px-8 lg:px-16">
      <div className="mx-auto flex max-w-328 flex-col items-center gap-6 rounded-4xl bg-lime px-6 py-16 text-center text-on-lime sm:px-16 lg:py-24">
        <h2 className="text-[40px] leading-[1.04] font-extrabold tracking-[-0.045em] sm:text-[52px] lg:text-[60px]">
          Try it with your own docs
        </h2>
        <p className="max-w-140 text-[17px] leading-[1.55] text-[rgba(13,14,17,0.72)] sm:text-[19px]">
          Upload a file or paste some text. In a couple of minutes you’ll be chatting with a bot that knows your stuff.
        </p>
        <Link
          href="/signup"
          className="flex h-15 items-center rounded-full bg-on-lime px-8 text-[17px] font-extrabold text-[#F3F2EE] shadow-[0_20px_50px_-24px_rgba(13,14,17,0.5)] transition-opacity hover:opacity-90"
        >
          Build your bot
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  // Phones: the wordmark spans the footer between the 1rem gutters and sits on its bottom edge,
  // whatever the screen width; on wide phones the footer grows so the letters keep 2.5rem above them.
  // Measured on Manrope 800 at -0.07em: the ink is 1.919em wide and 0.72em tall above
  // the baseline, starts 0.069em in from the text box, and the baseline is 0.117em above the box's bottom.
  // The baseline sits on the edge, so the stems touch it (the round "o" dips 0.015em below and is cut).
  // From lg the wordmark keeps the design's place, 8px left of the content, which centres at 1312px
  // on big screens, so it follows the content's left edge rather than the window's.
  return (
    <footer className="@container relative flex h-[max(12.5rem,calc((100vw-2rem)/1.919*0.72+2.5rem))] flex-col justify-end overflow-hidden px-4 pb-4.5 sm:h-50 sm:px-8 lg:px-16">
      <div
        className="pointer-events-none absolute bottom-[-0.117em] left-[calc(1rem-0.069em)] text-[calc(100cqw/1.919)] leading-none font-extrabold tracking-[-0.07em] text-surface-2 select-none sm:-top-1.5 sm:bottom-auto sm:left-7 sm:text-[240px] lg:left-[max(3.5rem,calc((100%-82rem)/2-0.5rem))]"
        aria-hidden="true"
      >
        hovr
      </div>
      <div className="relative mx-auto flex w-full max-w-328 flex-wrap items-center gap-x-7 gap-y-2">
        <span className="grow text-sm font-semibold text-subtle">© 2026 hovr</span>
        <a href="#pricing" className="text-sm font-bold text-ink hover:opacity-75">
          Pricing
        </a>
        <a href="#faq" className="text-sm font-bold text-ink hover:opacity-75">
          FAQ
        </a>
        <Link href="/signin" className="text-sm font-bold text-ink hover:opacity-75">
          Sign in
        </Link>
      </div>
    </footer>
  );
}
