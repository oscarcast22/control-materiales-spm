import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    ChevronDown,
    PackageOpen,
    Plus,
    SearchCheck,
    Users,
} from 'lucide-react';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { MetricCard } from '@/components/metric-card';
import { Page, PageHeader, SectionHeader } from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { VoucherModalLink } from '@/components/voucher-dialogs';
import { formatDate, formatQuantity } from '@/lib/format';
import type { Voucher, VoucherItem, VoucherType } from '@/types';

type PendingRow = Omit<VoucherItem, 'applications'> & {
    voucher_id: number;
    folio: string;
    issued_on: string;
    received_by: { id: number; name: string };
    voucher_type: VoucherType;
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
    voucher_sequence: {
        total_missing: number;
        types: {
            voucher_type: Pick<VoucherType, 'id' | 'name' | 'code'>;
            start: number;
            last: number | null;
            missing_count: number;
            missing: number[];
            missing_truncated: boolean;
        }[];
    };
};

export default function Dashboard({
    metrics,
    recent,
    oldest_pending,
    voucher_sequence,
}: Props) {
    const trackingQuery = new URLSearchParams({
        tab: 'detail',
        state: 'pending',
    }).toString();

    return (
        <>
            <Head title="Resumen" />
            <Page width="wide">
                <PageHeader
                    eyebrow="Vista operativa"
                    title="Resumen general"
                    size="display"
                    description="Panorama conjunto de los vales de Almacén y Patio, con sus pendientes y actividad reciente."
                    actions={
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge
                                variant="info"
                                className="min-h-8 px-3 font-mono text-[11px] tracking-[0.04em]"
                            >
                                Seguimiento · 2026
                            </Badge>
                            <Button asChild>
                                <VoucherModalLink mode="create">
                                    <Plus data-icon="inline-start" />
                                    Capturar vale
                                </VoucherModalLink>
                            </Button>
                        </div>
                    }
                />

                {voucher_sequence.total_missing > 0 && (
                    <Alert variant="warning">
                        <AlertTriangle aria-hidden="true" />
                        <AlertTitle>
                            Hay {voucher_sequence.total_missing}{' '}
                            {voucher_sequence.total_missing === 1
                                ? 'folio faltante'
                                : 'folios faltantes'}
                        </AlertTitle>
                        <AlertDescription>
                            <p>
                                Revisa la numeración antes de archivar los vales
                                físicos. Los cancelados y prestados también
                                cuentan como folios presentes.
                            </p>
                            <Collapsible className="mt-2">
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                        Ver detalle por tipo
                                        <ChevronDown data-icon="inline-end" />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-3 flex flex-col gap-3">
                                    {voucher_sequence.types
                                        .filter((row) => row.missing_count > 0)
                                        .map((row) => (
                                            <div key={row.voucher_type.id}>
                                                <p className="text-sm font-medium text-foreground">
                                                    {row.voucher_type.name}{' '}
                                                    <span className="font-normal text-muted-foreground">
                                                        · desde {row.start}
                                                    </span>
                                                </p>
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {row.missing.map(
                                                        (folio) => (
                                                            <Badge
                                                                key={folio}
                                                                variant="outline"
                                                                className="bg-background font-mono"
                                                            >
                                                                {folio}
                                                            </Badge>
                                                        ),
                                                    )}
                                                </div>
                                                {row.missing_truncated && (
                                                    <p className="mt-2 text-xs text-muted-foreground">
                                                        Se muestran los primeros{' '}
                                                        {row.missing.length} de{' '}
                                                        {row.missing_count}{' '}
                                                        folios faltantes.
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                </CollapsibleContent>
                            </Collapsible>
                        </AlertDescription>
                    </Alert>
                )}

                <section aria-labelledby="prioridades-title">
                    <SectionHeader
                        id="prioridades-title"
                        title="Prioridad operativa"
                        description="Responsabilidad abierta que conviene atender primero."
                        action={
                            <Badge
                                variant="success"
                                asChild
                                className="min-h-8 px-3 transition-[background-color,border-color,color] hover:border-success/20 hover:bg-success-subtle/70"
                            >
                                <Link href="/reports/material-tracking?tab=detail&state=settled">
                                    <CheckCircle2 aria-hidden="true" />
                                    {metrics.settled_vouchers}{' '}
                                    {metrics.settled_vouchers === 1
                                        ? 'vale liquidado'
                                        : 'vales liquidados'}
                                </Link>
                            </Badge>
                        }
                    />
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <MetricCard
                            label="Vales con saldo pendiente"
                            value={metrics.pending_vouchers}
                            icon={ClipboardCheck}
                            tone="warning"
                        />
                        <MetricCard
                            label="Materiales por comprobar"
                            value={metrics.pending_items}
                            icon={PackageOpen}
                            tone="warning"
                        />
                        <MetricCard
                            label="Técnicos con pendientes"
                            value={metrics.technicians_with_pending}
                            icon={Users}
                            tone="neutral"
                        />
                    </div>
                    {(metrics.anomalies > 0 || metrics.needs_review > 0) && (
                        <div
                            data-slot="metric-notices"
                            className="mt-3 grid gap-2 sm:grid-cols-2"
                        >
                            {metrics.anomalies > 0 && (
                                <Alert variant="destructive" className="py-3">
                                    <AlertTriangle aria-hidden="true" />
                                    <AlertTitle>
                                        {metrics.anomalies}{' '}
                                        {metrics.anomalies === 1
                                            ? 'inconsistencia requiere atención'
                                            : 'inconsistencias requieren atención'}
                                    </AlertTitle>
                                    <AlertDescription>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href="/reports/material-tracking?tab=detail&state=anomaly">
                                                Ver inconsistencias
                                                <ArrowRight data-icon="inline-end" />
                                            </Link>
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {metrics.needs_review > 0 && (
                                <Alert variant="info" className="py-3">
                                    <SearchCheck aria-hidden="true" />
                                    <AlertTitle>
                                        {metrics.needs_review}{' '}
                                        {metrics.needs_review === 1
                                            ? 'vale requiere revisión'
                                            : 'vales requieren revisión'}
                                    </AlertTitle>
                                    <AlertDescription>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <Link href="/vouchers?voucher_type_id=all&status=review">
                                                Ver vales por revisar
                                                <ArrowRight data-icon="inline-end" />
                                            </Link>
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </section>

                <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
                    <section className="min-w-0" aria-labelledby="oldest-title">
                        <SectionHeader
                            id="oldest-title"
                            title="Pendientes más antiguos"
                            description="Partidas abiertas ordenadas por antigüedad."
                            action={
                                <Button variant="ghost" size="sm" asChild>
                                    <Link
                                        href={`/reports/material-tracking?${trackingQuery}`}
                                    >
                                        Ver seguimiento
                                        <ArrowRight data-icon="inline-end" />
                                    </Link>
                                </Button>
                            }
                        />
                        <div className="mt-3">
                            <DataTableSurface label="Partidas con material pendiente más antiguo">
                                <Table className="min-w-[560px]">
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
                                                    <VoucherModalLink
                                                        mode="detail"
                                                        voucherId={
                                                            row.voucher_id
                                                        }
                                                        className="font-semibold text-primary underline-offset-4 hover:underline"
                                                    >
                                                        Vale {row.folio}
                                                    </VoucherModalLink>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {row.voucher_type.name}{' '}
                                                        ·{' '}
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
                                                description="Todo el material entregado está aplicado."
                                            />
                                        )}
                                    </TableBody>
                                </Table>
                            </DataTableSurface>
                        </div>
                    </section>

                    <section aria-labelledby="recent-title">
                        <SectionHeader
                            id="recent-title"
                            title="Actividad reciente"
                            description="Últimos vales capturados o actualizados."
                        />
                        <div className="glass-panel-strong mt-3 overflow-hidden rounded-2xl border">
                            {recent.map((voucher) => (
                                <VoucherModalLink
                                    key={voucher.id}
                                    mode="detail"
                                    voucherId={voucher.id}
                                    className="group flex min-h-16 items-center justify-between gap-4 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-hover/70 focus-visible:bg-hover focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none focus-visible:ring-inset"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium group-hover:text-primary">
                                            Vale {voucher.folio}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                            {voucher.voucher_type.name} ·{' '}
                                            {voucher.direction === 'entry'
                                                ? 'Entrada'
                                                : voucher.direction === 'exit'
                                                  ? 'Salida'
                                                  : 'Sin movimiento'}{' '}
                                            · {voucher.received_by?.name ?? '—'}{' '}
                                            · {formatDate(voucher.issued_on)}
                                        </p>
                                    </div>
                                    <StatusBadge
                                        state={voucher.balance_state}
                                    />
                                </VoucherModalLink>
                            ))}
                            {recent.length === 0 && (
                                <div className="flex min-h-48 flex-col items-center justify-center px-5 py-8 text-center">
                                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                                        <ClipboardCheck
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <p className="mt-3 font-semibold">
                                        Aún no hay actividad reciente
                                    </p>
                                    <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                                        Captura un vale para comenzar el
                                        seguimiento operativo.
                                    </p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </Page>
        </>
    );
}
