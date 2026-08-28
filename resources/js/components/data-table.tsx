import { MoveHorizontal, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';

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
            className={`overflow-hidden rounded-xl border bg-surface shadow-[0_1px_2px_rgb(15_23_42/0.05),0_8px_24px_rgb(15_23_42/0.035)] outline-none focus-visible:ring-3 focus-visible:ring-ring/25 ${className ?? ''}`}
        >
            <p className="bg-surface-muted flex items-center gap-1.5 border-b px-4 py-2 text-xs font-medium text-muted-foreground sm:hidden">
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
                <Empty className="min-h-56 border-0">
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
