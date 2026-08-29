import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function FilterBar({
    children,
    title = 'Filtros',
    description = 'Refina la información que quieres consultar.',
    activeFilters = 0,
    onClear,
    className,
}: {
    children: ReactNode;
    title?: string;
    description?: string;
    activeFilters?: number;
    onClear?: () => void;
    className?: string;
}) {
    return (
        <section
            aria-label={title}
            className={cn(
                'glass-panel overflow-hidden rounded-2xl border',
                className,
            )}
        >
            <div className="flex flex-col gap-3 border-b bg-surface-subtle/60 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
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
                <div className="flex min-h-11 shrink-0 items-center">
                    {activeFilters === 0 ? (
                        <p className="px-3 text-xs font-semibold text-text-secondary">
                            Sin filtros activos
                        </p>
                    ) : onClear ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onClear}
                            aria-label={`Limpiar ${activeFilters} ${activeFilters === 1 ? 'filtro activo' : 'filtros activos'}`}
                        >
                            <X data-icon="inline-start" aria-hidden="true" />
                            Limpiar filtros
                            <span
                                aria-hidden="true"
                                className="flex min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] leading-4 font-bold text-primary tabular-nums"
                            >
                                {activeFilters}
                            </span>
                        </Button>
                    ) : (
                        <p className="px-3 text-xs font-semibold text-text-secondary tabular-nums">
                            {activeFilters}{' '}
                            {activeFilters === 1
                                ? 'filtro activo'
                                : 'filtros activos'}
                        </p>
                    )}
                </div>
            </div>
            <div className="bg-surface/55 p-4 sm:p-5">{children}</div>
        </section>
    );
}
