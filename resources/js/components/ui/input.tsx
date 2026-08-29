import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input file:text-foreground placeholder:text-muted-foreground/75 selection:bg-primary-subtle selection:text-foreground flex h-10 w-full min-w-0 rounded-lg border bg-surface-raised px-4 py-2 text-base shadow-[inset_0_1px_2px_rgb(15_35_65/0.035)] transition-[background-color,border-color,box-shadow] duration-150 ease-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium read-only:bg-surface-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground max-sm:min-h-11 md:text-sm",
        "hover:border-border-strong focus-visible:border-ring focus-visible:bg-surface-raised focus-visible:ring-ring/10 focus-visible:ring-[3px]",
        "aria-invalid:border-danger aria-invalid:ring-danger/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
