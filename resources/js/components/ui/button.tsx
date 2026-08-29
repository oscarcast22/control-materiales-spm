import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[background-color,border-color,color,box-shadow,filter] duration-150 active:brightness-[0.97] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/15 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-danger/15 aria-invalid:border-danger",
  {
    variants: {
      variant: {
        default:
          "border border-primary/90 bg-gradient-to-b from-primary to-primary-hover text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_2px_4px_rgb(12_40_77/0.18),0_8px_20px_rgb(22_74_140/0.16)] hover:border-primary-hover hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_3px_6px_rgb(12_40_77/0.2),0_10px_24px_rgb(22_74_140/0.2)]",
        destructive:
          "border border-destructive bg-gradient-to-b from-destructive to-danger text-destructive-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_6px_16px_rgb(180_35_24/0.16)] hover:brightness-95 focus-visible:ring-danger/15",
        outline:
          "border border-border-strong bg-glass-strong text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_2px_8px_rgb(25_55_90/0.05)] backdrop-blur-lg hover:border-primary/30 hover:bg-hover",
        secondary:
          "border border-border bg-secondary text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.38)] hover:bg-hover",
        ghost: "text-primary hover:bg-hover hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 max-sm:min-h-11 has-[>svg]:px-3",
        sm: "h-9 px-3 max-sm:min-h-11 has-[>svg]:px-2.5",
        lg: "h-11 px-5 has-[>svg]:px-4",
        icon: "size-10 max-sm:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
