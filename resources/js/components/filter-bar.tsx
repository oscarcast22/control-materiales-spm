import { SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function FilterBar({
    children,
    title = 'Filtros',
    description = 'Refina la información que quieres consultar.',
    activeFilters = 0,
    className,
}: {
    children: ReactNode;
    title?: string;
    description?: string;
    activeFilters?: number;
    className?: string;
}) {
    return (
        <section
            aria-label={title}
            className={cn(
                'glass-panel tech-highlight overflow-hidden rounded-2xl border',
                className,
            )}
        >
            <div className="flex flex-col gap-3 border-b bg-gradient-to-r from-primary-subtle/75 via-glass to-info-subtle/55 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-glass-strong text-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_5px_14px_rgb(22_74_140/0.08)]">
                        <SlidersHorizontal
                            className="size-4"
                            aria-hidden="true"
                        />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold text-text-primary">
                            {title}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                            {description}
                        </p>
                    </div>
                </div>
                <p className="shrink-0 text-xs font-semibold text-text-secondary tabular-nums">
                    {activeFilters === 0
                        ? 'Sin filtros activos'
                        : `${activeFilters} ${activeFilters === 1 ? 'filtro activo' : 'filtros activos'}`}
                </p>
            </div>
            <div className="p-4 sm:p-5">{children}</div>
        </section>
    );
}
