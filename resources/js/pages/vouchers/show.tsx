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
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { Page } from '@/components/page';
import { QuickApplicationDialog } from '@/components/quick-application-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { VoucherModalLink } from '@/components/voucher-dialogs';
import { formatBytes, formatDate, formatQuantity } from '@/lib/format';
import type { MaterialApplication, Voucher, VoucherItem } from '@/types';

export default function VoucherShow({
    voucher,
    embedded = false,
    onEdit,
    onRefresh,
}: {
    voucher: Voucher;
    embedded?: boolean;
    onEdit?: () => void;
    onRefresh?: () => void;
}) {
    const canApply =
        voucher.direction === 'exit' &&
        voucher.status === 'active' &&
        voucher.items.some((item) => Number(item.pending_quantity) > 0);

    return (
        <>
            {!embedded && <Head title={`Vale ${voucher.folio}`} />}
            <Page width="wide">
                <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        {!embedded && (
                            <IconButton
                                label="Volver a vales"
                                variant="ghost"
                                asChild
                            >
                                <Link href="/vouchers">
                                    <ArrowLeft />
                                </Link>
                            </IconButton>
                        )}
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
                                {voucher.voucher_type.name} ·{' '}
                                {voucher.direction === 'entry'
                                    ? 'Entrada'
                                    : voucher.direction === 'exit'
                                      ? 'Salida'
                                      : 'Sin movimiento'}{' '}
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
                        {embedded ? (
                            <Button variant="outline" onClick={onEdit}>
                                <Pencil data-icon="inline-start" />
                                Editar
                            </Button>
                        ) : (
                            <Button variant="outline" asChild>
                                <VoucherModalLink
                                    mode="edit"
                                    voucherId={voucher.id}
                                >
                                    <Pencil data-icon="inline-start" />
                                    Editar
                                </VoucherModalLink>
                            </Button>
                        )}
                        {voucher.status === 'active' && (
                            <ConfirmActionDialog
                                trigger={
                                    <Button variant="destructive">
                                        Cancelar
                                    </Button>
                                }
                                title="Cancelar vale"
                                description="La cancelación conserva el folio y deja una traza auditable. No se puede deshacer desde esta pantalla."
                                confirmLabel="Cancelar vale"
                                destructive
                                reasonLabel="Motivo de cancelación"
                                reasonPlaceholder="Explica por qué se cancela este vale"
                                onConfirm={(reason) =>
                                    router.post(
                                        `/vouchers/${voucher.id}/cancel`,
                                        { reason, _dialog: embedded },
                                        {
                                            preserveScroll: true,
                                            onSuccess: onRefresh,
                                        },
                                    )
                                }
                            />
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
                {voucher.status === 'loaned' && (
                    <Alert variant="info">
                        <AlertDescription>
                            <p className="font-medium text-foreground">
                                {voucher.loaned_to_name
                                    ? `Vale prestado a ${voucher.loaned_to_name}`
                                    : 'Vale registrado como prestado'}
                            </p>
                            <p>
                                Registrado el{' '}
                                {voucher.loaned_on
                                    ? formatDate(voucher.loaned_on)
                                    : '—'}
                                . Este folio sólo conserva la continuidad de la
                                numeración y no genera seguimiento de material.
                            </p>
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
                                    <ConfirmActionDialog
                                        trigger={
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Marcar revisión atendida
                                            </Button>
                                        }
                                        title="Marcar revisión atendida"
                                        description="Confirma que las incidencias de importación fueron revisadas. El detalle seguirá disponible en el historial del vale."
                                        confirmLabel="Marcar como atendida"
                                        onConfirm={() =>
                                            router.post(
                                                `/vouchers/${voucher.id}/review`,
                                                { _dialog: embedded },
                                                {
                                                    preserveScroll: true,
                                                    onSuccess: onRefresh,
                                                },
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </AlertDescription>
                    </Alert>
                )}
                <Card>
                    <CardContent className="grid gap-5 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                        <Info
                            label="Recibió"
                            value={voucher.received_by?.name ?? '—'}
                        />
                        <Info
                            label="Entregó"
                            value={voucher.delivered_by?.name ?? '—'}
                        />
                        <Info
                            label="Autorizó"
                            value={voucher.authorized_by?.name ?? '—'}
                        />
                        {voucher.voucher_type.code === 'warehouse' && (
                            <>
                                <Info
                                    label="Programa"
                                    value={voucher.program?.code ?? '—'}
                                />
                                <Info
                                    label="Acción"
                                    value={voucher.action?.code ?? '—'}
                                />
                            </>
                        )}
                        <div className="sm:col-span-2 lg:col-span-4">
                            <Info
                                label="Ubicación"
                                value={
                                    voucher.destinations
                                        .map((destination) => destination.name)
                                        .join(', ') || '—'
                                }
                            />
                        </div>
                        {voucher.usage_description && (
                            <div className="sm:col-span-2 lg:col-span-4">
                                <Info
                                    label="Uso o actividad"
                                    value={voucher.usage_description}
                                />
                            </div>
                        )}
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
                                        onSuccess={onRefresh}
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
                                        <ConfirmActionDialog
                                            trigger={
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                >
                                                    Eliminar
                                                </Button>
                                            }
                                            title="Eliminar comprobante"
                                            description={`Eliminarás “${file.original_name}” de este vale. Esta acción no se puede deshacer.`}
                                            confirmLabel="Eliminar archivo"
                                            destructive
                                            onConfirm={() =>
                                                router.delete(
                                                    `/attachments/${file.id}`,
                                                    {
                                                        preserveScroll: true,
                                                    },
                                                )
                                            }
                                        />
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </Page>
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
    direction?: 'entry' | 'exit' | null;
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
                        <DataTableSurface
                            label={`Historial de aplicaciones de ${item.description}`}
                        >
                            <Table className="min-w-[580px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>
                                            Referencia / destino
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Cantidad
                                        </TableHead>
                                        <TableHead>
                                            <span className="sr-only">
                                                Acciones
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {item.applications.map((row) => (
                                        <ApplicationRow
                                            key={row.id}
                                            row={row}
                                            unit={item.unit.symbol}
                                            active={active}
                                        />
                                    ))}
                                    {item.applications.length === 0 && (
                                        <TableEmpty
                                            colSpan={4}
                                            title="Aún no hay aplicaciones"
                                            description="Registra el material utilizado cuando el técnico documente el trabajo realizado."
                                        />
                                    )}
                                </TableBody>
                            </Table>
                        </DataTableSurface>
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
    return (
        <TableRow
            className={`border-b last:border-0 ${row.voided_at ? 'line-through opacity-45' : ''}`}
        >
            <TableCell>{formatDate(row.occurred_on)}</TableCell>
            <TableCell>
                <p>{row.reference || 'Sin orden registrada'}</p>
                {row.destination_snapshot && (
                    <p className="text-xs text-muted-foreground">
                        {row.destination_snapshot}
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
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
                {formatQuantity(row.quantity)} {unit}
            </TableCell>
            <TableCell className="text-right">
                {active && !row.voided_at && (
                    <ConfirmActionDialog
                        trigger={
                            <Button size="sm" variant="ghost">
                                Anular
                            </Button>
                        }
                        title="Anular aplicación"
                        description="La aplicación dejará de afectar el pendiente, pero seguirá conservada en el historial con su motivo."
                        confirmLabel="Anular aplicación"
                        destructive
                        reasonLabel="Motivo de anulación"
                        reasonPlaceholder="Explica qué se corrigió en esta aplicación"
                        onConfirm={(reason) =>
                            router.post(
                                `/material-applications/${row.id}/void`,
                                { reason },
                                { preserveScroll: true },
                            )
                        }
                    />
                )}
            </TableCell>
        </TableRow>
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
