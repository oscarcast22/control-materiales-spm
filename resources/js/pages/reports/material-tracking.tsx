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
import { FilterBar } from '@/components/filter-bar';
import { MetricCard } from '@/components/metric-card';
import { Page, PageHeader } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, FormLabel } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatQuantity } from '@/lib/format';
import type {
    Material,
    Named,
    StorageLocation,
    Unit,
    VoucherItem,
} from '@/types';

type TrackingRow = Omit<VoucherItem, 'dispositions'> & {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: Named;
    location: StorageLocation;
    destination: string;
};

type MaterialSummary = {
    material: Named;
    unit: Unit;
    vouchers_count: number;
    technicians_count: number;
    delivered_quantity: string;
    used_quantity: string;
    returned_quantity: string;
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
    locations: StorageLocation[];
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
    locations,
}: Props) {
    const [form, setForm] = useState({
        from: String(filters.from ?? cutoff),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        material_id: String(filters.material_id ?? ''),
        storage_location_id: String(filters.storage_location_id ?? ''),
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
            storage_location_id: '',
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

    return (
        <>
            <Head title="Seguimiento de material" />
            <Page width="full">
                <PageHeader
                    eyebrow="Control desde el 1 de enero de 2026"
                    title="Seguimiento de material"
                    description="Material entregado a técnicos, aplicado, devuelto y pendiente de comprobar."
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
                        aplicar en un trabajo o devolver. Las cantidades solo se
                        suman cuando corresponden al mismo material y unidad.
                    </AlertDescription>
                </Alert>

                <section
                    aria-label="Métricas del seguimiento"
                    className="flex flex-col gap-4"
                >
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
                    <div className="grid border-y sm:grid-cols-3">
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

                <FilterBar>
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
                            options={receivers.map((person) => ({
                                value: person.id,
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
                            options={materials.map((material) => ({
                                value: material.id,
                                label: material.name,
                            }))}
                        />
                        <FilterSelect
                            label="Área"
                            value={form.storage_location_id}
                            onChange={(value) =>
                                setForm({
                                    ...form,
                                    storage_location_id: value,
                                })
                            }
                            empty="Todas las áreas"
                            options={locations.map((location) => ({
                                value: location.id,
                                label: location.name,
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
        <TableCard>
            <thead className="sticky top-0 border-b bg-surface-subtle text-left text-xs text-text-secondary">
                <tr>
                    <th className="px-5 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Vales</th>
                    <th className="px-4 py-3 text-right">Técnicos</th>
                    <th className="px-4 py-3 text-right">Entregado</th>
                    <th className="px-4 py-3 text-right">Aplicado</th>
                    <th className="px-4 py-3 text-right">Devuelto</th>
                    <th className="px-5 py-3 text-right">Pendiente</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={`${row.material.id}-${row.unit.id}`}
                        className="border-b transition-colors last:border-0 hover:bg-hover/60"
                    >
                        <td className="px-5 py-4 font-medium">
                            {row.material.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                                {row.unit.symbol}
                            </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                            {row.vouchers_count}
                        </td>
                        <td className="px-4 py-4 text-right">
                            {row.technicians_count}
                        </td>
                        <Quantity
                            value={row.delivered_quantity}
                            unit={row.unit.symbol}
                        />
                        <Quantity
                            value={row.used_quantity}
                            unit={row.unit.symbol}
                        />
                        <Quantity
                            value={row.returned_quantity}
                            unit={row.unit.symbol}
                        />
                        <Quantity
                            value={row.pending_quantity}
                            unit={row.unit.symbol}
                            emphasized
                        />
                    </tr>
                ))}
                <EmptyRow show={rows.length === 0} columns={7} />
            </tbody>
        </TableCard>
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
        <TableCard>
            <thead className="sticky top-0 border-b bg-surface-subtle text-left text-xs text-text-secondary">
                <tr>
                    <th className="px-5 py-3">Técnico</th>
                    <th className="px-4 py-3 text-right">Vales</th>
                    <th className="px-4 py-3 text-right">Materiales</th>
                    <th className="px-4 py-3 text-right">Pendientes</th>
                    <th className="px-4 py-3 text-right">Liquidadas</th>
                    <th className="px-4 py-3 text-right">Inconsistencias</th>
                    <th className="px-5 py-3 text-right">Detalle</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => {
                    const query = new URLSearchParams({
                        ...filters,
                        received_by_id: String(row.technician.id),
                        tab: 'detail',
                    }).toString();

                    return (
                        <tr
                            key={row.technician.id}
                            className="border-b transition-colors last:border-0 hover:bg-hover/60"
                        >
                            <td className="px-5 py-4 font-medium">
                                {row.technician.name}
                            </td>
                            <td className="px-4 py-4 text-right">
                                {row.vouchers_count}
                            </td>
                            <td className="px-4 py-4 text-right">
                                {row.materials_count}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-warning">
                                {row.pending_items_count}
                            </td>
                            <td className="px-4 py-4 text-right">
                                {row.settled_items_count}
                            </td>
                            <td className="px-4 py-4 text-right text-danger">
                                {row.anomalies_count}
                            </td>
                            <td className="px-5 py-4 text-right">
                                <Link
                                    href={`/reports/material-tracking?${query}`}
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                >
                                    Ver partidas
                                </Link>
                            </td>
                        </tr>
                    );
                })}
                <EmptyRow show={rows.length === 0} columns={7} />
            </tbody>
        </TableCard>
    );
}

function DetailTable({ rows }: { rows: TrackingRow[] }) {
    return (
        <TableCard>
            <thead className="sticky top-0 border-b bg-surface-subtle text-left text-xs text-text-secondary">
                <tr>
                    <th className="px-5 py-3">Vale</th>
                    <th className="px-4 py-3">Técnico</th>
                    <th className="px-4 py-3">Material</th>
                    <th className="px-4 py-3 text-right">Entregado</th>
                    <th className="px-4 py-3 text-right">Aplicado</th>
                    <th className="px-4 py-3 text-right">Devuelto</th>
                    <th className="px-4 py-3 text-right">Pendiente</th>
                    <th className="px-5 py-3">Estado</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={`${row.voucher_id}-${row.id}`}
                        className="border-b transition-colors last:border-0 hover:bg-hover/60"
                    >
                        <td className="px-5 py-4">
                            <Link
                                href={`/vouchers/${row.voucher_id}`}
                                className="font-semibold text-primary underline-offset-4 hover:underline"
                            >
                                #{row.folio}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                                {row.location.name} ·{' '}
                                {formatDate(row.issued_on)}
                            </p>
                        </td>
                        <td className="px-4 py-4">{row.received_by.name}</td>
                        <td className="px-4 py-4">
                            {row.description}
                            <p className="max-w-64 truncate text-xs text-muted-foreground">
                                {row.destination}
                            </p>
                        </td>
                        <Quantity value={row.quantity} unit={row.unit.symbol} />
                        <Quantity
                            value={row.used_quantity}
                            unit={row.unit.symbol}
                        />
                        <Quantity
                            value={row.returned_quantity}
                            unit={row.unit.symbol}
                        />
                        <Quantity
                            value={row.pending_quantity}
                            unit={row.unit.symbol}
                            emphasized
                        />
                        <td className="px-5 py-4">
                            <StatusBadge state={row.balance_state} />
                        </td>
                    </tr>
                ))}
                <EmptyRow show={rows.length === 0} columns={8} />
            </tbody>
        </TableCard>
    );
}

function TableCard({ children }: { children: React.ReactNode }) {
    return (
        <Card className="overflow-hidden py-0">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">{children}</table>
                </div>
            </CardContent>
        </Card>
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
        <td
            className={`px-4 py-4 text-right tabular-nums ${emphasized ? 'font-semibold text-warning' : ''} ${negative ? 'text-danger' : ''}`}
        >
            {formatQuantity(value)} {unit}
        </td>
    );
}

function EmptyRow({ show, columns }: { show: boolean; columns: number }) {
    if (!show) {
        return null;
    }

    return (
        <tr>
            <td
                colSpan={columns}
                className="px-5 py-16 text-center text-muted-foreground"
            >
                No hay material que coincida con los filtros seleccionados.
            </td>
        </tr>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    empty,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    empty: string;
    options: { value: string | number; label: string }[];
}) {
    const id = useId();

    return (
        <FormField>
            <FormLabel htmlFor={id}>{label}</FormLabel>
            <NativeSelect
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{empty}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </NativeSelect>
        </FormField>
    );
}
