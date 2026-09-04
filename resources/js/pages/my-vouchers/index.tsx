import { Head, Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Search,
    Wrench,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Page, PageHeader } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate, formatQuantity } from '@/lib/format';
import type { Paginated, Voucher } from '@/types';

type Props = {
    vouchers: Paginated<Voucher>;
    filters: { tab: 'pending' | 'settled'; search: string };
    counts: { pending: number; settled: number };
};

export default function MyVouchers({ vouchers, filters, counts }: Props) {
    const [search, setSearch] = useState(filters.search);
    const visit = (tab: 'pending' | 'settled', nextSearch = search) => {
        router.get(
            '/mis-vales',
            { tab, search: nextSearch || undefined },
            {
                preserveState: true,
                replace: true,
            },
        );
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        visit(filters.tab);
    };

    return (
        <>
            <Head title="Mis vales" />
            <Page width="wide">
                <PageHeader
                    eyebrow="Control personal"
                    title="Mis vales"
                    size="display"
                    description="Revisa el material que recibiste y documenta dónde fue aplicado. Cada cantidad conserva su unidad real."
                    actions={
                        <Badge variant="info" className="min-h-8 px-3">
                            <Wrench aria-hidden="true" /> Seguimiento desde 2026
                        </Badge>
                    }
                />

                <div className="flex flex-col gap-4 rounded-2xl border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div
                        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
                        role="tablist"
                        aria-label="Estado de vales"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filters.tab === 'pending'}
                            onClick={() => visit('pending')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${filters.tab === 'pending' ? 'bg-surface-raised text-warning shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Pendientes · {counts.pending}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={filters.tab === 'settled'}
                            onClick={() => visit('settled')}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${filters.tab === 'settled' ? 'bg-surface-raised text-success shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Liquidados · {counts.settled}
                        </button>
                    </div>
                    <form
                        onSubmit={submit}
                        className="flex w-full gap-2 sm:max-w-sm"
                    >
                        <div className="relative min-w-0 flex-1">
                            <Search
                                className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <Input
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                className="pl-9"
                                placeholder="Buscar folio, material o destino"
                                aria-label="Buscar en mis vales"
                            />
                        </div>
                        <Button variant="outline">Buscar</Button>
                    </form>
                </div>

                {vouchers.data.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-surface-subtle px-6 py-14 text-center">
                        {filters.tab === 'pending' ? (
                            <CheckCircle2
                                className="mx-auto size-10 text-success"
                                aria-hidden="true"
                            />
                        ) : (
                            <Wrench
                                className="mx-auto size-10 text-muted-foreground"
                                aria-hidden="true"
                            />
                        )}
                        <h2 className="mt-4 text-lg font-semibold">
                            {filters.search
                                ? 'No hay coincidencias'
                                : filters.tab === 'pending'
                                  ? 'No tienes material pendiente'
                                  : 'Aún no hay vales liquidados'}
                        </h2>
                        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                            {filters.tab === 'pending'
                                ? 'Los vales con saldo o inconsistencias aparecerán aquí.'
                                : 'Cuando documentes todo el material entregado, el vale pasará a este historial.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {vouchers.data.map((voucher) => (
                            <Card
                                key={voucher.id}
                                className="overflow-hidden border-border-strong py-0 transition-shadow hover:shadow-md"
                            >
                                <CardHeader className="border-b bg-muted/25 px-5 py-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <CardTitle>
                                                    Vale {voucher.folio}
                                                </CardTitle>
                                                <StatusBadge
                                                    state={
                                                        voucher.balance_state
                                                    }
                                                />
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {voucher.voucher_type.name} ·{' '}
                                                {formatDate(voucher.issued_on)}
                                            </p>
                                        </div>
                                        {voucher.balance_state ===
                                            'anomaly' && (
                                            <AlertTriangle
                                                className="size-5 shrink-0 text-danger"
                                                aria-label="Inconsistencia"
                                            />
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="px-5 py-4">
                                    <p className="line-clamp-2 text-sm text-text-secondary">
                                        {voucher.destination_summary ??
                                            'Sin destino o actividad registrada'}
                                    </p>
                                    <div className="mt-4 divide-y rounded-xl border">
                                        {voucher.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2.5 text-sm"
                                            >
                                                <span className="min-w-0 font-medium">
                                                    {item.description}
                                                </span>
                                                <span
                                                    className={
                                                        item.balance_state ===
                                                        'anomaly'
                                                            ? 'font-semibold text-danger tabular-nums'
                                                            : 'font-semibold text-warning tabular-nums'
                                                    }
                                                >
                                                    {formatQuantity(
                                                        item.pending_quantity,
                                                    )}{' '}
                                                    {item.unit.symbol}{' '}
                                                    pendientes
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <Button
                                        asChild
                                        className="mt-4 w-full sm:w-auto"
                                    >
                                        <Link href={`/mis-vales/${voucher.id}`}>
                                            Ver detalle y aplicaciones{' '}
                                            <ArrowRight data-icon="inline-end" />
                                        </Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {vouchers.last_page > 1 && (
                    <nav
                        aria-label="Paginación de mis vales"
                        className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground"
                    >
                        <span>
                            Mostrando {vouchers.from ?? 0}–{vouchers.to ?? 0} de{' '}
                            {vouchers.total}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                asChild={Boolean(vouchers.prev_page_url)}
                                disabled={!vouchers.prev_page_url}
                            >
                                {vouchers.prev_page_url ? (
                                    <Link href={vouchers.prev_page_url}>
                                        Anterior
                                    </Link>
                                ) : (
                                    <span>Anterior</span>
                                )}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                asChild={Boolean(vouchers.next_page_url)}
                                disabled={!vouchers.next_page_url}
                            >
                                {vouchers.next_page_url ? (
                                    <Link href={vouchers.next_page_url}>
                                        Siguiente
                                    </Link>
                                ) : (
                                    <span>Siguiente</span>
                                )}
                            </Button>
                        </div>
                    </nav>
                )}
            </Page>
        </>
    );
}
