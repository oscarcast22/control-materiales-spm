import { Head, Link, router } from '@inertiajs/react';
import { FilePlus2, Filter, Search, Wrench, X } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { CancelledVoucherDialog } from '@/components/cancelled-voucher-dialog';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { Page, PageHeader } from '@/components/page';
import { Pagination } from '@/components/pagination';
import { QuickApplicationDialog } from '@/components/quick-application-dialog';
import { SearchableSelect } from '@/components/searchable-select';
import { SimpleSelect } from '@/components/simple-select';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { formatDate } from '@/lib/format';
import type { Named, Paginated, Voucher, VoucherType } from '@/types';

type Props = {
    vouchers: Paginated<Voucher>;
    receivers: Named[];
    voucherTypes: VoucherType[];
    filters: Record<string, string | number | undefined>;
};

const emptyFilters = {
    search: '',
    from: '',
    to: '',
    received_by_id: '',
    voucher_type_id: '',
    direction: '',
    status: '',
};

export default function VoucherIndex({
    vouchers,
    receivers,
    voucherTypes,
    filters,
}: Props) {
    const [form, setForm] = useState({
        search: String(filters.search ?? ''),
        from: String(filters.from ?? ''),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        voucher_type_id: String(filters.voucher_type_id ?? ''),
        direction: String(filters.direction ?? ''),
        status: String(filters.status ?? ''),
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/vouchers', form, { preserveState: true, replace: true });
    };
    const clear = () => {
        setForm(emptyFilters);
        router.get('/vouchers');
    };

    return (
        <>
            <Head title="Vales" />
            <Page width="wide">
                <PageHeader
                    title="Vales"
                    description={`${vouchers.total} registros localizados. Consulta salidas, entradas y su estado de comprobación.`}
                    actions={
                        <>
                            <CancelledVoucherDialog
                                voucherTypes={voucherTypes}
                            />
                            <QuickApplicationDialog
                                trigger={
                                    <Button>
                                        <Wrench data-icon="inline-start" />
                                        Registrar aplicación
                                    </Button>
                                }
                            />
                            <Button variant="outline" asChild>
                                <Link href="/vouchers/create">
                                    <FilePlus2 data-icon="inline-start" />
                                    Nuevo vale
                                </Link>
                            </Button>
                        </>
                    }
                />

                <FilterBar>
                    <form onSubmit={submit} className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
                            <FormField className="sm:col-span-2 xl:col-span-4">
                                <FormLabel htmlFor="voucher-search">
                                    Buscar
                                </FormLabel>
                                <div className="relative">
                                    <Search
                                        aria-hidden="true"
                                        className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="voucher-search"
                                        className="pl-9"
                                        value={form.search}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                search: event.target.value,
                                            })
                                        }
                                        placeholder="Folio, destino, técnico o material"
                                    />
                                </div>
                            </FormField>
                            <FormField className="xl:col-span-2">
                                <FormLabel htmlFor="voucher-from">
                                    Desde
                                </FormLabel>
                                <Input
                                    id="voucher-from"
                                    type="date"
                                    value={form.from}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            from: event.target.value,
                                        })
                                    }
                                />
                            </FormField>
                            <FormField className="xl:col-span-2">
                                <FormLabel htmlFor="voucher-to">
                                    Hasta
                                </FormLabel>
                                <Input
                                    id="voucher-to"
                                    type="date"
                                    value={form.to}
                                    onChange={(event) =>
                                        setForm({
                                            ...form,
                                            to: event.target.value,
                                        })
                                    }
                                />
                            </FormField>
                            <FormField className="xl:col-span-2">
                                <FormLabel htmlFor="voucher-technician">
                                    Técnico
                                </FormLabel>
                                <SearchableSelect
                                    id="voucher-technician"
                                    value={form.received_by_id}
                                    onValueChange={(value) =>
                                        setForm({
                                            ...form,
                                            received_by_id: value,
                                        })
                                    }
                                    options={receivers.map((person) => ({
                                        value: String(person.id),
                                        label: person.name,
                                    }))}
                                    placeholder="Seleccionar técnico"
                                    searchPlaceholder="Buscar técnico…"
                                    emptyMessage="No se encontró ningún técnico."
                                    emptyLabel="Todos los técnicos"
                                />
                            </FormField>
                            <FormField className="xl:col-span-2">
                                <FormLabel htmlFor="voucher-type">
                                    Tipo de vale
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-type"
                                    value={form.voucher_type_id}
                                    onValueChange={(value) =>
                                        setForm({
                                            ...form,
                                            voucher_type_id: value,
                                        })
                                    }
                                    options={voucherTypes.map((type) => ({
                                        value: String(type.id),
                                        label: type.name,
                                    }))}
                                    placeholder="Seleccionar tipo"
                                    emptyLabel="Todos los tipos"
                                />
                            </FormField>
                        </div>
                        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-end">
                            <FormField className="sm:w-52">
                                <FormLabel htmlFor="voucher-direction">
                                    Movimiento
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-direction"
                                    value={form.direction}
                                    onValueChange={(value) =>
                                        setForm({
                                            ...form,
                                            direction: value,
                                        })
                                    }
                                    options={[
                                        { value: 'entry', label: 'Entradas' },
                                        { value: 'exit', label: 'Salidas' },
                                    ]}
                                    placeholder="Seleccionar movimiento"
                                    emptyLabel="Entradas y salidas"
                                />
                            </FormField>
                            <FormField className="sm:w-52">
                                <FormLabel htmlFor="voucher-status">
                                    Estado
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-status"
                                    value={form.status}
                                    onValueChange={(value) =>
                                        setForm({
                                            ...form,
                                            status: value,
                                        })
                                    }
                                    options={[
                                        {
                                            value: 'pending',
                                            label: 'Pendientes',
                                        },
                                        {
                                            value: 'settled',
                                            label: 'Liquidados',
                                        },
                                        {
                                            value: 'anomaly',
                                            label: 'Inconsistencias',
                                        },
                                        {
                                            value: 'cancelled',
                                            label: 'Cancelados',
                                        },
                                        {
                                            value: 'loaned',
                                            label: 'Prestados',
                                        },
                                        {
                                            value: 'review',
                                            label: 'Por revisar',
                                        },
                                    ]}
                                    placeholder="Seleccionar estado"
                                    emptyLabel="Todos los estados"
                                />
                            </FormField>
                            <div className="flex gap-2 sm:ml-auto">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={clear}
                                >
                                    <X data-icon="inline-start" />
                                    Limpiar
                                </Button>
                                <Button type="submit">
                                    <Filter data-icon="inline-start" />
                                    Aplicar filtros
                                </Button>
                            </div>
                        </div>
                    </form>
                </FilterBar>

                <DataTableSurface>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Folio y fecha</TableHead>
                                <TableHead>Recibió</TableHead>
                                <TableHead>Destino</TableHead>
                                <TableHead className="text-right">
                                    Partidas
                                </TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>
                                    <span className="sr-only">Acciones</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vouchers.data.map((voucher) => (
                                <TableRow key={voucher.id}>
                                    <TableCell>
                                        <p className="font-semibold">
                                            Vale {voucher.folio}
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {voucher.voucher_type.name} ·{' '}
                                            {voucher.direction === 'entry'
                                                ? 'Entrada'
                                                : voucher.direction === 'exit'
                                                  ? 'Salida'
                                                  : 'Sin movimiento'}{' '}
                                            · {formatDate(voucher.issued_on)}
                                        </p>
                                    </TableCell>
                                    <TableCell>
                                        {voucher.received_by?.name ?? '—'}
                                    </TableCell>
                                    <TableCell className="max-w-md truncate">
                                        {voucher.destination_summary ?? '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {voucher.items_count}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1.5">
                                            <StatusBadge
                                                state={voucher.balance_state}
                                            />
                                            {voucher.status === 'loaned' && (
                                                <Badge variant="secondary">
                                                    Prestado
                                                </Badge>
                                            )}
                                            {voucher.needs_review && (
                                                <Badge variant="warning">
                                                    Requiere revisión
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <Link
                                                href={`/vouchers/${voucher.id}`}
                                            >
                                                Ver detalle
                                                <span className="sr-only">
                                                    vale {voucher.folio}
                                                </span>
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {vouchers.data.length === 0 && (
                                <TableEmpty
                                    colSpan={6}
                                    title="No se encontraron vales"
                                    description="Ajusta los filtros o captura un nuevo vale para comenzar."
                                />
                            )}
                        </TableBody>
                    </Table>
                </DataTableSurface>

                <Pagination
                    from={vouchers.from}
                    to={vouchers.to}
                    total={vouchers.total}
                    hasPrevious={Boolean(vouchers.prev_page_url)}
                    hasNext={Boolean(vouchers.next_page_url)}
                    onPrevious={() =>
                        vouchers.prev_page_url &&
                        router.get(
                            vouchers.prev_page_url,
                            {},
                            { preserveState: true },
                        )
                    }
                    onNext={() =>
                        vouchers.next_page_url &&
                        router.get(
                            vouchers.next_page_url,
                            {},
                            { preserveState: true },
                        )
                    }
                />
            </Page>
        </>
    );
}
