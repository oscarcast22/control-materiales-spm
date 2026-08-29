import { Head, Link } from '@inertiajs/react';
import { ChevronRight, Download, Search } from 'lucide-react';
import type { FormEvent, MouseEvent } from 'react';
import { Fragment, useId, useState } from 'react';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { Page, PageHeader } from '@/components/page';
import { SearchableSelect } from '@/components/searchable-select';
import { SimpleSelect } from '@/components/simple-select';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Button } from '@/components/ui/button';
import { FormField, FormLabel } from '@/components/ui/form-field';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VoucherModalLink } from '@/components/voucher-dialogs';
import { useReactiveFilters } from '@/hooks/use-reactive-filters';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    ChoiceOption,
    Material,
    Named,
    Unit,
    VoucherItem,
    VoucherType,
} from '@/types';

type TrackingRow = Omit<VoucherItem, 'applications'> & {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: Named;
    voucher_type: VoucherType;
    destination_summary: string | null;
};

type VoucherTrackingSummary = {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: Named;
    voucher_type: VoucherType;
    destination_summary: string | null;
    delivered_total: number;
    used_total: number;
    pending_total: number;
    items: TrackingRow[];
};

type MaterialSummary = {
    material: Named;
    unit: Unit;
    vouchers_count: number;
    technicians_count: number;
    delivered_quantity: string;
    used_quantity: string;
    pending_quantity: string;
};

type TechnicianSummary = {
    technician: Named;
    vouchers_count: number;
    materials_count: number;
    pending_items_count: number;
    settled_items_count: number;
    anomalies_count: number;
};

type Tab = 'material' | 'technician' | 'detail';

type Props = {
    metrics: {
        delivered_vouchers: number;
        pending_vouchers: number;
        pending_items: number;
        settled_vouchers: number;
        anomalies: number;
        technicians_with_pending: number;
    };
    by_material: MaterialSummary[];
    by_technician: TechnicianSummary[];
    rows: TrackingRow[];
    filters: Record<string, string | number | null> & { tab: Tab };
    cutoff: string;
    receivers: Named[];
    materials: Material[];
    voucherTypes: VoucherType[];
};

type TrackingFilterState = {
    search: string;
    from: string;
    to: string;
    received_by_id: string;
    material_id: string;
    voucher_type_id: string;
    state: string;
    tab: Tab;
};

const trackingReloadProps = [
    'metrics',
    'by_material',
    'by_technician',
    'rows',
    'filters',
];

const serializeTrackingFilters = (filters: TrackingFilterState) => ({
    ...filters,
    voucher_type_id: filters.voucher_type_id || 'all',
});

