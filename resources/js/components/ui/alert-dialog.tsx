import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function AlertDialog(props: ComponentProps<typeof AlertDialogPrimitive.Root>) {
    return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger(
    props: ComponentProps<typeof AlertDialogPrimitive.Trigger>,
) {
    return (
        <AlertDialogPrimitive.Trigger
            data-slot="alert-dialog-trigger"
            {...props}
        />
    );
}

function AlertDialogPortal(
    props: ComponentProps<typeof AlertDialogPrimitive.Portal>,
) {
    return (
        <AlertDialogPrimitive.Portal
            data-slot="alert-dialog-portal"
            {...props}
        />
    );
}

function AlertDialogOverlay({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
    return (
        <AlertDialogPrimitive.Overlay
            data-slot="alert-dialog-overlay"
            className={cn(
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md duration-150',
                className,
            )}
            {...props}
        />
    );
}

function AlertDialogContent({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Content>) {
    return (
        <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogPrimitive.Content
                data-slot="alert-dialog-content"
                className={cn(
                    'glass-panel-strong data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-5 overflow-y-auto rounded-2xl border p-5 duration-150 sm:max-w-lg sm:p-6',
                    className,
                )}
                {...props}
            />
        </AlertDialogPortal>
    );
}

function AlertDialogHeader({
    className,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-dialog-header"
            className={cn('flex flex-col gap-2 text-left', className)}
            {...props}
        />
    );
}

function AlertDialogFooter({
    className,
    ...props
}: ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-dialog-footer"
            className={cn(
                'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
                className,
            )}
            {...props}
        />
    );
}

function AlertDialogTitle({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Title>) {
    return (
        <AlertDialogPrimitive.Title
            data-slot="alert-dialog-title"
            className={cn('text-lg leading-6 font-semibold', className)}
            {...props}
        />
    );
}

function AlertDialogDescription({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            data-slot="alert-dialog-description"
            className={cn('text-sm leading-6 text-muted-foreground', className)}
            {...props}
        />
    );
}

function AlertDialogAction({
    className,
    variant = 'default',
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Action> &
    Pick<ComponentProps<typeof Button>, 'variant'>) {
    return (
        <Button variant={variant} asChild>
            <AlertDialogPrimitive.Action
                data-slot="alert-dialog-action"
                className={className}
                {...props}
            />
        </Button>
    );
}

function AlertDialogCancel({
    className,
    ...props
}: ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
    return (
        <Button variant="outline" asChild>
            <AlertDialogPrimitive.Cancel
                data-slot="alert-dialog-cancel"
                className={className}
                {...props}
            />
        </Button>
    );
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
};
