import { Head, Link, router } from '@inertiajs/react';
import { FilePlus2, Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import type { Named, Paginated, StorageLocation, Voucher } from '@/types';

type Props = {
    vouchers: Paginated<Voucher>;
    receivers: Named[];
    locations: StorageLocation[];
    filters: Record<string, string | number | undefined>;
};
const labels: Record<string, string> = {
    pending: 'Pendiente',
    settled: 'Liquidado',
    anomaly: 'Anomalía',
    cancelled: 'Cancelado',
    received: 'Entrada recibida',
};

export default function VoucherIndex({
    vouchers,
    receivers,
    locations,
    filters,
}: Props) {
    const [form, setForm] = useState({
        search: String(filters.search ?? ''),
        from: String(filters.from ?? ''),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        storage_location_id: String(filters.storage_location_id ?? ''),
        direction: String(filters.direction ?? ''),
        status: String(filters.status ?? ''),
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/vouchers', form, { preserveState: true, replace: true });
    };

    return (
        <>
            <Head title="Vales" />
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-7">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">
                            Vales de material
                        </h1>
                        <p className="text-muted-foreground">
                            {vouchers.total} registros localizados.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/vouchers/create">
                            <FilePlus2 className="mr-2 size-4" />
                            Nuevo vale
                        </Link>
                    </Button>
                </div>
                <Card>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={submit}
                            className="grid gap-3 md:grid-cols-8"
                        >
                            <div className="relative md:col-span-2">
                                <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
                                <Input
                                    className="pl-9"
                                    value={form.search}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            search: e.target.value,
                                        })
                                    }
                                    placeholder="Folio, destino, técnico o material"
                                />
                            </div>
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
                                value={form.direction}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        direction: e.target.value,
                                    })
                                }
                            >
                                <option value="">Entradas y salidas</option>
                                <option value="entry">Entradas</option>
                                <option value="exit">Salidas</option>
                            </select>
                            <select
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                value={form.status}
                                onChange={(e) =>
                                    setForm({ ...form, status: e.target.value })
                                }
                            >
                                <option value="">Todos los estados</option>
                                <option value="pending">Pendientes</option>
                                <option value="settled">Liquidados</option>
                                <option value="anomaly">Anomalías</option>
                                <option value="cancelled">Cancelados</option>
                                <option value="review">Por revisar</option>
                            </select>
                            <div className="flex gap-2 md:col-span-8">
                                <Button type="submit">Aplicar filtros</Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                        const empty = {
                                            search: '',
                                            from: '',
                                            to: '',
                                            received_by_id: '',
                                            storage_location_id: '',
                                            direction: '',
                                            status: '',
                                        };
                                        setForm(empty);
                                        router.get('/vouchers');
                                    }}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-6 py-3">
                                            Folio / fecha
                                        </th>
                                        <th className="px-4 py-3">Recibió</th>
                                        <th className="px-4 py-3">Destino</th>
                                        <th className="px-4 py-3">
                                            Materiales
                                        </th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vouchers.data.map((voucher) => (
                                        <tr
                                            key={voucher.id}
                                            className="border-b last:border-0 hover:bg-muted/20"
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-semibold">
                                                    #{voucher.folio}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {voucher.location.name} ·{' '}
                                                    {voucher.direction ===
                                                    'entry'
                                                        ? 'Entrada'
                                                        : 'Salida'}{' '}
                                                    ·{' '}
                                                    {formatDate(
                                                        voucher.issued_on,
                                                    )}
                                                </p>
                                            </td>
                                            <td className="px-4 py-4">
                                                {voucher.received_by.name}
                                            </td>
                                            <td className="max-w-md truncate px-4 py-4">
                                                {voucher.destination}
                                            </td>
                                            <td className="px-4 py-4">
                                                {voucher.items_count}
                                            </td>
                                            <td className="px-4 py-4">
                                                <Badge
                                                    variant={
                                                        voucher.balance_state ===
                                                        'anomaly'
                                                            ? 'destructive'
                                                            : voucher.balance_state ===
                                                                'settled'
                                                              ? 'secondary'
                                                              : 'outline'
                                                    }
                                                >
                                                    {
                                                        labels[
                                                            voucher
                                                                .balance_state
                                                        ]
                                                    }
                                                </Badge>
                                                {voucher.needs_review && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-1 border-amber-400 text-amber-700"
                                                    >
                                                        Revisar
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/vouchers/${voucher.id}`}
                                                    >
                                                        Abrir
                                                    </Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {vouchers.data.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-16 text-center text-muted-foreground"
                                            >
                                                No se encontraron vales.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        {vouchers.from ?? 0}–{vouchers.to ?? 0} de{' '}
                        {vouchers.total}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!vouchers.prev_page_url}
                            onClick={() =>
                                vouchers.prev_page_url &&
                                router.get(
                                    vouchers.prev_page_url,
                                    {},
                                    { preserveState: true },
                                )
                            }
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!vouchers.next_page_url}
                            onClick={() =>
                                vouchers.next_page_url &&
                                router.get(
                                    vouchers.next_page_url,
                                    {},
                                    { preserveState: true },
                                )
                            }
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