export default function MaterialTracking({
    metrics,
    by_material,
    by_technician,
    rows,
    filters,
    cutoff,
    receivers,
    materials,
    voucherTypes,
}: Props) {
    const warehouseTypeId = String(
        voucherTypes.find((type) => type.code === 'warehouse')?.id ?? '',
    );
    const initialFilters: TrackingFilterState = {
        search: String(filters.search ?? ''),
        from: String(filters.from ?? cutoff),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        material_id: String(filters.material_id ?? ''),
        voucher_type_id: String(filters.voucher_type_id ?? ''),
        state: String(filters.state ?? ''),
        tab: filters.tab ?? 'detail',
    };
    const {
        filters: form,
        flush,
        replaceFilters,
        updateFilter,
    } = useReactiveFilters({
        initial: initialFilters,
        url: '/reports/material-tracking',
        only: trackingReloadProps,
        serialize: serializeTrackingFilters,
    });
    const clearFilters = () => {
        const next = {
            search: '',
            from: cutoff,
            to: '',
            received_by_id: '',
            material_id: '',
            voucher_type_id: warehouseTypeId,
            state: '',
            tab: form.tab,
        };
        replaceFilters(next);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        flush();
    };
    const changeTab = (tab: Tab) => {
        const next = { ...form, tab };
        replaceFilters(next);
    };
    const query = new URLSearchParams(
        Object.entries(serializeTrackingFilters(form))
            .filter(([, value]) => value)
            .map(([key, value]) => [key, value]),
    ).toString();
    const activeFilters = [
        form.search,
        form.from === cutoff ? '' : form.from,
        form.to,
        form.received_by_id,
        form.material_id,
        form.voucher_type_id === warehouseTypeId ? '' : 'voucher_type',
        form.state,
    ].filter(Boolean).length;

    return (
        <>
            <Head title="Seguimiento de material" />
            <Page width="full">
                <PageHeader
                    eyebrow="Control desde el 1 de enero de 2026"
                    title="Seguimiento de material"
                    description="Material entregado a técnicos, aplicado y pendiente de comprobar."
                    actions={
                        <Button variant="outline" asChild>
                            <a href={`/reports/export?${query}`}>
                                <Download data-icon="inline-start" />
                                Exportar XLSX
                            </a>
                        </Button>
                    }
                />

                <FilterBar
                    title="Filtrar seguimiento"
                    description="Busca por folio, técnico, destino o material y delimita el periodo. Los cambios se aplican automáticamente."
                    activeFilters={activeFilters}
                    onClear={clearFilters}
                >
                    <form onSubmit={submit} className="flex flex-col gap-3">
                        <div className="grid gap-3 md:grid-cols-6 xl:grid-cols-12">
                            <FormField className="md:col-span-6 xl:col-span-4">
                                <FormLabel htmlFor="tracking-search">
                                    Buscar
                                </FormLabel>
                                <div className="relative">
                                    <Search
                                        aria-hidden="true"
                                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="tracking-search"
                                        className="pl-9"
                                        value={form.search}
                                        maxLength={100}
                                        onChange={(event) =>
                                            updateFilter(
                                                'search',
                                                event.target.value,
                                                true,
                                            )
                                        }
                                        placeholder="Folio, destino, técnico o material"
                                    />
                                </div>
                            </FormField>
                            <FilterSelect
                                className="md:col-span-2 xl:col-span-2"
                                label="Tipo de vale"
                                value={form.voucher_type_id}
                                onChange={(value) =>
                                    updateFilter('voucher_type_id', value)
                                }
                                empty="Todos los tipos"
                                options={voucherTypes.map((type) => ({
                                    value: String(type.id),
                                    label: type.name,
                                }))}
                            />
                            <FilterSelect
                                className="md:col-span-2 xl:col-span-3"
                                label="Técnico"
                                value={form.received_by_id}
                                onChange={(value) =>
                                    updateFilter('received_by_id', value)
                                }
                                empty="Todos los técnicos"
                                searchable
                                searchPlaceholder="Buscar técnico…"
                                emptyMessage="No se encontró ningún técnico."
                                options={receivers.map((person) => ({
                                    value: String(person.id),
                                    label: person.name,
                                }))}
                            />
                            <FilterSelect
                                className="md:col-span-2 xl:col-span-3"
                                label="Material"
                                value={form.material_id}
                                onChange={(value) =>
                                    updateFilter('material_id', value)
                                }
                                empty="Todos los materiales"
                                searchable
                                searchPlaceholder="Buscar material…"
                                emptyMessage="No se encontró ningún material."
                                options={materials.map((material) => ({
                                    value: String(material.id),
                                    label: material.name,
                                    meta:
                                        material.default_unit?.symbol ?? 's/e',
                                    searchTerms: material.default_unit
                                        ? [
                                              material.default_unit.name,
                                              material.default_unit.symbol,
                                          ]
                                        : [],
                                }))}
                            />
                        </div>
                        <div className="grid gap-3 border-t pt-3 md:grid-cols-3 xl:grid-cols-12">
                            <FilterSelect
                                className="xl:col-span-3"
                                label="Estado"
                                value={form.state}
                                onChange={(value) =>
                                    updateFilter('state', value)
                                }
                                empty="Todos los estados"
                                options={[
                                    { value: 'pending', label: 'Pendiente' },
                                    { value: 'settled', label: 'Liquidado' },
                                    {
                                        value: 'anomaly',
                                        label: 'Inconsistencia',
                                    },
                                ]}
                            />
                            <FormField className="xl:col-span-3">
                                <FormLabel htmlFor="tracking-from">
                                    Desde
                                </FormLabel>
                                <Input
                                    id="tracking-from"
                                    type="date"
                                    min={cutoff}
                                    max={form.to || undefined}
                                    value={form.from}
                                    onChange={(event) =>
                                        updateFilter('from', event.target.value)
                                    }
                                />
                            </FormField>
                            <FormField className="xl:col-span-3">
                                <FormLabel htmlFor="tracking-to">
                                    Hasta
                                </FormLabel>
                                <Input
                                    id="tracking-to"
                                    type="date"
                                    min={form.from || cutoff}
                                    value={form.to}
                                    onChange={(event) =>
                                        updateFilter('to', event.target.value)
                                    }
                                />
                            </FormField>
                        </div>
                    </form>
                </FilterBar>

                <TrackingMetrics metrics={metrics} />

                <Tabs
                    value={form.tab}
                    onValueChange={(value) => changeTab(value as Tab)}
                    className="gap-4"
                >
                    <TabsList aria-label="Vista del seguimiento">
                        <TabsTrigger value="detail">Por vale</TabsTrigger>
                        <TabsTrigger value="material">Por material</TabsTrigger>
                        <TabsTrigger value="technician">
                            Por técnico
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="detail">
                        <DetailTable
                            key={rows.map((row) => row.id).join(':')}
                            rows={rows}
                        />
                    </TabsContent>
                    <TabsContent value="material">
                        <MaterialTable rows={by_material} />
                    </TabsContent>
                    <TabsContent value="technician">
                        <TechnicianTable rows={by_technician} filters={form} />
                    </TabsContent>
                </Tabs>
            </Page>
        </>
    );
}

