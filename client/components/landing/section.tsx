import type { ReactNode } from "react";
import { cn } from "cn";

// Side padding every landing block shares, so the content edges line up down the page.
export const GUTTERS = "px-4 sm:px-8 lg:px-16";

// A titled landing section: shared gutters and spacing, content capped at 1312px, and an anchor that
// lands just below the header.
export function LandingSection({
  id,
  title,
  titleClassName,
  className,
  children,
}: {
  id: string;
  title: string;
  titleClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-(--header-h) pb-16 md:pb-24 lg:pb-35", GUTTERS)}>
      <div className={cn("mx-auto flex max-w-328 flex-col gap-7 lg:gap-12", className)}>
        <h2 className={cn("text-[36px] leading-[1.06] font-extrabold tracking-[-0.04em] sm:text-[44px] lg:text-[52px]", titleClassName)}>
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}
