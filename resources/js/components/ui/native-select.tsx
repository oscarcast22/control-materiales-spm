import * as React from 'react';
import { cn } from '@/lib/utils';

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
    return (
        <select
            data-slot="native-select"
            className={cn(
                'h-10 w-full min-w-0 rounded border border-input bg-surface px-4 text-sm text-foreground outline-none transition-[background-color,border-color,box-shadow] duration-150 hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-muted-foreground max-sm:min-h-11 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/15',
                className,
            )}
            {...props}
        />
    );
}

export { NativeSelect };
