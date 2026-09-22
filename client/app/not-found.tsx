import Link from "next/link";
import { Logo } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-page p-4 text-ink">
      <div className="px-2 py-2 sm:px-8 sm:py-5">
        <Logo />
      </div>
      <main className="flex grow flex-col items-center justify-center gap-5 py-10 text-center">
        <p className="text-sm font-extrabold text-subtle">404</p>
        <h1 className="max-w-130 text-[36px] leading-[1.1] font-extrabold tracking-[-0.04em]">
          This page isn’t here
        </h1>
        <p className="max-w-105 text-base leading-relaxed text-subtle">The link may be old or mistyped.</p>
        <Link href="/" className={buttonVariants({ size: "lg" })}>
          Go to the home page
        </Link>
      </main>
    </div>
  );
}
