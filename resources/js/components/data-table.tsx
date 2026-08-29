import { MoveHorizontal, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';
import { cn } from '@/lib/utils';

export function DataTableSurface({
    children,
    label = 'Resultados',
    className,
}: {
    children: ReactNode;
    label?: string;
    className?: string;
}) {
    return (
        <div
            role="region"
            aria-label={label}
            tabIndex={0}
            className={cn(
                'glass-panel overflow-hidden rounded-2xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/25',
                className,
            )}
        >
            <p className="flex items-center gap-1.5 border-b bg-surface-muted px-4 py-2 text-xs font-medium text-muted-foreground sm:hidden">
                <MoveHorizontal className="size-3.5" aria-hidden="true" />
                Desliza horizontalmente para consultar más columnas.
            </p>
            {children}
        </div>
    );
}

export function TableEmpty({
    colSpan,
    title = 'Sin resultados',
    description = 'No hay información que coincida con los criterios seleccionados.',
}: {
    colSpan: number;
    title?: string;
    description?: string;
}) {
    return (
        <tr>
            <td colSpan={colSpan} className="p-0 whitespace-normal">
                <Empty className="sticky left-0 min-h-56 w-[calc(100vw-3rem)] max-w-full border-0 md:w-auto">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <SearchX aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>{title}</EmptyTitle>
                        <EmptyDescription>{description}</EmptyDescription>
                    </EmptyHeader>
                </Empty>
            </td>
        </tr>
    );
}
