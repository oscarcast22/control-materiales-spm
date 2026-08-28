import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-sm font-semibold transition-[background-color,border-color,color,box-shadow,scale] duration-150 active:scale-[0.96] motion-reduce:transform-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/10 focus-visible:ring-[3px] focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-invalid:ring-danger/15 aria-invalid:border-danger",
  {
    variants: {
      variant: {
        default:
          "border border-primary bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(15_23_42/0.1),0_4px_12px_rgb(15_23_42/0.08)] hover:border-primary-hover hover:bg-primary-hover hover:shadow-[0_2px_4px_rgb(15_23_42/0.12),0_6px_16px_rgb(15_23_42/0.12)]",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground hover:brightness-95 focus-visible:ring-danger/15",
        outline:
          "border border-border bg-surface text-primary hover:bg-hover",
        secondary:
          "border border-border bg-secondary text-primary hover:bg-hover",
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
