import { Head, router, useForm } from '@inertiajs/react';
import { Download, Filter, Plus } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatQuantity } from '@/lib/format';
import type {
    InventoryAdjustment,
    InventoryRow,
    Material,
    StorageLocation,
    Unit,
} from '@/types';

type Props = {
    rows: InventoryRow[];
    filters: Record<string, string | number | undefined>;
    locations: StorageLocation[];
    materials: Material[];
    units: Unit[];
    adjustments: InventoryAdjustment[];
};

export default function Inventory({
    rows,
    filters,
    locations,
    materials,
    units,
    adjustments,
}: Props) {
    const [query, setQuery] = useState({
        storage_location_id: String(filters.storage_location_id ?? ''),
        material_id: String(filters.material_id ?? ''),
        as_of: String(filters.as_of ?? new Date().toISOString().slice(0, 10)),
    });
    const exportQuery = new URLSearchParams({
        storage_location_id: query.storage_location_id,
        material_id: query.material_id,
        to: query.as_of,
    }).toString();

    return (
        <>
            <Head title="Existencias por área" />
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Existencias por área
                        </h1>
                        <p className="text-muted-foreground">
                            Movimiento neto desde la fecha de inicio de Almacén
                            o Patio.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <a href={`/reports/export?${exportQuery}`}>
                            <Download className="mr-2 size-4" />
                            Exportar XLSX
                        </a>
                    </Button>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                router.get('/reports/inventory', query, {
                                    preserveState: true,
                                    replace: true,
                                });
                            }}
                            className="grid gap-3 md:grid-cols-4"
                        >
                            <Select
                                value={query.storage_location_id}
                                onChange={(value) =>
                                    setQuery({
                                        ...query,
                                        storage_location_id: value,
                                    })
                                }
                                placeholder="Todas las áreas"
                                options={locations.map((row) => ({
                                    value: String(row.id),
                                    label: row.name,
                                }))}
                            />
                            <Select
                                value={query.material_id}
                                onChange={(value) =>
                                    setQuery({ ...query, material_id: value })
                                }
                                placeholder="Todos los materiales"
                                options={materials.map((row) => ({
                                    value: String(row.id),
                                    label: row.name,
                                }))}
                            />
                            <Input
                                type="date"
                                value={query.as_of}
                                onChange={(event) =>
                                    setQuery({
                                        ...query,
                                        as_of: event.target.value,
                                    })
                                }
                            />
                            <Button>
                                <Filter className="mr-2 size-4" />
                                Consultar
                            </Button>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-5 py-3">
                                            Área / material
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Entradas
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Salidas
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Devoluciones
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Ajustes
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Existencia neta
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr
                                            key={`${row.location.id}-${row.material.id}-${row.unit.id}`}
                                            className="border-b last:border-0"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-semibold">
                                                    {row.material.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {row.location.name} · desde{' '}
                                                    {formatDate(
                                                        row.location
                                                            .tracking_started_on,
                                                    )}{' '}
                                                    · {row.unit.symbol}
                                                </p>
                                            </td>
                                            {(
                                                [
                                                    'entries',
                                                    'exits',
                                                    'returns',
                                                    'adjustments',
                                                ] as const
                                            ).map((field) => (
                                                <td
                                                    key={field}
                                                    className="px-4 py-4 text-right"
                                                >
                                                    {formatQuantity(row[field])}
                                                </td>
                                            ))}
                                            <td className="px-5 py-4 text-right">
                                                <Badge
                                                    variant={
                                                        Number(row.available) <
                                                        0
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                >
                                                    {formatQuantity(
                                                        row.available,
                                                    )}{' '}
                                                    {row.unit.symbol}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                    {rows.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-5 py-16 text-center text-muted-foreground"
                                            >
                                                No existen movimientos para
                                                estos filtros.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
                <AdjustmentForm
                    locations={locations}
                    materials={materials}
                    units={units}
                />
                <Card>
                    <CardHeader>
                        <CardTitle>Ajustes recientes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {adjustments.map((adjustment) => (
                            <div
                                key={adjustment.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                            >
                                <div>
                                    <p className="font-medium">
                                        {adjustment.material.name} ·{' '}
                                        {adjustment.location.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDate(adjustment.occurred_on)} ·{' '}
                                        {adjustment.reason}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span
                                        className={
                                            Number(adjustment.quantity_delta) <
                                            0
                                                ? 'font-semibold text-red-700'
                                                : 'font-semibold text-emerald-700'
                                        }
                                    >
                                        {Number(adjustment.quantity_delta) > 0
                                            ? '+'
                                            : ''}
                                        {formatQuantity(
                                            adjustment.quantity_delta,
                                        )}{' '}
                                        {adjustment.unit.symbol}
                                    </span>
                                    {adjustment.voided_at ? (
                                        <Badge variant="secondary">
                                            Anulado
                                        </Badge>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                const reason = window.prompt(
                                                    'Motivo de anulación (mínimo 5 caracteres):',
                                                );

                                                if (reason) {
                                                    router.post(
                                                        `/inventory-adjustments/${adjustment.id}/void`,
                                                        { reason },
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    );
                                                }
                                            }}
                                        >
                                            Anular
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

function AdjustmentForm({
    locations,
    materials,
    units,
}: Pick<Props, 'locations' | 'materials' | 'units'>) {
    const form = useForm({
        storage_location_id: '',
        material_id: '',
        unit_id: '',
        occurred_on: new Date().toISOString().slice(0, 10),
        direction: 'increase',
        quantity: '',
        reason: '',
    });
    const selectedMaterial = materials.find(
        (row) => String(row.id) === form.data.material_id,
    );
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/inventory-adjustments', {
            preserveScroll: true,
            onSuccess: () => form.reset('quantity', 'reason'),
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <Plus className="mr-2 inline size-5" />
                    Ajuste auditado
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form
                    onSubmit={submit}
                    className="grid gap-4 md:grid-cols-3 xl:grid-cols-6"
                >
                    <Field label="Área" error={form.errors.storage_location_id}>
                        <Select
                            value={form.data.storage_location_id}
                            onChange={(value) =>
                                form.setData('storage_location_id', value)
                            }
                            placeholder="Seleccionar"
                            options={locations.map((row) => ({
                                value: String(row.id),
                                label: row.name,
                            }))}
                        />
                    </Field>
                    <Field label="Material" error={form.errors.material_id}>
                        <Select
                            value={form.data.material_id}
                            onChange={(value) => {
                                form.setData('material_id', value);
                                const material = materials.find(
                                    (row) => String(row.id) === value,
                                );

                                if (material) {
                                    form.setData(
                                        'unit_id',
                                        String(material.default_unit_id),
                                    );
                                }
                            }}
                            placeholder="Seleccionar"
                            options={materials.map((row) => ({
                                value: String(row.id),
                                label: row.name,
                            }))}
                        />
                    </Field>
                    <Field label="Unidad" error={form.errors.unit_id}>
                        <Select
                            value={form.data.unit_id}
                            onChange={(value) => form.setData('unit_id', value)}
                            placeholder={
                                selectedMaterial ? 'Unidad' : 'Elige material'
                            }
                            options={units.map((row) => ({
                                value: String(row.id),
                                label: `${row.name} (${row.symbol})`,
                            }))}
                        />
                    </Field>
                    <Field label="Fecha" error={form.errors.occurred_on}>
                        <Input
                            type="date"
                            value={form.data.occurred_on}
                            onChange={(event) =>
                                form.setData('occurred_on', event.target.value)
                            }
                        />
                    </Field>
                    <Field label="Tipo" error={form.errors.direction}>
                        <Select
                            value={form.data.direction}
                            onChange={(value) =>
                                form.setData('direction', value)
                            }
                            placeholder="Tipo"
                            options={[
                                { value: 'increase', label: 'Aumentar' },
                                { value: 'decrease', label: 'Disminuir' },
                            ]}
                        />
                    </Field>
                    <Field label="Cantidad" error={form.errors.quantity}>
                        <Input
                            inputMode="decimal"
                            value={form.data.quantity}
                            onChange={(event) =>
                                form.setData('quantity', event.target.value)
                            }
                        />
                    </Field>
                    <div className="md:col-span-3 xl:col-span-5">
                        <Field
                            label="Motivo obligatorio"
                            error={form.errors.reason}
                        >
                            <Input
                                value={form.data.reason}
                                onChange={(event) =>
                                    form.setData('reason', event.target.value)
                                }
                                placeholder="Conteo físico, corrección documentada…"
                            />
                        </Field>
                    </div>
                    <Button className="self-end" disabled={form.processing}>
                        Registrar ajuste
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function Select({
    value,
    onChange,
    placeholder,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    options: { value: string; label: string }[];
}) {
    return (
        <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            <option value="">{placeholder}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
