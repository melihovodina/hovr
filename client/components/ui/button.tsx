import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[background-color,color,box-shadow,opacity,transform] outline-none select-none focus-visible:ring-3 focus-visible:ring-ink/25 active:not-disabled:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        lime: "bg-lime font-extrabold text-on-lime hover:bg-[#bde83a]",
        strong: "bg-ink font-extrabold text-page hover:opacity-90",
        secondary: "bg-surface text-ink shadow-[0_0_0_1px_var(--line)] hover:bg-surface-2",
        soft: "bg-page text-ink hover:bg-surface-2",
        ghost: "bg-transparent text-subtle hover:bg-surface-2 hover:text-ink",
        danger: "bg-bad-soft font-extrabold text-bad hover:opacity-90",
        link: "h-auto rounded-none px-0 text-ink underline underline-offset-4",
      },
      size: {
        xs: "h-8 px-3 text-[13px]",
        sm: "h-[38px] px-3.5 text-[13px]",
        md: "h-[42px] px-[18px] text-sm",
        lg: "h-[46px] px-5 text-sm",
        xl: "h-[54px] px-6 text-base",
        icon: "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "strong",
      size: "md",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
