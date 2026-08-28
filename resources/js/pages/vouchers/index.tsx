import { Head, router } from '@inertiajs/react';
import { FilePlus2, Search, Wrench } from 'lucide-react';
import type { FormEvent } from 'react';
import { CancelledVoucherDialog } from '@/components/cancelled-voucher-dialog';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { FilterBar } from '@/components/filter-bar';
import { LoanedVoucherDialog } from '@/components/loaned-voucher-dialog';
import { Page, PageHeader } from '@/components/page';
import { Pagination } from '@/components/pagination';
import { QuickApplicationDialog } from '@/components/quick-application-dialog';
import { SearchableSelect } from '@/components/searchable-select';
import { SimpleSelect } from '@/components/simple-select';
import { SortableTableHead } from '@/components/sortable-table-head';
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
import {
    VoucherModalLink,
    useVoucherDialogs,
} from '@/components/voucher-dialogs';
import { useReactiveFilters } from '@/hooks/use-reactive-filters';
import { formatDate } from '@/lib/format';
import type { Named, Paginated, Voucher, VoucherType } from '@/types';

type Props = {
    vouchers: Paginated<Voucher>;
    receivers: Named[];
    voucherTypes: VoucherType[];
    filters: Record<string, string | number | null | undefined>;
};

type VoucherFilterState = {
    search: string;
    from: string;
    to: string;
    received_by_id: string;
    voucher_type_id: string;
    direction: string;
    status: string;
    sort: string;
    sort_direction: string;
};

const voucherReloadProps = ['vouchers', 'filters'];

const serializeVoucherFilters = (filters: VoucherFilterState) => ({
    ...filters,
    voucher_type_id: filters.voucher_type_id || 'all',
});

const baseFilters = {
    search: '',
    from: '',
    to: '',
    received_by_id: '',
    direction: '',
    status: '',
    sort: 'issued_on',
    sort_direction: 'desc',
};

