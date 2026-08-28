import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    ClipboardCheck,
    Download,
    Filter,
    PackageOpen,
    Truck,
    Users,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { MetricCard } from '@/components/metric-card';
import { Page, PageHeader, SectionHeader } from '@/components/page';
import { SearchableSelect } from '@/components/searchable-select';
import { SimpleSelect } from '@/components/simple-select';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField, FormLabel } from '@/components/ui/form-field';
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
import { formatDate, formatQuantity } from '@/lib/format';
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
    const [form, setForm] = useState({
        from: String(filters.from ?? cutoff),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        material_id: String(filters.material_id ?? ''),
        voucher_type_id: String(filters.voucher_type_id ?? ''),
        state: String(filters.state ?? ''),
        tab: filters.tab ?? 'material',
    });

    const navigate = (next: typeof form) => {
        router.get('/reports/material-tracking', next, {
            preserveState: true,
            replace: true,
        });
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        navigate(form);
    };
    const clearFilters = () => {
        const next = {
            from: cutoff,
            to: '',
            received_by_id: '',
            material_id: '',
            voucher_type_id: '',
            state: '',
            tab: form.tab,
        };
        setForm(next);
        navigate(next);
    };
    const changeTab = (tab: Tab) => {
        const next = { ...form, tab };
        setForm(next);
        navigate(next);
    };
    const query = new URLSearchParams(
        Object.entries(form)
            .filter(([, value]) => value)
            .map(([key, value]) => [key, value]),
    ).toString();
    const activeFilters = [
        String(filters.from ?? cutoff) === cutoff ? '' : filters.from,
        filters.to,
        filters.received_by_id,
        filters.material_id,
        filters.voucher_type_id,
        filters.state,
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

                <Alert variant="info">
                    <AlertTriangle aria-hidden="true" />
                    <AlertTitle>
                        No representa existencias de almacén
                    </AlertTitle>
                    <AlertDescription>
                        El pendiente es material que el técnico todavía debe
                        aplicar en un trabajo. Las cantidades sólo se suman
                        cuando corresponden al mismo material y unidad.
                    </AlertDescription>
                </Alert>

                <section
                    aria-label="Métricas del seguimiento"
                    className="flex flex-col gap-4"
                >
                    <SectionHeader
                        title="Panorama del periodo"
                        description="Señales operativas de los vales incluidos en los filtros actuales."
                    />
                    <div className="grid gap-3 md:grid-cols-3">
                        <MetricCard
                            label="Vales pendientes"
                            value={metrics.pending_vouchers}
                            icon={ClipboardCheck}
                            tone="warning"
                            emphasis="primary"
                        />
                        <MetricCard
                            label="Partidas pendientes"
                            value={metrics.pending_items}
                            icon={PackageOpen}
                            tone="warning"
                            emphasis="primary"
                        />
                        <MetricCard
                            label="Inconsistencias"
                            value={metrics.anomalies}
                            icon={AlertTriangle}
                            tone="danger"
                            emphasis="primary"
                        />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <MetricCard
                            label="Vales entregados"
                            value={metrics.delivered_vouchers}
                            icon={Truck}
                        />
                        <MetricCard
                            label="Vales liquidados"
                            value={metrics.settled_vouchers}
                            icon={CheckCircle2}
                            tone="success"
                        />
                        <MetricCard
                            label="Técnicos con pendientes"
                            value={metrics.technicians_with_pending}
                            icon={Users}
                        />
                    </div>
                </section>

                <FilterBar
                    title="Filtrar seguimiento"
                    description="Delimita el periodo y el contexto antes de comparar cantidades."
                    activeFilters={activeFilters}
                >
                    <form
                        onSubmit={submit}
                        className="grid gap-3 md:grid-cols-2 xl:grid-cols-8"
                    >
                        <FormField>
                            <FormLabel htmlFor="tracking-from">Desde</FormLabel>
                            <Input
                                id="tracking-from"
                                type="date"
                                min={cutoff}
                                value={form.from}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        from: event.target.value,
                                    })
                                }
                            />
                        </FormField>
                        <FormField>
                            <FormLabel htmlFor="tracking-to">Hasta</FormLabel>
                            <Input
                                id="tracking-to"
                                type="date"
                                min={cutoff}
                                value={form.to}
                                onChange={(event) =>
                                    setForm({
                                        ...form,
                                        to: event.target.value,
                                    })
                                }
                            />
                        </FormField>
                        <FilterSelect
                            label="Técnico"
                            value={form.received_by_id}
                            onChange={(value) =>
                                setForm({ ...form, received_by_id: value })
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
                            label="Material"
                            value={form.material_id}
                            onChange={(value) =>
                                setForm({ ...form, material_id: value })
                            }
                            empty="Todos los materiales"
                            searchable
                            searchPlaceholder="Buscar material…"
                            emptyMessage="No se encontró ningún material."
                            options={materials.map((material) => ({
                                value: String(material.id),
                                label: material.name,
                                meta: material.default_unit?.symbol ?? 's/e',
                                searchTerms: material.default_unit
                                    ? [
                                          material.default_unit.name,
                                          material.default_unit.symbol,
                                      ]
                                    : [],
                            }))}
                        />
                        <FilterSelect
                            label="Tipo de vale"
                            value={form.voucher_type_id}
                            onChange={(value) =>
                                setForm({
                                    ...form,
                                    voucher_type_id: value,
                                })
                            }
                            empty="Todos los tipos"
                            options={voucherTypes.map((type) => ({
                                value: String(type.id),
                                label: type.name,
                            }))}
                        />
                        <FilterSelect
                            label="Estado"
                            value={form.state}
                            onChange={(value) =>
                                setForm({ ...form, state: value })
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
                        <div className="flex items-end gap-2 md:col-span-2">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={clearFilters}
                            >
                                <X data-icon="inline-start" />
                                Limpiar
                            </Button>
                            <Button>
                                <Filter data-icon="inline-start" />
                                Aplicar filtros
                            </Button>
                        </div>
                    </form>
                </FilterBar>

                <Tabs
                    value={form.tab}
                    onValueChange={(value) => changeTab(value as Tab)}
                    className="gap-4"
                >
                    <TabsList aria-label="Vista del seguimiento">
                        <TabsTrigger value="material">Por material</TabsTrigger>
                        <TabsTrigger value="technician">
                            Por técnico
                        </TabsTrigger>
                        <TabsTrigger value="detail">Detalle</TabsTrigger>
                    </TabsList>
                    <TabsContent value="material">
                        <MaterialTable rows={by_material} />
                    </TabsContent>
                    <TabsContent value="technician">
                        <TechnicianTable rows={by_technician} filters={form} />
                    </TabsContent>
                    <TabsContent value="detail">
                        <DetailTable rows={rows} />
                    </TabsContent>
                </Tabs>
            </Page>
        </>
    );
}

