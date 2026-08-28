import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function SortableTableHead({
    label,
    active,
    direction,
    onSort,
    align = 'left',
}: {
    label: string;
    active: boolean;
    direction: 'asc' | 'desc';
    onSort: () => void;
    align?: 'left' | 'right';
}) {
    const Icon = active
        ? direction === 'asc'
            ? ArrowUp
            : ArrowDown
        : ArrowUpDown;

    return (
        <TableHead
            aria-sort={
                active
                    ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : 'none'
            }
            className={cn(align === 'right' && 'text-right')}
        >
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSort}
                className={cn('-mx-3', align === 'right' && 'ml-auto')}
            >
                {label}
                <Icon data-icon="inline-end" />
            </Button>
        </TableHead>
    );
}
