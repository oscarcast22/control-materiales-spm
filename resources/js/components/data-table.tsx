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
        <div className="overflow-hidden rounded-lg border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05),0_4px_12px_rgba(26,20,107,0.04)]">
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
