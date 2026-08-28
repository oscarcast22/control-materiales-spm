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
    const tones: Record<Tone, { icon: string; accent: string; glow: string }> =
        {
            neutral: {
                icon: 'bg-surface-muted text-text-secondary',
                accent: 'from-text-muted/55 to-text-muted/0',
                glow: 'bg-text-muted/10',
            },
            primary: {
                icon: 'bg-primary-subtle text-primary',
                accent: 'from-primary to-electric/20',
                glow: 'bg-primary/12',
            },
            success: {
                icon: 'bg-success-subtle text-success',
                accent: 'from-success to-success/15',
                glow: 'bg-success/12',
            },
            warning: {
                icon: 'bg-warning-subtle text-warning',
                accent: 'from-warning to-warning/15',
                glow: 'bg-warning/12',
            },
            danger: {
                icon: 'bg-danger-subtle text-danger',
                accent: 'from-danger to-coral/15',
                glow: 'bg-coral/12',
            },
            info: {
                icon: 'bg-info-subtle text-info',
                accent: 'from-electric to-violet/15',
                glow: 'bg-electric/12',
            },
        };
    const toneStyle = tones[tone];

    return (
        <div
            className={cn(
                'group relative isolate flex min-w-0 items-center gap-3 overflow-hidden border-border',
                emphasis === 'primary'
                    ? 'glass-panel rounded-2xl border p-5 sm:p-6'
                    : 'rounded-xl border bg-glass/75 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.48),0_6px_18px_rgb(31_64_104/0.045)] backdrop-blur-lg',
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'absolute inset-x-0 top-0 h-px bg-gradient-to-r',
                    toneStyle.accent,
                )}
            />
            <span
                aria-hidden="true"
                className={cn(
                    'absolute -top-10 -right-8 -z-10 size-28 rounded-full blur-2xl',
                    toneStyle.glow,
                )}
            />
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-xl border border-white/35 shadow-[inset_0_1px_0_rgb(255_255_255/0.65),0_6px_14px_rgb(30_60_95/0.06)] dark:border-white/5',
                    emphasis === 'primary' ? 'size-12' : 'size-10',
                    toneStyle.icon,
                )}
            >
                <Icon
                    aria-hidden="true"
                    className={emphasis === 'primary' ? 'size-5.5' : 'size-5'}
                    strokeWidth={1.8}
                />
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
                <p className="mt-1.5 text-[10px] leading-4 font-bold tracking-[0.1em] text-muted-foreground uppercase">
                    {label}
                </p>
            </div>
        </div>
    );
}