export default function VoucherIndex({
    vouchers,
    receivers,
    voucherTypes,
    filters,
}: Props) {
    const warehouseTypeId = String(
        voucherTypes.find((type) => type.code === 'warehouse')?.id ?? '',
    );
    const defaultFilters: VoucherFilterState = {
        ...baseFilters,
        voucher_type_id: warehouseTypeId,
    };
    const initialFilters: VoucherFilterState = {
        search: String(filters.search ?? ''),
        from: String(filters.from ?? ''),
        to: String(filters.to ?? ''),
        received_by_id: String(filters.received_by_id ?? ''),
        voucher_type_id: String(filters.voucher_type_id ?? ''),
        direction: String(filters.direction ?? ''),
        status: String(filters.status ?? ''),
        sort: String(filters.sort ?? 'issued_on'),
        sort_direction: String(filters.sort_direction ?? 'desc'),
    };
    const {
        filters: form,
        flush,
        replaceFilters,
        updateFilter,
    } = useReactiveFilters({
        initial: initialFilters,
        url: '/vouchers',
        only: voucherReloadProps,
        serialize: serializeVoucherFilters,
    });
    const dialogs = useVoucherDialogs();
    const submit = (event: FormEvent) => {
        event.preventDefault();
        flush();
    };
    const clear = () => {
        replaceFilters(defaultFilters);
    };
    const activeFilters = [
        form.search,
        form.from,
        form.to,
        form.received_by_id,
        form.voucher_type_id === warehouseTypeId ? '' : 'voucher_type',
        form.direction,
        form.status,
    ].filter(Boolean).length;
    const changeSort = (sort: string) => {
        const sort_direction =
            form.sort === sort
                ? form.sort_direction === 'asc'
                    ? 'desc'
                    : 'asc'
                : sort === 'issued_on'
                  ? 'desc'
                  : 'asc';
        const next = { ...form, sort, sort_direction };
        replaceFilters(next);
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
                            <LoanedVoucherDialog voucherTypes={voucherTypes} />
                            <QuickApplicationDialog
                                trigger={
                                    <Button variant="outline">
                                        <Wrench data-icon="inline-start" />
                                        Registrar aplicación
                                    </Button>
                                }
                            />
                            <Button asChild>
                                <VoucherModalLink mode="create">
                                    <FilePlus2 data-icon="inline-start" />
                                    Nuevo vale
                                </VoucherModalLink>
                            </Button>
                        </>
                    }
                />

                <FilterBar
                    title="Buscar y filtrar vales"
                    description="Localiza un documento por folio, persona, material, fecha o estado. Los cambios se aplican automáticamente."
                    activeFilters={activeFilters}
                    onClear={clear}
                >
                    <form onSubmit={submit} className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-6 xl:grid-cols-12">
                            <FormField className="sm:col-span-2 md:col-span-6 xl:col-span-4">
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
                            <FormField className="md:col-span-2 xl:col-span-2">
                                <FormLabel htmlFor="voucher-type">
                                    Tipo de vale
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-type"
                                    value={form.voucher_type_id}
                                    onValueChange={(value) =>
                                        updateFilter('voucher_type_id', value)
                                    }
                                    options={voucherTypes.map((type) => ({
                                        value: String(type.id),
                                        label: type.name,
                                    }))}
                                    placeholder="Seleccionar tipo"
                                    emptyLabel="Todos los tipos"
                                />
                            </FormField>
                            <FormField className="md:col-span-2 xl:col-span-3">
                                <FormLabel htmlFor="voucher-technician">
                                    Técnico
                                </FormLabel>
                                <SearchableSelect
                                    id="voucher-technician"
                                    value={form.received_by_id}
                                    onValueChange={(value) =>
                                        updateFilter('received_by_id', value)
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
                            <FormField className="md:col-span-2 xl:col-span-3">
                                <FormLabel htmlFor="voucher-status">
                                    Estado
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-status"
                                    value={form.status}
                                    onValueChange={(value) =>
                                        updateFilter('status', value)
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
                        </div>
                        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-12">
                            <FormField className="xl:col-span-3">
                                <FormLabel htmlFor="voucher-direction">
                                    Movimiento
                                </FormLabel>
                                <SimpleSelect
                                    id="voucher-direction"
                                    value={form.direction}
                                    onValueChange={(value) =>
                                        updateFilter('direction', value)
                                    }
                                    options={[
                                        { value: 'entry', label: 'Entradas' },
                                        { value: 'exit', label: 'Salidas' },
                                    ]}
                                    placeholder="Seleccionar movimiento"
                                    emptyLabel="Entradas y salidas"
                                />
                            </FormField>
                            <FormField className="xl:col-span-3">
                                <FormLabel htmlFor="voucher-from">
                                    Desde
                                </FormLabel>
                                <Input
                                    id="voucher-from"
                                    type="date"
                                    value={form.from}
                                    max={form.to || undefined}
                                    onChange={(event) =>
                                        updateFilter('from', event.target.value)
                                    }
                                />
                            </FormField>
                            <FormField className="xl:col-span-3">
                                <FormLabel htmlFor="voucher-to">
                                    Hasta
                                </FormLabel>
                                <Input
                                    id="voucher-to"
                                    type="date"
                                    value={form.to}
                                    min={form.from || undefined}
                                    onChange={(event) =>
                                        updateFilter('to', event.target.value)
                                    }
                                />
                            </FormField>
                        </div>
                    </form>
                </FilterBar>

                <DataTableSurface label="Listado de vales">
                    <Table className="min-w-[980px]">
                        <TableHeader>
                            <TableRow>
                                <SortableTableHead
                                    label="Folio"
                                    active={form.sort === 'folio'}
                                    direction={
                                        form.sort_direction as 'asc' | 'desc'
                                    }
                                    onSort={() => changeSort('folio')}
                                />
                                <SortableTableHead
                                    label="Fecha"
                                    active={form.sort === 'issued_on'}
                                    direction={
                                        form.sort_direction as 'asc' | 'desc'
                                    }
                                    onSort={() => changeSort('issued_on')}
                                />
                                <SortableTableHead
                                    label="Tipo y movimiento"
                                    active={form.sort === 'voucher_type'}
                                    direction={
                                        form.sort_direction as 'asc' | 'desc'
                                    }
                                    onSort={() => changeSort('voucher_type')}
                                />
                                <SortableTableHead
                                    label="Recibió"
                                    active={form.sort === 'received_by'}
                                    direction={
                                        form.sort_direction as 'asc' | 'desc'
                                    }
                                    onSort={() => changeSort('received_by')}
                                />
                                <TableHead>Destino</TableHead>
                                <SortableTableHead
                                    label="Partidas"
                                    active={form.sort === 'items_count'}
                                    direction={
                                        form.sort_direction as 'asc' | 'desc'
                                    }
                                    onSort={() => changeSort('items_count')}
                                    align="right"
                                />
                                <TableHead>Estado</TableHead>
                                <TableHead>
                                    <span className="sr-only">Acciones</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vouchers.data.map((voucher) => (
                                <TableRow
                                    key={voucher.id}
                                    className="cursor-pointer"
                                    onClick={(event) => {
                                        if (
                                            !(
                                                event.target as HTMLElement
                                            ).closest(
                                                'a,button,input,select,textarea',
                                            )
                                        ) {
                                            dialogs.openDetail(voucher.id);
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <VoucherModalLink
                                            mode="detail"
                                            voucherId={voucher.id}
                                            className="font-semibold text-primary underline-offset-4 hover:underline"
                                        >
                                            Vale {voucher.folio}
                                        </VoucherModalLink>
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(voucher.issued_on)}
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-medium">
                                            {voucher.voucher_type.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {voucher.direction === 'entry'
                                                ? 'Entrada'
                                                : voucher.direction === 'exit'
                                                  ? 'Salida'
                                                  : 'Sin movimiento'}
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
                                            <VoucherModalLink
                                                mode="edit"
                                                voucherId={voucher.id}
                                            >
                                                Editar
                                                <span className="sr-only">
                                                    vale {voucher.folio}
                                                </span>
                                            </VoucherModalLink>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {vouchers.data.length === 0 && (
                                <TableEmpty
                                    colSpan={8}
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
