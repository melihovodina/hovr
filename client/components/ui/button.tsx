import { cva, type VariantProps } from "class-variance-authority"

// Pill button styles, applied to links (every call to action on the landing is a link).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-3 rounded-full font-extrabold whitespace-nowrap transition-opacity outline-none select-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ink/25 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        strong: "bg-ink text-page",
        outline: "border border-line text-ink",
        raised: "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]",
        // Dark in both themes, for use on the lime block.
        night: "bg-on-lime text-paper",
      },
      size: {
        md: "h-11.5 px-5 text-[15px]",
        lg: "h-13.5 px-6 text-base",
        xl: "h-15 px-8 text-[17px]",
      },
    },
    defaultVariants: {
      variant: "strong",
      size: "md",
    },
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>

export { buttonVariants, type ButtonVariants }
