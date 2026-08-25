import { Head, Link } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    PackageOpen,
    Plus,
    Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const stateLabel: Record<string, string> = {
    pending: 'Pendiente',
    settled: 'Liquidado',
    anomaly: 'Anomalía',
    cancelled: 'Cancelado',
    received: 'Entrada recibida',
};

export default function Dashboard({ metrics, recent, oldest_pending }: Props) {
    return (
        <>
            <Head title="Resumen" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-sm font-medium text-sky-700">
                            Alumbrado público
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight">
                            Control de materiales
                        </h1>
                        <p className="mt-1 text-muted-foreground">
                            Vales, aplicaciones y sobrantes en un solo lugar.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/vouchers/create">
                            <Plus className="mr-2 size-4" />
                            Capturar vale
                        </Link>
                    </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                    <Metric
                        title="Vales pendientes"
                        value={metrics.pending_vouchers}
                        icon={ClipboardCheck}
                        tone="blue"
                    />
                    <Metric
                        title="Materiales pendientes"
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
                        title="Anomalías"
                        value={metrics.anomalies}
                        icon={AlertTriangle}
                        tone="red"
                    />
                    <Metric
                        title="Por revisar"
                        value={metrics.needs_review}
                        icon={AlertTriangle}
                        tone="slate"
                    />
                    <Metric
                        title="Técnicos con pendientes"
                        value={metrics.technicians_with_pending}
                        icon={Users}
                        tone="amber"
                    />
                </div>
                <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <CardTitle>Pendientes más antiguos</CardTitle>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/reports/material-tracking?tab=detail&state=pending">
                                    Ver todos{' '}
                                    <ArrowRight className="ml-1 size-4" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-y bg-muted/40 text-left text-muted-foreground">
                                        <tr>
                                            <th className="px-6 py-3">Vale</th>
                                            <th className="px-4 py-3">
                                                Técnico
                                            </th>
                                            <th className="px-4 py-3">
                                                Material
                                            </th>
                                            <th className="px-6 py-3 text-right">
                                                Pendiente
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {oldest_pending.map((row) => (
                                            <tr
                                                key={`${row.voucher_id}-${row.id}`}
                                                className="border-b last:border-0"
                                            >
                                                <td className="px-6 py-3">
                                                    <Link
                                                        className="font-semibold text-sky-700 hover:underline"
                                                        href={`/vouchers/${row.voucher_id}`}
                                                    >
                                                        #{row.folio}
                                                    </Link>
                                                    <div className="text-xs text-muted-foreground">
                                                        {row.location.name} ·{' '}
                                                        {formatDate(
                                                            row.issued_on,
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {row.received_by.name}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {row.description}
                                                </td>
                                                <td className="px-6 py-3 text-right font-semibold text-amber-700">
                                                    {formatQuantity(
                                                        row.pending_quantity,
                                                    )}{' '}
                                                    {row.unit.symbol}
                                                </td>
                                            </tr>
                                        ))}
                                        {oldest_pending.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-6 py-12 text-center text-muted-foreground"
                                                >
                                                    No hay material pendiente.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Actividad reciente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                            {recent.map((voucher) => (
                                <Link
                                    key={voucher.id}
                                    href={`/vouchers/${voucher.id}`}
                                    className="flex items-center justify-between rounded-lg px-3 py-3 transition hover:bg-muted"
                                >
                                    <div>
                                        <p className="font-medium">
                                            Vale #{voucher.folio}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {voucher.location.name} ·{' '}
                                            {voucher.direction === 'entry'
                                                ? 'Entrada'
                                                : 'Salida'}{' '}
                                            · {voucher.received_by.name} ·{' '}
                                            {formatDate(voucher.issued_on)}
                                        </p>
                                    </div>
                                    <Badge
                                        variant={
                                            voucher.balance_state === 'settled'
                                                ? 'secondary'
                                                : voucher.balance_state ===
                                                    'anomaly'
                                                  ? 'destructive'
                                                  : 'outline'
                                        }
                                    >
                                        {stateLabel[voucher.balance_state]}
                                    </Badge>
                                </Link>
                            ))}
                            {recent.length === 0 && (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    Todavía no hay vales capturados.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

function Metric({
    title,
    value,
    icon: Icon,
    tone,
}: {
    title: string;
    value: number;
    icon: typeof ClipboardCheck;
    tone: 'blue' | 'amber' | 'green' | 'red' | 'slate';
}) {
    const colors = {
        blue: 'bg-sky-50 text-sky-700 dark:bg-sky-950',
        amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950',
        green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950',
        red: 'bg-red-50 text-red-700 dark:bg-red-950',
        slate: 'bg-slate-100 text-slate-700 dark:bg-slate-900',
    };

    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-5">
                <div className={`rounded-xl p-3 ${colors[tone]}`}>
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
