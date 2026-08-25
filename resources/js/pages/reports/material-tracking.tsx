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
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

const stateLabel: Record<string, string> = {
    pending: 'Pendiente',
    settled: 'Liquidado',
    anomaly: 'Inconsistencia',
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
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-sky-700">
                            Control desde el 1 de enero de 2026
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Seguimiento de material
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            Material entregado a técnicos, aplicado, devuelto y
                            pendiente de comprobar.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <a href={`/reports/export?${query}`}>
                            <Download className="mr-2 size-4" />
                            Exportar XLSX
                        </a>
                    </Button>
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                    <strong>
                        Este reporte no representa existencias de almacén.
                    </strong>{' '}
                    El pendiente es material que el técnico todavía debe aplicar
                    en un trabajo o devolver. Las cantidades solo se suman
                    cuando corresponden al mismo material y unidad.
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <Metric
                        title="Vales entregados"
                        value={metrics.delivered_vouchers}
                        icon={Truck}
                    />
                    <Metric
                        title="Vales pendientes"
                        value={metrics.pending_vouchers}
                        icon={ClipboardCheck}
                        tone="amber"
                    />
                    <Metric
                        title="Partidas pendientes"
                        value={metrics.pending_items}
                        icon={PackageOpen}
                        tone="amber"
                    />
                    <Metric
                        title="Vales liquidados"
                        value={metrics.settled_vouchers}
                        icon={CheckCircle2}
                        tone="green"
                    />
                    <Metric
                        title="Inconsistencias"
                        value={metrics.anomalies}
                        icon={AlertTriangle}
                        tone="red"
                    />
                    <Metric
                        title="Técnicos con pendientes"
                        value={metrics.technicians_with_pending}
                        icon={Users}
                    />
                </div>

                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={submit}
                            className="grid gap-3 md:grid-cols-2 xl:grid-cols-7"
                        >
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                Desde
                                <Input
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
                            </label>
                            <label className="grid gap-1 text-xs text-muted-foreground">
                                Hasta
                                <Input
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
                            </label>
                            <FilterSelect
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
                            <Button className="self-end">
                                <Filter className="mr-2 size-4" />
                                Filtrar
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <div className="flex w-fit rounded-lg border bg-muted/30 p-1">
                    <TabButton
                        active={form.tab === 'material'}
                        onClick={() => changeTab('material')}
                    >
                        Por material
                    </TabButton>
                    <TabButton
                        active={form.tab === 'technician'}
                        onClick={() => changeTab('technician')}
                    >
                        Por técnico
                    </TabButton>
                    <TabButton
                        active={form.tab === 'detail'}
                        onClick={() => changeTab('detail')}
                    >
                        Detalle
                    </TabButton>
                </div>

                {form.tab === 'material' && (
                    <MaterialTable rows={by_material} />
                )}
                {form.tab === 'technician' && (
                    <TechnicianTable rows={by_technician} filters={form} />
                )}
                {form.tab === 'detail' && <DetailTable rows={rows} />}
            </div>
        </>
    );
}

function MaterialTable({ rows }: { rows: MaterialSummary[] }) {
    return (
        <TableCard>
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
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
                        className="border-b last:border-0"
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
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
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
                            className="border-b last:border-0"
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
                            <td className="px-4 py-4 text-right font-semibold text-amber-700">
                                {row.pending_items_count}
                            </td>
                            <td className="px-4 py-4 text-right">
                                {row.settled_items_count}
                            </td>
                            <td className="px-4 py-4 text-right text-red-700">
                                {row.anomalies_count}
                            </td>
                            <td className="px-5 py-4 text-right">
                                <Link
                                    href={`/reports/material-tracking?${query}`}
                                    className="font-medium text-sky-700 hover:underline"
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
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
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
                        className="border-b last:border-0"
                    >
                        <td className="px-5 py-4">
                            <Link
                                href={`/vouchers/${row.voucher_id}`}
                                className="font-semibold text-sky-700 hover:underline"
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
                            <Badge
                                variant={
                                    row.balance_state === 'anomaly'
                                        ? 'destructive'
                                        : row.balance_state === 'settled'
                                          ? 'secondary'
                                          : 'outline'
                                }
                            >
                                {stateLabel[row.balance_state]}
                            </Badge>
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
        <Card>
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
            className={`px-4 py-4 text-right ${emphasized ? 'font-semibold' : ''} ${negative ? 'text-red-700' : ''}`}
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
    value,
    onChange,
    empty,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    empty: string;
    options: { value: string | number; label: string }[];
}) {
    return (
        <select
            className="h-9 self-end rounded-md border bg-background px-3 text-sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            <option value="">{empty}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="sm"
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

function Metric({
    title,
    value,
    icon: Icon,
    tone = 'blue',
}: {
    title: string;
    value: number;
    icon: typeof Truck;
    tone?: 'blue' | 'amber' | 'green' | 'red';
}) {
    const colors = {
        blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950',
        green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950',
        red: 'bg-red-50 text-red-700 dark:bg-red-950',
    };

    return (
        <Card>
            <CardContent className="flex items-center gap-3 p-4">
                <div className={`rounded-xl p-2.5 ${colors[tone]}`}>
                    <Icon className="size-5" />
                </div>
                <div>
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground">{title}</p>
                </div>
            </CardContent>
        </Card>
    );
}
