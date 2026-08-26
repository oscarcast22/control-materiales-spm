import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function FormField({
    className,
    invalid = false,
    ...props
}: React.ComponentProps<'div'> & { invalid?: boolean }) {
    return (
        <div
            data-slot="form-field"
            data-invalid={invalid || undefined}
            className={cn('flex min-w-0 flex-col gap-2', className)}
            {...props}
        />
    );
}

function FormLabel({
    optional,
    children,
    className,
    ...props
}: React.ComponentProps<typeof Label> & { optional?: boolean }) {
    return (
        <Label
            className={cn(
                'text-[13px] leading-4 font-medium text-text-secondary',
                className,
            )}
            {...props}
        >
            {children}
            {optional && (
                <span className="ml-1 font-normal text-muted-foreground">
                    (opcional)
                </span>
            )}
        </Label>
    );
}

function FormDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="form-description"
            className={cn('text-xs leading-5 text-muted-foreground', className)}
            {...props}
        />
    );
}

export { FormDescription, FormField, FormLabel };
