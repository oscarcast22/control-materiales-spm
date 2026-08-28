import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-5 shrink-0 rounded-md border border-input bg-glass-strong shadow-[inset_0_1px_2px_rgb(15_35_65/0.07)] outline-none transition-[background-color,border-color,box-shadow] data-[state=checked]:border-primary data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-primary data-[state=checked]:to-electric data-[state=checked]:text-primary-foreground data-[state=checked]:shadow-[0_3px_10px_rgb(22_74_140/0.2)] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-4" strokeWidth={2.5} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
