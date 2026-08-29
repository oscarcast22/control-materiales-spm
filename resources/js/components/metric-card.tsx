import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function MetricCard({
    label,
    value,
    icon: Icon,
    tone = 'neutral',
}: {
    label: string;
    value: number | string;
    icon: LucideIcon;
    tone?: Tone;
}) {
    const tones: Record<Tone, string> = {
        neutral: 'bg-surface-muted text-text-secondary',
        primary: 'bg-primary-subtle text-primary',
        success: 'bg-success-subtle text-success',
        warning: 'bg-warning-subtle text-warning',
        danger: 'bg-danger-subtle text-danger',
        info: 'bg-info-subtle text-info',
    };
    const toneStyle = tones[tone];

    return (
        <div
            data-slot="metric-card"
            className="glass-panel flex min-h-24 min-w-0 items-center gap-4 rounded-2xl border p-4 sm:p-5"
        >
            <div
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-xl',
                    toneStyle,
                )}
            >
                <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
                <p className="text-3xl leading-none font-semibold tabular-nums">
                    {value}
                </p>
                <p className="mt-1.5 text-sm leading-5 font-medium text-muted-foreground">
                    {label}
                </p>
            </div>
        </div>
    );
}
