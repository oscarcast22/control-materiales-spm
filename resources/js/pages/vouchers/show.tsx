import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CircleCheck,
    ClipboardCheck,
    FileText,
    Pencil,
    Printer,
    Wrench,
} from 'lucide-react';
import { QuickApplicationDialog } from '@/components/quick-application-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { formatBytes, formatDate, formatQuantity } from '@/lib/format';
import type { MaterialApplication, Voucher, VoucherItem } from '@/types';

export default function VoucherShow({ voucher }: { voucher: Voucher }) {
    const canApply =
        voucher.direction === 'exit' &&
        voucher.status === 'active' &&
        voucher.items.some((item) => Number(item.pending_quantity) > 0);
    const cancel = () => {
        const reason = window.prompt(
            'Motivo de cancelación (mínimo 5 caracteres):',
        );

        if (reason) {
            router.post(
                `/vouchers/${voucher.id}/cancel`,
                { reason },
                { preserveScroll: true },
            );
        }
    };

    const markReviewed = () => {
        if (
            window.confirm(
                '¿Confirmas que las incidencias de importación de este vale ya fueron revisadas?',
            )
        ) {
            router.post(
                `/vouchers/${voucher.id}/review`,
                {},
                { preserveScroll: true },
            );
        }
    };

    return (
        <>
            <Head title={`Vale ${voucher.folio}`} />
            <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-6 min-[1200px]:px-8 md:px-6">
                <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <IconButton
                            label="Volver a vales"
                            variant="ghost"
                            asChild
                        >
                            <Link href="/vouchers">
                                <ArrowLeft />
                            </Link>
                        </IconButton>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-[1.625rem] leading-8 font-bold tracking-[-0.02em] md:text-[2rem] md:leading-10">
                                    Vale {voucher.folio}
                                </h1>
                                <StatusBadge state={voucher.balance_state} />
                                {voucher.needs_review && (
                                    <Badge variant="warning">
                                        Requiere revisión
                                    </Badge>
                                )}
                            </div>
                            <p className="mt-1 text-muted-foreground">
                                {voucher.location.name} ·{' '}
                                {voucher.direction === 'entry'
                                    ? 'Entrada'
                                    : 'Salida'}{' '}
                                del {formatDate(voucher.issued_on)}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" asChild>
                            <a
                                href={`/vouchers/${voucher.id}/print`}
                                target="_blank"
                            >
                                <Printer data-icon="inline-start" />
                                Imprimir
                            </a>
                        </Button>
                        {voucher.status === 'active' && (
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={`/vouchers/${voucher.id}/edit`}>
                                        <Pencil data-icon="inline-start" />
                                        Editar
                                    </Link>
                                </Button>
                                <Button variant="destructive" onClick={cancel}>
                                    Cancelar
                                </Button>
                            </>
                        )}
                    </div>
                </div>
                {voucher.status === 'cancelled' && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            Vale cancelado: {voucher.cancellation_reason}
                        </AlertDescription>
                    </Alert>
                )}
                {voucher.review_reasons.length > 0 && (
                    <Alert variant="warning">
                        <AlertDescription>
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <p className="font-medium">
                                        Incidencias detectadas al importar
                                    </p>
                                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                                        {voucher.review_reasons.map(
                                            (reason) => (
                                                <li key={reason}>{reason}</li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                                {voucher.needs_review && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={markReviewed}
                                    >
                                        Marcar revisión atendida
                                    </Button>
                                )}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
                <Card>
                    <CardContent className="grid gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                        <Info
                            label="Recibió"
                            value={voucher.received_by.name}
                        />
                        <Info
                            label="Entregó"
                            value={voucher.delivered_by.name}
                        />
                        <Info
                            label="Autorizó"
                            value={voucher.authorized_by?.name ?? '—'}
                        />
                        <div className="sm:col-span-2 lg:col-span-4">
                            <Info label="Destino" value={voucher.destination} />
                        </div>
                        {voucher.notes && (
                            <div className="sm:col-span-2 lg:col-span-4">
                                <Info
                                    label="Observaciones"
                                    value={voucher.notes}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
                <div className="flex flex-col gap-5">
                    {voucher.direction === 'exit' && (
                        <div className="flex flex-col gap-3 border-y border-border-strong bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex items-start gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-subtle text-primary">
                                    <ClipboardCheck
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                </span>
                                <div>
                                    <h2 className="font-semibold">
                                        Aplicación de materiales
                                    </h2>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        Registra el material utilizado en uno o
                                        varios trabajos.
                                    </p>
                                </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <p className="rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
                                    Pendiente = entregado − aplicado
                                </p>
                                {canApply && (
                                    <QuickApplicationDialog
                                        voucher={voucher}
                                        trigger={
                                            <Button>
                                                <Wrench data-icon="inline-start" />
                                                Registrar aplicación
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    {voucher.items.map((item) => (
                        <MaterialCard
                            key={item.id}
                            item={item}
                            active={voucher.status === 'active'}
                            direction={voucher.direction}
                        />
                    ))}
                </div>
                {voucher.attachments.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Comprobantes adjuntos</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {voucher.attachments.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between rounded-lg border p-3"
                                >
                                    <a
                                        className="flex min-w-0 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                                        href={`/attachments/${file.id}`}
                                    >
                                        <FileText className="size-5 shrink-0" />
                                        <span className="truncate">
                                            {file.original_name}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {formatBytes(file.size)}
                                        </span>
                                    </a>
                                    {voucher.status === 'active' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                window.confirm(
                                                    '¿Eliminar este archivo?',
                                                ) &&
                                                router.delete(
                                                    `/attachments/${file.id}`,
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            Eliminar
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

function MaterialCard({
    item,
    active,
    direction,
}: {
    item: VoucherItem;
    active: boolean;
    direction: 'entry' | 'exit';
}) {
    return (
        <Card
            className={
                item.balance_state === 'anomaly' ? 'border-danger/55' : ''
            }
        >
            <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <CardTitle>{item.description}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Unidad: {item.unit.name} ({item.unit.symbol})
                    </p>
                </div>
                <div
                    className={`grid gap-4 text-center ${direction === 'entry' ? 'grid-cols-1' : 'grid-cols-3'}`}
                >
                    <Quantity
                        label={direction === 'entry' ? 'Recibido' : 'Entregado'}
                        value={item.quantity}
                        unit={item.unit.symbol}
                    />
                    {direction === 'exit' && (
                        <>
                            <Quantity
                                label="Aplicado"
                                value={item.used_quantity}
                                unit={item.unit.symbol}
                            />
                            <Quantity
                                label="Pendiente"
                                value={item.pending_quantity}
                                unit={item.unit.symbol}
                                strong
                            />
                        </>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                {item.balance_state === 'anomaly' && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            La aplicación histórica supera la cantidad
                            entregada. Revisa este renglón.
                        </AlertDescription>
                    </Alert>
                )}
                {direction === 'exit' &&
                    active &&
                    item.balance_state === 'settled' && (
                        <Alert variant="success">
                            <CircleCheck aria-hidden="true" />
                            <AlertDescription>
                                <p className="font-medium text-foreground">
                                    Material completamente comprobado
                                </p>
                                <p>
                                    Todo lo entregado fue aplicado; no queda
                                    saldo por registrar.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}
                {direction === 'exit' && (
                    <div className="flex flex-col gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">
                                Historial de aplicaciones
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Aplicaciones vigentes y anuladas de este
                                material.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y bg-surface-subtle text-left text-[11px] font-bold tracking-[0.08em] text-text-secondary uppercase">
                                    <tr>
                                        <th className="px-3 py-2">Fecha</th>
                                        <th className="px-3 py-2">
                                            Referencia / destino
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            Cantidad
                                        </th>
                                        <th className="px-3 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {item.applications.map((row) => (
                                        <ApplicationRow
                                            key={row.id}
                                            row={row}
                                            unit={item.unit.symbol}
                                            active={active}
                                        />
                                    ))}
                                    {item.applications.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Aún no hay aplicaciones.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ApplicationRow({
    row,
    unit,
    active,
}: {
    row: MaterialApplication;
    unit: string;
    active: boolean;
}) {
    const voidRow = () => {
        const reason = window.prompt(
            'Motivo de anulación (mínimo 5 caracteres):',
        );

        if (reason) {
            router.post(
                `/material-applications/${row.id}/void`,
                { reason },
                { preserveScroll: true },
            );
        }
    };

    return (
        <tr
            className={`border-b last:border-0 ${row.voided_at ? 'line-through opacity-45' : ''}`}
        >
            <td className="px-3 py-3">{formatDate(row.occurred_on)}</td>
            <td className="px-3 py-3">
                <p>{row.reference || 'Sin orden registrada'}</p>
                {row.destination && (
                    <p className="text-xs text-muted-foreground">
                        {row.destination}
                    </p>
                )}
                {row.legacy_slot && (
                    <Badge variant="outline" className="mt-1.5">
                        Histórico {row.legacy_slot}
                    </Badge>
                )}
                {row.attachment && (
                    <a
                        href={`/material-application-attachments/${row.attachment.id}`}
                        className="mt-1.5 flex w-fit items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                        <FileText className="size-3.5" aria-hidden="true" />
                        Ver evidencia
                    </a>
                )}
            </td>
            <td className="px-3 py-3 text-right font-medium">
                {formatQuantity(row.quantity)} {unit}
            </td>
            <td className="px-3 py-3 text-right">
                {active && !row.voided_at && (
                    <Button size="sm" variant="ghost" onClick={voidRow}>
                        Anular
                    </Button>
                )}
            </td>
        </tr>
    );
}
function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </p>
            <p className="mt-1 font-medium">{value}</p>
        </div>
    );
}
function Quantity({
    label,
    value,
    unit,
    strong = false,
}: {
    label: string;
    value: string;
    unit: string;
    strong?: boolean;
}) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
                className={
                    strong ? 'font-semibold text-warning' : 'font-semibold'
                }
            >
                {formatQuantity(value)}{' '}
                <span className="text-xs font-normal">{unit}</span>
            </p>
        </div>
    );
}
