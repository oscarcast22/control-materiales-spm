import { SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty';

export function DataTableSurface({ children }: { children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-lg border bg-surface">
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
