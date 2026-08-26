import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Page({
    children,
    width = 'wide',
}: {
    children: ReactNode;
    width?: 'content' | 'wide' | 'full';
}) {
    const widths = {
        content: 'max-w-[1280px]',
        wide: 'max-w-[1520px]',
        full: 'max-w-none',
    };

    return (
        <div
            className={cn(
                'mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-5 sm:px-6 md:py-7 lg:px-8',
                widths[width],
            )}
        >
            {children}
        </div>
    );
}

export function PageHeader({
    title,
    description,
    eyebrow,
    actions,
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
}) {
    return (
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-primary uppercase">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-[clamp(1.75rem,3vw,2rem)] leading-tight font-semibold tracking-[-0.025em] text-text-primary">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">
                        {description}
                    </p>
                )}
            </div>
            {actions && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </header>
    );
}

export function SectionHeader({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <h2 className="text-lg font-semibold tracking-[-0.015em]">
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}
