import * as React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="field-group"
            className={cn('flex w-full flex-col gap-5', className)}
            {...props}
        />
    );
}

function Field({
    className,
    invalid = false,
    ...props
}: React.ComponentProps<'div'> & { invalid?: boolean }) {
    return (
        <div
            role="group"
            data-slot="field"
            data-invalid={invalid || undefined}
            className={cn(
                'group/field flex min-w-0 flex-col gap-2 data-[invalid=true]:text-danger',
                className,
            )}
            {...props}
        />
    );
}

function FieldLabel({
    className,
    ...props
}: React.ComponentProps<typeof Label>) {
    return (
        <Label
            data-slot="field-label"
            className={cn(
                'text-[13px] leading-4 font-semibold text-text-secondary group-data-[invalid=true]/field:text-danger',
                className,
            )}
            {...props}
        />
    );
}

function FieldDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="field-description"
            className={cn('text-xs leading-5 text-muted-foreground', className)}
            {...props}
        />
    );
}

function FieldError({
    className,
    children,
    ...props
}: React.ComponentProps<'p'>) {
    if (!children) {
        return null;
    }

    return (
        <p
            role="alert"
            data-slot="field-error"
            className={cn('text-sm leading-5 text-danger', className)}
            {...props}
        >
            {children}
        </p>
    );
}

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel };
