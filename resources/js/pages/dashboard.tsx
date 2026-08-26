import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    PackageOpen,
    Plus,
    SearchCheck,
    Users,
} from 'lucide-react';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { MetricCard } from '@/components/metric-card';
import { Page, PageHeader, SectionHeader } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate, formatQuantity } from '@/lib/format';
import type { StorageLocation, Voucher, VoucherItem } from '@/types';

type PendingRow = Omit<VoucherItem, 'dispositions'> & {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: { id: number; name: string };
    location: StorageLocation;
};

type Props = {
    metrics: {
        pending_vouchers: number;
        pending_items: number;
        settled_vouchers: number;
        anomalies: number;
        needs_review: number;
        technicians_with_pending: number;
    };
    recent: Voucher[];
    oldest_pending: PendingRow[];
};

export default function Dashboard({ metrics, recent, oldest_pending }: Props) {
    return (
        <>
            <Head title="Resumen" />
            <Page width="wide">
                <PageHeader
                    eyebrow="Vista operativa"
                    title="Control de materiales"
                    description="Identifica primero lo que requiere atención y continúa con la actividad más reciente."
                    actions={
                        <Button asChild>
                            <Link href="/vouchers/create">
                                <Plus data-icon="inline-start" />
                                Capturar vale
                            </Link>
                        </Button>
                    }
                />

                <section aria-labelledby="prioridades-title">
                    <h2 id="prioridades-title" className="sr-only">
                        Prioridades operativas
                    </h2>
                    <div className="grid gap-3 md:grid-cols-3">
                        <MetricCard
                            label="Vales con saldo pendiente"
                            value={metrics.pending_vouchers}
                            icon={ClipboardCheck}
                            tone="warning"
                            emphasis="primary"
                        />
                        <MetricCard
                            label="Partidas aún por comprobar"
                            value={metrics.pending_items}
                            icon={PackageOpen}
                            tone="warning"
                            emphasis="primary"
                        />
                        <MetricCard
                            label="Inconsistencias que requieren atención"
                            value={metrics.anomalies}
                            icon={AlertTriangle}
                            tone="danger"
                            emphasis="primary"
                        />
                    </div>
                    <div className="mt-4 grid border-y sm:grid-cols-3">
                        <MetricCard
                            label="Vales liquidados"
                            value={metrics.settled_vouchers}
                            icon={CheckCircle2}
                            tone="success"
                        />
                        <MetricCard
                            label="Registros por revisar"
                            value={metrics.needs_review}
                            icon={SearchCheck}
                            tone="info"
                        />
                        <MetricCard
                            label="Técnicos con pendientes"
                            value={metrics.technicians_with_pending}
                            icon={Users}
                            tone="neutral"
                        />
                    </div>
                </section>

                <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
                    <section className="min-w-0" aria-labelledby="oldest-title">
                        <SectionHeader
                            title="Pendientes más antiguos"
                            description="Partidas abiertas ordenadas por antigüedad."
                            action={
                                <Button variant="ghost" size="sm" asChild>
                                    <Link href="/reports/material-tracking?tab=detail&state=pending">
                                        Ver seguimiento
                                        <ArrowRight data-icon="inline-end" />
                                    </Link>
                                </Button>
                            }
                        />
                        <div className="mt-3">
                            <DataTableSurface>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vale</TableHead>
                                            <TableHead>Técnico</TableHead>
                                            <TableHead>Material</TableHead>
                                            <TableHead className="text-right">
                                                Pendiente
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {oldest_pending.map((row) => (
                                            <TableRow
                                                key={`${row.voucher_id}-${row.id}`}
                                            >
                                                <TableCell>
                                                    <Link
                                                        className="font-semibold text-primary underline-offset-4 hover:underline"
                                                        href={`/vouchers/${row.voucher_id}`}
                                                    >
                                                        Vale {row.folio}
                                                    </Link>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {row.location.name} ·{' '}
                                                        {formatDate(
                                                            row.issued_on,
                                                        )}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    {row.received_by.name}
                                                </TableCell>
                                                <TableCell className="max-w-72 truncate">
                                                    {row.description}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-warning tabular-nums">
                                                    {formatQuantity(
                                                        row.pending_quantity,
                                                    )}{' '}
                                                    <span className="text-xs font-normal text-muted-foreground">
                                                        {row.unit.symbol}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {oldest_pending.length === 0 && (
                                            <TableEmpty
                                                colSpan={4}
                                                title="Sin material pendiente"
                                                description="Todas las partidas registradas están comprobadas o devueltas."
                                            />
                                        )}
                                    </TableBody>
                                </Table>
                            </DataTableSurface>
                        </div>
                    </section>

                    <section aria-labelledby="recent-title">
                        <SectionHeader
                            title="Actividad reciente"
                            description="Últimos vales capturados o actualizados."
                        />
                        <div className="mt-3 overflow-hidden rounded-lg border bg-surface">
                            {recent.map((voucher) => (
                                <Link
                                    key={voucher.id}
                                    href={`/vouchers/${voucher.id}`}
                                    className="group flex min-h-16 items-center justify-between gap-4 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-hover focus-visible:bg-hover focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none focus-visible:ring-inset"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium group-hover:text-primary">
                                            Vale {voucher.folio}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {voucher.location.name} ·{' '}
                                            {voucher.direction === 'entry'
                                                ? 'Entrada'
                                                : 'Salida'}{' '}
                                            · {voucher.received_by.name} ·{' '}
                                            {formatDate(voucher.issued_on)}
                                        </p>
                                    </div>
                                    <StatusBadge
                                        state={voucher.balance_state}
                                    />
                                </Link>
                            ))}
                            {recent.length === 0 && (
                                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                                    Todavía no hay vales capturados.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </Page>
        </>
    );
}
