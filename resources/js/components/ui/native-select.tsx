import * as React from 'react';
import { cn } from '@/lib/utils';

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
    return (
        <select
            data-slot="native-select"
            className={cn(
                'h-10 w-full min-w-0 rounded-lg border border-input bg-glass-strong px-4 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(15_35_65/0.045)] outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:border-ring focus-visible:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground max-sm:min-h-11 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15',
                className,
            )}
            {...props}
        />
    );
}

export { NativeSelect };
