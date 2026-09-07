import type { ComponentProps, ReactNode } from 'react';
import {
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type ModalSize = 'compact' | 'form' | 'flow' | 'workspace';

const sizeClasses: Record<ModalSize, string> = {
    compact: 'sm:max-w-lg',
    form: 'sm:max-w-2xl',
    flow: 'sm:max-w-3xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0',
    workspace:
        'sm:h-[calc(100dvh-3rem)] sm:max-w-[min(96vw,1280px)] max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0',
};

export function ModalContent({
    size = 'compact',
    className,
    ...props
}: ComponentProps<typeof DialogContent> & { size?: ModalSize }) {
    return (
        <DialogContent
            data-size={size}
            className={cn(
                'flex min-h-0 flex-col gap-0 overflow-hidden p-0',
                sizeClasses[size],
                className,
            )}
            {...props}
        />
    );
}

export function ModalHeader({
    title,
    description,
    icon,
    actions,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <DialogHeader
            className={cn(
                description
                    ? 'shrink-0 border-b border-border/80 px-5 pt-5 pr-16 pb-4 text-left sm:px-6 sm:pt-6 sm:pr-16'
                    : 'shrink-0 border-b border-border/80 px-5 py-4 pr-16 text-left sm:px-6 sm:py-4 sm:pr-16',
                className,
            )}
        >
            <div className="flex min-w-0 items-start gap-3">
                {icon && (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary-subtle text-primary shadow-[var(--shadow-control)] [&>svg]:size-5">
                        {icon}
                    </span>
                )}
                <div className="min-w-0">
                    <DialogTitle className="leading-6">{title}</DialogTitle>
                    {description && (
                        <DialogDescription className="mt-1 max-w-3xl leading-5">
                            {description}
                        </DialogDescription>
                    )}
                </div>
            </div>
            {actions && (
                <div
                    className={cn(
                        'flex min-w-0 flex-wrap items-center gap-2 border-t border-border/80 pt-3',
                        description ? 'mt-4' : 'mt-3',
                    )}
                >
                    {actions}
                </div>
            )}
        </DialogHeader>
    );
}

export function ModalBody({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-body"
            className={cn(
                'min-h-0 flex-1 scroll-py-20 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6 [&>*]:shrink-0',
                className,
            )}
            {...props}
        />
    );
}

export function ModalFooter({
    className,
    ...props
}: ComponentProps<typeof DialogFooter>) {
    return (
        <DialogFooter
            className={cn(
                'shrink-0 border-t border-border/80 bg-surface-muted/70 px-5 py-4 sm:px-6',
                className,
            )}
            {...props}
        />
    );
}
