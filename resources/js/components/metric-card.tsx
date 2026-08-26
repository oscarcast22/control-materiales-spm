import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function MetricCard({
    label,
    value,
    icon: Icon,
    tone = 'neutral',
    emphasis = 'compact',
}: {
    label: string;
    value: number | string;
    icon: LucideIcon;
    tone?: Tone;
    emphasis?: 'primary' | 'compact';
}) {
    const tones: Record<Tone, string> = {
        neutral: 'bg-surface-subtle text-text-secondary',
        primary: 'bg-primary-subtle text-primary',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
    };

    return (
        <div
            className={cn(
                'flex min-w-0 items-center gap-3 border-border',
                emphasis === 'primary'
                    ? 'rounded-lg border bg-surface p-5'
                    : 'border-b py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:px-4 sm:first:pl-0 sm:last:border-r-0',
            )}
        >
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-md',
                    emphasis === 'primary' ? 'size-11' : 'size-9',
                    tones[tone],
                )}
            >
                <Icon aria-hidden="true" className="size-5" />
            </div>
            <div className="min-w-0">
                <p
                    className={cn(
                        'leading-none font-semibold tabular-nums',
                        emphasis === 'primary' ? 'text-3xl' : 'text-2xl',
                    )}
                >
                    {value}
                </p>
                <p className="mt-1 text-xs leading-4 text-muted-foreground">
                    {label}
                </p>
            </div>
        </div>
    );
}
