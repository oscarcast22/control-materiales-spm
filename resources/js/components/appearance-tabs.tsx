import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';

export default function AppearanceToggleTab({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const tabs: { value: Appearance; icon: LucideIcon; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Claro' },
        { value: 'dark', icon: Moon, label: 'Oscuro' },
        { value: 'system', icon: Monitor, label: 'Sistema' },
    ];

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-md border border-border bg-surface-subtle p-1',
                className,
            )}
            {...props}
        >
            {tabs.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => updateAppearance(value)}
                    aria-pressed={appearance === value}
                    className={cn(
                        'flex min-h-9 items-center rounded px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/10 focus-visible:outline-none',
                        appearance === value
                            ? 'bg-surface-raised text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                            : 'text-muted-foreground hover:bg-hover hover:text-foreground',
                    )}
                >
                    <Icon className="-ml-1 size-4" />
                    <span className="ml-1.5">{label}</span>
                </button>
            ))}
        </div>
    );
}
