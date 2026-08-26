import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:ring-ring/30 focus-visible:ring-[3px] aria-invalid:border-danger",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-subtle text-primary [a&]:hover:bg-selected",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-hover",
        destructive:
          "border-transparent bg-danger-subtle text-danger [a&]:hover:brightness-95 focus-visible:ring-danger/25",
        outline:
          "border-border-strong bg-surface text-text-secondary [a&]:hover:bg-hover [a&]:hover:text-foreground",
        success: "border-transparent bg-success-subtle text-success",
        warning: "border-transparent bg-warning-subtle text-warning",
        info: "border-transparent bg-info-subtle text-info",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