function TrackingMetrics({ metrics }: { metrics: Props['metrics'] }) {
    const values = [
        {
            label: 'Vales incluidos',
            value: metrics.delivered_vouchers,
        },
        {
            label: 'Vales liquidados',
            value: metrics.settled_vouchers,
        },
        {
            label: 'Técnicos con pendiente',
            value: metrics.technicians_with_pending,
        },
    ];

    return (
        <section
            aria-label="Resumen de los filtros actuales"
            className="overflow-hidden rounded-xl border bg-surface-raised shadow-[var(--shadow-control)]"
        >
            <dl className="grid sm:grid-cols-3">
                {values.map((metric, index) => (
                    <div
                        key={metric.label}
                        className={cn(
                            'flex items-center justify-between gap-4 px-4 py-3 sm:block sm:px-5',
                            index < values.length - 1 &&
                                'border-b sm:border-r sm:border-b-0',
                        )}
                    >
                        <dt className="text-[10px] leading-4 font-bold tracking-[0.1em] text-muted-foreground uppercase">
                            {metric.label}
                        </dt>
                        <dd className="text-2xl leading-none font-semibold tabular-nums sm:mt-1.5">
                            {metric.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

function MaterialTable({ rows }: { rows: MaterialSummary[] }) {
    const sorted = useTableSort(rows, 'material', 'asc', {
        material: (row) => row.material.name,
        vouchers: (row) => row.vouchers_count,
        technicians: (row) => row.technicians_count,
        delivered: (row) => Number(row.delivered_quantity),
        used: (row) => Number(row.used_quantity),
        pending: (row) => Number(row.pending_quantity),
    });

    return (
        <DataTableSurface label="Resumen de material por unidad">
            <Table className="min-w-[790px]">
                <TableHeader>
                    <TableRow>
                        <TrackingSortHead
                            sort={sorted}
                            column="material"
                            label="Material"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="vouchers"
                            label="Vales"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="technicians"
                            label="Técnicos"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="delivered"
                            label="Entregado"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="used"
                            label="Aplicado"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="pending"
                            label="Pendiente"
                            align="right"
                        />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.rows.map((row) => (
                        <TableRow key={`${row.material.id}-${row.unit.id}`}>
                            <TableCell className="max-w-[22rem] font-medium whitespace-normal">
                                {row.material.name}
                                <span className="ml-2 text-xs text-muted-foreground">
                                    {row.unit.symbol}
                                </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {row.vouchers_count}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                                {row.technicians_count}
                            </TableCell>
                            <Quantity
                                value={row.delivered_quantity}
                                unit={row.unit.symbol}
                            />
                            <Quantity
                                value={row.used_quantity}
                                unit={row.unit.symbol}
                            />
                            <Quantity
                                value={row.pending_quantity}
                                unit={row.unit.symbol}
                                emphasized
                            />
                        </TableRow>
                    ))}
                    {rows.length === 0 && (
                        <TableEmpty
                            colSpan={6}
                            title="Sin material para mostrar"
                            description="No hay partidas que coincidan con los filtros seleccionados."
                        />
                    )}
                </TableBody>
            </Table>
        </DataTableSurface>
    );
}

function TechnicianTable({
    rows,
    filters,
}: {
    rows: TechnicianSummary[];
    filters: TrackingFilterState;
}) {
    const sorted = useTableSort(rows, 'pending', 'desc', {
        technician: (row) => row.technician.name,
        vouchers: (row) => row.vouchers_count,
        materials: (row) => row.materials_count,
        pending: (row) => row.pending_items_count,
        settled: (row) => row.settled_items_count,
        anomalies: (row) => row.anomalies_count,
    });

    return (
        <DataTableSurface label="Resumen de material por técnico">
            <Table className="min-w-[850px]">
                <TableHeader>
                    <TableRow>
                        <TrackingSortHead
                            sort={sorted}
                            column="technician"
                            label="Técnico"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="vouchers"
                            label="Vales"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="materials"
                            label="Materiales"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="pending"
                            label="Pendientes"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="settled"
                            label="Liquidadas"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="anomalies"
                            label="Inconsistencias"
                            align="right"
                        />
                        <TableHead className="text-right">Detalle</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.rows.map((row) => {
                        const query = new URLSearchParams({
                            ...serializeTrackingFilters(filters),
                            received_by_id: String(row.technician.id),
                            tab: 'detail',
                        }).toString();

                        return (
                            <TableRow key={row.technician.id}>
                                <TableCell className="font-medium">
                                    {row.technician.name}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {row.vouchers_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {row.materials_count}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-warning tabular-nums">
                                    {row.pending_items_count}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {row.settled_items_count}
                                </TableCell>
                                <TableCell className="text-right text-danger tabular-nums">
                                    {row.anomalies_count}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Link
                                        href={`/reports/material-tracking?${query}`}
                                        className="font-medium text-primary underline-offset-4 hover:underline"
                                        aria-label={`Ver vales de ${row.technician.name}`}
                                    >
                                        Ver vales
                                    </Link>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {rows.length === 0 && (
                        <TableEmpty
                            colSpan={7}
                            title="Sin técnicos para mostrar"
                            description="No hay partidas que coincidan con los filtros seleccionados."
                        />
                    )}
                </TableBody>
            </Table>
        </DataTableSurface>
    );
}

function DetailTable({ rows }: { rows: TrackingRow[] }) {
    const summaries = groupTrackingRows(rows);
    const sorted = useTableSort(summaries, 'date', 'desc', {
        folio: (row) => row.folio,
        date: (row) => row.issued_on,
        technician: (row) => row.received_by.name,
        delivered: (row) => row.delivered_total,
        used: (row) => row.used_total,
        pending: (row) => row.pending_total,
    });
    const [expandedVouchers, setExpandedVouchers] = useState<Set<number>>(
        () => new Set(),
    );

    const toggleVoucher = (voucherId: number) => {
        setExpandedVouchers((current) => {
            const next = new Set(current);

            if (next.has(voucherId)) {
                next.delete(voucherId);
            } else {
                next.add(voucherId);
            }

            return next;
        });
    };

    const toggleFromRow = (
        event: MouseEvent<HTMLTableRowElement>,
        voucherId: number,
    ) => {
        if ((event.target as HTMLElement).closest('a,button')) {
            return;
        }

        toggleVoucher(voucherId);
    };

    return (
        <DataTableSurface label="Seguimiento por vale">
            <Table className="min-w-[1040px]">
                <TableHeader>
                    <TableRow>
                        <TrackingSortHead
                            sort={sorted}
                            column="folio"
                            label="Vale"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="date"
                            label="Fecha"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="technician"
                            label="Técnico"
                        />
                        <TableHead>Destino</TableHead>
                        <TrackingSortHead
                            sort={sorted}
                            column="delivered"
                            label="Entregado"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="used"
                            label="Aplicado"
                            align="right"
                        />
                        <TrackingSortHead
                            sort={sorted}
                            column="pending"
                            label="Pendiente"
                            align="right"
                        />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.rows.map((row) => {
                        const expanded = expandedVouchers.has(row.voucher_id);
                        const detailId = `tracking-voucher-${row.voucher_id}-detail`;

                        return (
                            <Fragment key={row.voucher_id}>
                                <TableRow
                                    className="cursor-pointer"
                                    onClick={(event) =>
                                        toggleFromRow(event, row.voucher_id)
                                    }
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <IconButton
                                                type="button"
                                                variant="ghost"
                                                label={`${expanded ? 'Ocultar' : 'Mostrar'} materiales del vale ${row.folio}`}
                                                aria-expanded={expanded}
                                                aria-controls={detailId}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleVoucher(
                                                        row.voucher_id,
                                                    );
                                                }}
                                                className="-ml-2 shrink-0 text-muted-foreground hover:text-primary"
                                            >
                                                <ChevronRight
                                                    aria-hidden="true"
                                                    strokeWidth={1.5}
                                                    className={cn(
                                                        'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                                                        expanded && 'rotate-90',
                                                    )}
                                                />
                                            </IconButton>
                                            <div>
                                                <VoucherModalLink
                                                    mode="detail"
                                                    voucherId={row.voucher_id}
                                                    className="font-semibold text-primary underline-offset-4 hover:underline"
                                                >
                                                    #{row.folio}
                                                </VoucherModalLink>
                                                <p className="text-xs text-muted-foreground">
                                                    {row.voucher_type.name}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(row.issued_on)}
                                    </TableCell>
                                    <TableCell>
                                        {row.received_by.name}
                                    </TableCell>
                                    <TableCell className="max-w-72 whitespace-normal">
                                        {row.destination_summary ?? '—'}
                                    </TableCell>
                                    <AbstractQuantity
                                        value={row.delivered_total}
                                    />
                                    <AbstractQuantity value={row.used_total} />
                                    <AbstractQuantity
                                        value={row.pending_total}
                                        emphasized
                                    />
                                </TableRow>
                                <TableRow
                                    aria-hidden={!expanded}
                                    className="border-0 hover:bg-transparent"
                                >
                                    <TableCell
                                        colSpan={7}
                                        className="p-0 whitespace-normal"
                                    >
                                        <div
                                            id={detailId}
                                            className={cn(
                                                'grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
                                                expanded
                                                    ? 'grid-rows-[1fr] opacity-100'
                                                    : 'pointer-events-none grid-rows-[0fr] opacity-0',
                                            )}
                                        >
                                            <div className="min-h-0 overflow-hidden">
                                                <VoucherMaterialBreakdown
                                                    folio={row.folio}
                                                    rows={row.items}
                                                />
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            </Fragment>
                        );
                    })}
                    {rows.length === 0 && (
                        <TableEmpty
                            colSpan={7}
                            title="Sin vales para mostrar"
                            description="No hay vales con material que coincida con los filtros seleccionados."
                        />
                    )}
                </TableBody>
            </Table>
        </DataTableSurface>
    );
}

function VoucherMaterialBreakdown({
    folio,
    rows,
}: {
    folio: string;
    rows: TrackingRow[];
}) {
    return (
        <div className="px-4 pt-3 pb-5 pl-16">
            <div className="overflow-hidden rounded-xl border bg-surface-muted/55">
                <div className="border-b px-4 py-3">
                    <p className="text-sm font-semibold">
                        Materiales del vale {folio}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Cantidades y unidades de las partidas que coinciden con
                        los filtros actuales.
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
                                Entregado
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
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="max-w-md font-medium whitespace-normal">
                                    {row.description}
                                </TableCell>
                                <TableCell>{row.unit.symbol}</TableCell>
                                <BreakdownQuantity value={row.quantity} />
                                <BreakdownQuantity value={row.used_quantity} />
                                <BreakdownQuantity
                                    value={row.pending_quantity}
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
    value: string;
    emphasized?: boolean;
}) {
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

function AbstractQuantity({
    value,
    emphasized = false,
}: {
    value: number;
    emphasized?: boolean;
}) {
    const negative = value < 0;
    const label = Math.abs(value) === 1 ? 'material' : 'materiales';

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
                {label}
            </span>
        </TableCell>
    );
}

function groupTrackingRows(rows: TrackingRow[]): VoucherTrackingSummary[] {
    const grouped = new Map<number, VoucherTrackingSummary>();

    for (const row of rows) {
        const current = grouped.get(row.voucher_id);

        if (current) {
            current.delivered_total += Number(row.quantity);
            current.used_total += Number(row.used_quantity);
            current.pending_total += Number(row.pending_quantity);
            current.items.push(row);
            continue;
        }

        grouped.set(row.voucher_id, {
            voucher_id: row.voucher_id,
            folio: row.folio,
            issued_on: row.issued_on,
            received_by: row.received_by,
            voucher_type: row.voucher_type,
            destination_summary: row.destination_summary,
            delivered_total: Number(row.quantity),
            used_total: Number(row.used_quantity),
            pending_total: Number(row.pending_quantity),
            items: [row],
        });
    }

    return [...grouped.values()];
}

type SortDirection = 'asc' | 'desc';
type SortValue = string | number;
type SortControls = {
    column: string;
    direction: SortDirection;
    change: (column: string) => void;
};

function useTableSort<T>(
    source: T[],
    initialColumn: string,
    initialDirection: SortDirection,
    selectors: Record<string, (row: T) => SortValue>,
): SortControls & { rows: T[] } {
    const [sort, setSort] = useState({
        column: initialColumn,
        direction: initialDirection,
    });
    const selector = selectors[sort.column] ?? selectors[initialColumn];
    const rows = [...source].sort((left, right) => {
        const leftValue = selector(left);
        const rightValue = selector(right);
        const comparison =
            typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue), 'es-MX', {
                      numeric: true,
                      sensitivity: 'base',
                  });

        return sort.direction === 'asc' ? comparison : -comparison;
    });

    return {
        rows,
        ...sort,
        change: (column) =>
            setSort((current) => ({
                column,
                direction:
                    current.column === column && current.direction === 'asc'
                        ? 'desc'
                        : 'asc',
            })),
    };
}

function TrackingSortHead({
    sort,
    column,
    label,
    align = 'left',
}: {
    sort: SortControls;
    column: string;
    label: string;
    align?: 'left' | 'right';
}) {
    return (
        <SortableTableHead
            label={label}
            active={sort.column === column}
            direction={sort.direction}
            onSort={() => sort.change(column)}
            align={align}
        />
    );
}

function Quantity({
    value,
    unit,
    emphasized = false,
}: {
    value: string;
    unit: string;
    emphasized?: boolean;
}) {
    const negative = Number(value) < 0;

    return (
        <TableCell
            className={`text-right tabular-nums ${emphasized ? 'font-semibold text-warning' : ''} ${negative ? 'text-danger' : ''}`}
        >
            {formatQuantity(value)} {unit}
        </TableCell>
    );
}

function FilterSelect({
    className,
    label,
    value,
    onChange,
    empty,
    options,
    searchable = false,
    searchPlaceholder,
    emptyMessage,
}: {
    className?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    empty: string;
    options: ChoiceOption[];
    searchable?: boolean;
    searchPlaceholder?: string;
    emptyMessage?: string;
}) {
    const id = useId();

    return (
        <FormField className={className}>
            <FormLabel htmlFor={id}>{label}</FormLabel>
            {searchable ? (
                <SearchableSelect
                    id={id}
                    value={value}
                    onValueChange={onChange}
                    options={options}
                    placeholder={empty}
                    searchPlaceholder={
                        searchPlaceholder ??
                        `Buscar ${label.toLocaleLowerCase('es-MX')}…`
                    }
                    emptyMessage={
                        emptyMessage ?? 'No se encontraron resultados.'
                    }
                    emptyLabel={empty}
                />
            ) : (
                <SimpleSelect
                    id={id}
                    value={value}
                    onValueChange={onChange}
                    options={options}
                    placeholder={empty}
                    emptyLabel={empty}
                />
            )}
        </FormField>
    );
}
