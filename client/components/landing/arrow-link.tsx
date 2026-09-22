import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "cn";
import { ArrowBadge } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";

const SIZES = {
  md: { className: "h-12 pr-1.5 pl-5 text-[15px]", badge: 36 },
  lg: { className: "h-15 gap-4 pr-2 pl-6.5 text-[17px]", badge: 44 },
};

// The main call to action: a dark pill with the label and a lime arrow circle at its end.
export function ArrowLink({
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { size?: keyof typeof SIZES }) {
  return (
    <Link className={cn(buttonVariants(), "justify-between", SIZES[size].className, className)} {...props}>
      {children}
      <ArrowBadge size={SIZES[size].badge} />
    </Link>
  );
}