function MaterialTable({ rows }: { rows: MaterialSummary[] }) {
    return (
        <DataTableSurface label="Resumen de material por unidad">
            <Table className="min-w-[790px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Vales</TableHead>
                        <TableHead className="text-right">Técnicos</TableHead>
                        <TableHead className="text-right">Entregado</TableHead>
                        <TableHead className="text-right">Aplicado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
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
    filters: Record<string, string>;
}) {
    return (
        <DataTableSurface label="Resumen de material por técnico">
            <Table className="min-w-[850px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>Técnico</TableHead>
                        <TableHead className="text-right">Vales</TableHead>
                        <TableHead className="text-right">Materiales</TableHead>
                        <TableHead className="text-right">Pendientes</TableHead>
                        <TableHead className="text-right">Liquidadas</TableHead>
                        <TableHead className="text-right">
                            Inconsistencias
                        </TableHead>
                        <TableHead className="text-right">Detalle</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => {
                        const query = new URLSearchParams({
                            ...filters,
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
                                        aria-label={`Ver partidas de ${row.technician.name}`}
                                    >
                                        Ver partidas
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
    return (
        <DataTableSurface label="Detalle de partidas de material">
            <Table className="min-w-[920px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>Vale</TableHead>
                        <TableHead>Técnico</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Entregado</TableHead>
                        <TableHead className="text-right">Aplicado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={`${row.voucher_id}-${row.id}`}>
                            <TableCell>
                                <Link
                                    href={`/vouchers/${row.voucher_id}`}
                                    className="font-semibold text-primary underline-offset-4 hover:underline"
                                >
                                    #{row.folio}
                                </Link>
                                <p className="text-xs text-muted-foreground">
                                    {row.voucher_type.name} ·{' '}
                                    {formatDate(row.issued_on)}
                                </p>
                            </TableCell>
                            <TableCell>{row.received_by.name}</TableCell>
                            <TableCell>
                                {row.description}
                                <p className="max-w-64 truncate text-xs text-muted-foreground">
                                    {row.destination_summary ?? '—'}
                                </p>
                            </TableCell>
                            <Quantity
                                value={row.quantity}
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
                            <TableCell>
                                <StatusBadge state={row.balance_state} />
                            </TableCell>
                        </TableRow>
                    ))}
                    {rows.length === 0 && (
                        <TableEmpty
                            colSpan={7}
                            title="Sin partidas para mostrar"
                            description="No hay material que coincida con los filtros seleccionados."
                        />
                    )}
                </TableBody>
            </Table>
        </DataTableSurface>
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
    label,
    value,
    onChange,
    empty,
    options,
    searchable = false,
    searchPlaceholder,
    emptyMessage,
}: {
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
        <FormField>
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
