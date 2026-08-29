import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-surface-raised px-4 py-2 text-base shadow-[inset_0_1px_2px_rgb(15_35_65/0.035)] transition-[background-color,border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-muted-foreground/75 hover:border-border-strong focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground aria-invalid:border-danger aria-invalid:ring-danger/15 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
