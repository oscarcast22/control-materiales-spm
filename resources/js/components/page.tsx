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
        wide: 'max-w-[1440px]',
        full: 'max-w-[1440px]',
    };

    return (
        <div
            className={cn(
                'mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 min-[1200px]:px-8 min-[1200px]:py-8 md:px-6',
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
    size = 'headline',
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
    size?: 'headline' | 'display';
}) {
    return (
        <header className="relative flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                {eyebrow && (
                    <div className="mb-2 flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-primary" />
                        <p className="text-xs font-semibold tracking-[0.055em] text-primary uppercase">
                            {eyebrow}
                        </p>
                    </div>
                )}
                <h1
                    className={cn(
                        'font-bold text-text-primary',
                        size === 'display'
                            ? 'text-[2rem] leading-10 tracking-[-0.035em] md:text-4xl md:leading-11 md:font-extrabold'
                            : 'text-[1.625rem] leading-8 tracking-[-0.02em] md:text-[2rem] md:leading-10',
                    )}
                >
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
    id,
    title,
    description,
    action,
}: {
    id?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
                <h2
                    id={id}
                    className="text-lg font-semibold tracking-[-0.015em]"
                >
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
