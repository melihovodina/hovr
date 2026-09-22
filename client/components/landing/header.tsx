import Link from "next/link";
import { ArrowBadge, Logo } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_LINKS } from "@/lib/landing";
import { MobileMenu } from "./mobile-menu";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-[80px] items-center justify-center px-3 sm:px-8 lg:h-[112px] lg:px-16">
      <div className="flex h-14 w-full max-w-[1080px] items-center gap-1.5 rounded-full border border-line bg-[var(--nav-bg)] pr-1.5 pl-4 shadow-[0_10px_30px_-12px_var(--nav-shadow)] backdrop-blur-md lg:h-16 lg:pr-2 lg:pl-5">
        <Logo href="#top" />
        <nav className="hidden grow justify-center gap-0.5 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="flex h-10 items-center rounded-full px-3.5 text-[15px] font-semibold text-subtle transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <span className="grow lg:hidden" />
        <ThemeToggle />
        <span className="mx-1 hidden h-6 w-px bg-line lg:block" />
        <Link href="/signin" className="hidden h-11 items-center px-3.5 text-[15px] font-bold text-ink hover:opacity-75 lg:flex">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="hidden h-12 items-center gap-3 rounded-full bg-ink pr-1.5 pl-5 text-[15px] font-extrabold text-page transition-opacity hover:opacity-90 lg:flex"
        >
          Get started
          <ArrowBadge />
        </Link>
        <div className="lg:hidden">
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
