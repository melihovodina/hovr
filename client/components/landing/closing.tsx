import Link from "next/link";
import { FAQS } from "@/lib/landing";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 px-4 pb-16 sm:px-8 md:pb-24 lg:px-16 lg:pb-[140px]">
      <div className="mx-auto flex max-w-[1312px] flex-col gap-7 lg:gap-12">
        <h2 className="text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]">
          Things people usually ask us
        </h2>
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-y-10">
          {FAQS.map((f) => (
            <div key={f.q} className="flex flex-col gap-2.5 border-t-2 border-ink pt-[22px]">
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
      <div className="mx-auto flex max-w-[1312px] flex-col items-center gap-6 rounded-[36px] bg-lime px-6 py-16 text-center text-on-lime sm:px-16 lg:py-24">
        <h2 className="text-[40px] leading-[1.04] font-extrabold tracking-[-0.045em] sm:text-[52px] lg:text-[60px]">
          Try it with your own docs
        </h2>
        <p className="max-w-[560px] text-[17px] leading-[1.55] text-[rgba(13,14,17,0.72)] sm:text-[19px]">
          Upload a file or paste some text. In a couple of minutes you’ll be chatting with a bot that knows your stuff.
        </p>
        <Link
          href="/signup"
          className="flex h-[60px] items-center rounded-full bg-[#0D0E11] px-8 text-[17px] font-extrabold text-[#F3F2EE] shadow-[0_20px_50px_-24px_rgba(13,14,17,0.5)] transition-opacity hover:opacity-90"
        >
          Build your bot
        </Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative flex h-[200px] flex-col justify-end overflow-hidden px-4 pb-[18px] sm:px-8 lg:px-16">
      <div
        className="pointer-events-none absolute -top-1.5 left-3 text-[160px] leading-none font-extrabold tracking-[-0.07em] text-surface-2 select-none sm:left-7 sm:text-[240px] lg:left-14"
        aria-hidden="true"
      >
        hovr
      </div>
      <div className="relative mx-auto flex w-full max-w-[1312px] flex-wrap items-center gap-x-7 gap-y-2">
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
