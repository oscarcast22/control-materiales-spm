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
                'overflow-hidden rounded-xl border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.04)]',
                className,
            )}
        >
            <div className="flex flex-col gap-3 border-b bg-surface-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
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
