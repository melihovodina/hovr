import type { ReactNode } from "react";
import { Logo } from "@/components/brand";

// Sign in, sign up and password pages: the logo up top, one narrow column in the middle.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page p-4 text-ink">
      <div className="px-2 py-2 sm:px-8 sm:py-5">
        <Logo />
      </div>
      {/* The bottom padding offsets the logo row and lifts the column a little more, so the
          inputs sit near the middle of the window rather than below it. */}
      <main className="flex grow items-center justify-center px-2 pt-6 pb-[calc(3rem+8vh)] sm:pb-[calc(4.25rem+10vh)]">
        <div className="flex w-full max-w-100 flex-col gap-5.5 text-center">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[36px] leading-[1.1] font-extrabold tracking-[-0.04em]">{title}</h1>
      {children && <p className="text-base leading-normal text-subtle">{children}</p>}
    </div>
  );
}
