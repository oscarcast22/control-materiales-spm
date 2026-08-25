import { Head, Link, router } from '@inertiajs/react';
import { Download, Filter } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate, formatQuantity } from '@/lib/format';
import type { Material, Named, StorageLocation, VoucherItem } from '@/types';

type Row = VoucherItem & {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: Named;
    location: StorageLocation;
    destination: string;
};
type Props = {
    rows: Row[];
    filters: Record<string, string | number | undefined>;
    receivers: Named[];
    materials: Material[];
    locations: StorageLocation[];
};

export default function Balances({
    rows,
    filters,
    receivers,
    materials,
    locations,
}: Props) {
    const [form, setForm] = useState({
        from: String(filters.from ?? ''),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        material_id: String(filters.material_id ?? ''),
        storage_location_id: String(filters.storage_location_id ?? ''),
    });
    const submit = (e: FormEvent) => {
        e.preventDefault();
        router.get('/reports/balances', form, {
            preserveState: true,
            replace: true,
        });
    };
    const query = new URLSearchParams(
        Object.entries(form)
            .filter(([, v]) => v)
            .map(([k, v]) => [k, v]),
    ).toString();

    return (
        <>
            <Head title="Saldos pendientes" />
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-7">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Saldos de material
                        </h1>
                        <p className="text-muted-foreground">
                            Todo lo que aún debe comprobarse o corregirse.
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <a href={`/reports/export?${query}`}>
                            <Download className="mr-2 size-4" />
                            Exportar XLSX
                        </a>
                    </Button>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={submit}
                            className="grid gap-3 md:grid-cols-6"
                        >
                            <Input
                                type="date"
                                value={form.from}
                                onChange={(e) =>
                                    setForm({ ...form, from: e.target.value })
                                }
                            />
                            <Input
                                type="date"
                                value={form.to}
                                onChange={(e) =>
                                    setForm({ ...form, to: e.target.value })
                                }
                            />
                            <select
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                value={form.received_by_id}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        received_by_id: e.target.value,
                                    })
                                }
                            >
                                <option value="">Todos los técnicos</option>
                                {receivers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                value={form.storage_location_id}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        storage_location_id: e.target.value,
                                    })
                                }
                            >
                                <option value="">Todas las áreas</option>
                                {locations.map((location) => (
                                    <option
                                        key={location.id}
                                        value={location.id}
                                    >
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                value={form.material_id}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        material_id: e.target.value,
                                    })
                                }
                            >
                                <option value="">Todos los materiales</option>
                                {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                            <Button>
                                <Filter className="mr-2 size-4" />
                                Filtrar
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
                                        <th className="px-5 py-3">Vale</th>
                                        <th className="px-4 py-3">Técnico</th>
                                        <th className="px-4 py-3">Material</th>
                                        <th className="px-4 py-3 text-right">
                                            Entregado
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Comprobado
                                        </th>
                                        <th className="px-5 py-3 text-right">
                                            Pendiente
                                        </th>
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
                                            <td className="px-4 py-4">
                                                {row.received_by.name}
                                            </td>
                                            <td className="px-4 py-4">
                                                {row.description}
                                                <p className="max-w-xs truncate text-xs text-muted-foreground">
                                                    {row.destination}
                                                </p>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {formatQuantity(row.quantity)}{' '}
                                                {row.unit.symbol}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {formatQuantity(
                                                    Number(row.used_quantity) +
                                                        Number(
                                                            row.returned_quantity,
                                                        ),
                                                )}{' '}
                                                {row.unit.symbol}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Badge
                                                    variant={
                                                        Number(
                                                            row.pending_quantity,
                                                        ) < 0
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                >
                                                    {formatQuantity(
                                                        row.pending_quantity,
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
                                                No hay saldos pendientes para
                                                estos filtros.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
