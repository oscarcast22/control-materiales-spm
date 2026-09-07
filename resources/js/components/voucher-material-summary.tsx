import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { VoucherItem } from '@/types';

type VoucherMaterialItem = Omit<VoucherItem, 'applications'>;

export function AbstractMaterialQuantity({
    value,
    emphasized = false,
}: {
    value: string | number | null;
    emphasized?: boolean;
}) {
    if (value === null) {
        return (
            <TableCell className="text-right text-muted-foreground">
                <span aria-hidden="true">—</span>
                <span className="sr-only">No aplica</span>
            </TableCell>
        );
    }

    const negative = Number(value) < 0;

    return (
        <TableCell
            className={cn(
                'text-right tabular-nums',
                emphasized && 'font-semibold text-warning',
                negative && 'text-danger',
            )}
        >
            {formatQuantity(value)}{' '}
            <span className="text-xs font-normal text-muted-foreground">
                mat.
            </span>
        </TableCell>
    );
}

export function VoucherMaterialDetailRow({
    expanded,
    id,
    colSpan,
    folio,
    items,
    primaryLabel,
    balancesApply = true,
    description = 'Cantidades y unidades reales de cada partida.',
}: {
    expanded: boolean;
    id: string;
    colSpan: number;
    folio: string;
    items: VoucherMaterialItem[];
    primaryLabel: string;
    balancesApply?: boolean;
    description?: string;
}) {
    return (
        <TableRow
            aria-hidden={!expanded}
            className="border-0 hover:bg-transparent"
        >
            <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
                <div
                    id={id}
                    className={cn(
                        'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
                        expanded
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'pointer-events-none grid-rows-[0fr] opacity-0',
                    )}
                >
                    <div className="min-h-0 overflow-hidden">
                        <VoucherMaterialBreakdown
                            folio={folio}
                            items={items}
                            primaryLabel={primaryLabel}
                            balancesApply={balancesApply}
                            description={description}
                        />
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
}

function VoucherMaterialBreakdown({
    folio,
    items,
    primaryLabel,
    balancesApply,
    description,
}: {
    folio: string;
    items: VoucherMaterialItem[];
    primaryLabel: string;
    balancesApply: boolean;
    description: string;
}) {
    return (
        <div className="px-4 pt-3 pb-5 pl-16">
            <div className="overflow-hidden rounded-xl border bg-surface-muted/55">
                <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">
                        Materiales del vale {folio}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                </div>
                <Table
                    className="min-w-[680px]"
                    containerClassName="overflow-visible"
                >
                    <TableHeader>
                        <TableRow>
                            <TableHead>Material</TableHead>
                            <TableHead>Unidad</TableHead>
                            <TableHead className="text-right">
                                {primaryLabel}
                            </TableHead>
                            <TableHead className="text-right">
                                Aplicado
                            </TableHead>
                            <TableHead className="text-right">
                                Pendiente
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="max-w-md font-medium whitespace-normal">
                                    {item.description}
                                </TableCell>
                                <TableCell>{item.unit.symbol}</TableCell>
                                <BreakdownQuantity value={item.quantity} />
                                <BreakdownQuantity
                                    value={
                                        balancesApply
                                            ? item.used_quantity
                                            : null
                                    }
                                />
                                <BreakdownQuantity
                                    value={
                                        balancesApply
                                            ? item.pending_quantity
                                            : null
                                    }
                                    emphasized
                                />
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function BreakdownQuantity({
    value,
    emphasized = false,
}: {
    value: string | null;
    emphasized?: boolean;
}) {
    if (value === null) {
        return <NotApplicableCell />;
    }

    const negative = Number(value) < 0;

    return (
        <TableCell
            className={cn(
                'text-right tabular-nums',
                emphasized && 'font-semibold text-warning',
                negative && 'text-danger',
            )}
        >
            {formatQuantity(value)}
        </TableCell>
    );
}

function NotApplicableCell() {
    return (
        <TableCell className="text-right text-muted-foreground">
            <span aria-hidden="true">—</span>
            <span className="sr-only">No aplica</span>
        </TableCell>
    );
}
