import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ClipboardCheck,
    ClipboardList,
    FileText,
    Pencil,
    Printer,
    Trash2,
    Upload,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { DataTableSurface, TableEmpty } from '@/components/data-table';
import { Page } from '@/components/page';
import { QuickApplicationDialog } from '@/components/quick-application-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import type {
    ApplicationReportLine,
    MaterialApplicationReport,
    Voucher,
} from '@/types';

export default function VoucherShow({
    voucher,
    embedded = false,
    onEdit,
    onRefresh,
    backUrl = '/vouchers',
}: {
    voucher: Voucher;
    embedded?: boolean;
    onEdit?: () => void;
    onRefresh?: () => void;
    backUrl?: string;
}) {
    const canApply =
        voucher.permissions.create_application &&
        voucher.direction === 'exit' &&
        voucher.status === 'active' &&
        voucher.items.some((item) => Number(item.pending_quantity) > 0);
    const visibleApplicationReports = voucher.application_reports.filter(
        (report) =>
            report.applications.some((application) => !application.voided_at),
    );

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
                                <Link href={backUrl}>
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
                        {voucher.permissions.print && (
                            <Button variant="outline" asChild>
                                <a
                                    href={`/vouchers/${voucher.id}/print`}
                                    target="_blank"
                                >
                                    <Printer data-icon="inline-start" />
                                    Imprimir
                                </a>
                            </Button>
                        )}
                        {voucher.permissions.update &&
                            (embedded ? (
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
                            ))}
                        {voucher.status === 'active' &&
                            voucher.permissions.cancel && (
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
                                        Datos por revisar
                                    </p>
                                    <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                                        {voucher.review_reasons.map(
                                            (reason) => (
                                                <li key={reason}>
                                                    {reason ===
                                                    'classification_requires_review'
                                                        ? 'Confirma la acción y el indicador con el documento físico.'
                                                        : reason}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                </div>
                                {voucher.needs_review &&
                                    voucher.permissions.review && (
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
                        {voucher.direction === 'exit' && (
                            <>
                                <Info
                                    label="Programa"
                                    value={voucher.program?.code ?? '—'}
                                />
                                <Info
                                    label="Acción"
                                    value={voucher.action?.code ?? '—'}
                                />
                                {voucher.indicator &&
                                    voucher.indicator.code !==
                                        voucher.action?.code && (
                                        <Info
                                            label="Indicador"
                                            value={voucher.indicator.code}
                                        />
                                    )}
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
                {voucher.items.length > 0 && (
                    <MaterialBalanceCard voucher={voucher} />
                )}
                {voucher.direction === 'exit' && (
                    <section
                        className="flex flex-col gap-4"
                        aria-labelledby="service-orders-title"
                    >
                        <div className="flex flex-col gap-3 border-y border-border-strong bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="flex items-start gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-subtle text-primary">
                                    <ClipboardCheck
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                </span>
                                <div>
                                    <h2
                                        id="service-orders-title"
                                        className="font-semibold"
                                    >
                                        Aplicaciones registradas
                                    </h2>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        Cada registro reúne la fecha, una orden
                                        de servicio obligatoria y el desglose de
                                        materiales utilizados.
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
                        {visibleApplicationReports.length === 0 ? (
                            <Card>
                                <CardContent>
                                    <DataTableSurface label="Aplicaciones registradas">
                                        <Table>
                                            <TableBody>
                                                <TableEmpty
                                                    colSpan={1}
                                                    title="Aún no hay aplicaciones"
                                                    description="Registra una aplicación cuando el técnico documente los materiales utilizados en un trabajo."
                                                />
                                            </TableBody>
                                        </Table>
                                    </DataTableSurface>
                                </CardContent>
                            </Card>
                        ) : (
                            visibleApplicationReports.map((report) => (
                                <ApplicationReportCard
                                    key={report.key}
                                    report={report}
                                    voucher={voucher}
                                    onRefresh={onRefresh}
                                />
                            ))
                        )}
                    </section>
                )}
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
                                    {voucher.status === 'active' &&
                                        voucher.permissions.update && (
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

function MaterialBalanceCard({ voucher }: { voucher: Voucher }) {
    const isEntry = voucher.direction === 'entry';

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {isEntry ? 'Material recibido' : 'Saldo por material'}
                </CardTitle>
                <CardDescription>
                    {isEntry
                        ? 'Cantidades documentadas en este vale de entrada.'
                        : 'Resumen del material entregado, aplicado y pendiente de comprobar.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <DataTableSurface label="Saldo por material">
                    <Table className="min-w-[620px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead>Unidad</TableHead>
                                <TableHead className="text-right">
                                    {isEntry ? 'Recibido' : 'Entregado'}
                                </TableHead>
                                {!isEntry && (
                                    <>
                                        <TableHead className="text-right">
                                            Aplicado
                                        </TableHead>
                                        <TableHead className="text-right">
                                            Pendiente
                                        </TableHead>
                                        <TableHead>Estado</TableHead>
                                    </>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {voucher.items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">
                                        {item.description}
                                    </TableCell>
                                    <TableCell>
                                        {item.unit.name} ({item.unit.symbol})
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        {formatQuantity(item.quantity)}{' '}
                                        {item.unit.symbol}
                                    </TableCell>
                                    {!isEntry && (
                                        <>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatQuantity(
                                                    item.used_quantity,
                                                )}{' '}
                                                {item.unit.symbol}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    'text-right font-semibold tabular-nums',
                                                    item.balance_state ===
                                                        'anomaly'
                                                        ? 'text-danger'
                                                        : item.balance_state ===
                                                            'pending'
                                                          ? 'text-warning'
                                                          : 'text-success',
                                                )}
                                            >
                                                {formatQuantity(
                                                    item.pending_quantity,
                                                )}{' '}
                                                {item.unit.symbol}
                                            </TableCell>
                                            <TableCell>
                                                <BalanceBadge
                                                    state={item.balance_state}
                                                />
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </DataTableSurface>
            </CardContent>
        </Card>
    );
}

function BalanceBadge({
    state,
}: {
    state: 'pending' | 'settled' | 'anomaly' | 'received';
}) {
    if (state === 'anomaly') {
        return <Badge variant="destructive">Inconsistencia</Badge>;
    }

    if (state === 'settled') {
        return <Badge variant="success">Liquidado</Badge>;
    }

    return <Badge variant="warning">Pendiente</Badge>;
}

function ApplicationReportCard({
    report,
    voucher,
    onRefresh,
}: {
    report: MaterialApplicationReport;
    voucher: Voucher;
    onRefresh?: () => void;
}) {
    const activeApplications = report.applications.filter(
        (application) => !application.voided_at,
    );

    return (
        <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-surface-muted text-text-secondary">
                        <ClipboardList className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-lg">
                                {report.service_order
                                    ? `Orden ${report.service_order}`
                                    : 'Aplicación sin orden'}
                            </CardTitle>
                            <Badge variant="success">Vigente</Badge>
                            {!report.editable && (
                                <Badge variant="outline">Histórico</Badge>
                            )}
                        </div>
                        <CardDescription className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                            <span>{formatDate(report.occurred_on)}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                                {activeApplications.length}{' '}
                                {activeApplications.length === 1
                                    ? 'material aplicado'
                                    : 'materiales aplicados'}
                            </span>
                        </CardDescription>
                    </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {report.attachment && (
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href={`/material-application-attachments/${report.attachment.id}`}
                            >
                                <FileText data-icon="inline-start" />
                                Ver evidencia
                            </a>
                        </Button>
                    )}
                    {voucher.status === 'active' &&
                        report.permissions.update &&
                        report.id && (
                            <QuickApplicationDialog
                                voucher={voucher}
                                report={report}
                                onSuccess={onRefresh}
                                trigger={
                                    <Button variant="outline" size="sm">
                                        <Pencil data-icon="inline-start" />
                                        Editar aplicación
                                    </Button>
                                }
                            />
                        )}
                    {report.id && (
                        <ApplicationEvidenceActions report={report} />
                    )}
                </div>
            </CardHeader>
            {report.notes && (
                <div className="border-b bg-muted/20 px-6 py-3 text-sm text-text-secondary">
                    <span className="font-semibold text-foreground">
                        Comentarios:{' '}
                    </span>
                    {report.notes}
                </div>
            )}
            <CardContent>
                <DataTableSurface
                    label={`Materiales de ${report.service_order ? `la orden ${report.service_order}` : 'la aplicación sin orden'}`}
                >
                    <Table className="min-w-[620px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material</TableHead>
                                <TableHead className="text-right">
                                    Cantidad aplicada
                                </TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activeApplications.map((application) => (
                                <ApplicationReportRow
                                    key={application.id}
                                    application={application}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </DataTableSurface>
            </CardContent>
        </Card>
    );
}

function ApplicationEvidenceActions({
    report,
}: {
    report: MaterialApplicationReport;
}) {
    const form = useForm<{ attachment: File | null }>({ attachment: null });

    if (
        !report.id ||
        (!report.permissions.replace_attachment &&
            !report.permissions.remove_attachment)
    ) {
        return null;
    }

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!form.data.attachment) {
            return;
        }

        form.post(`/material-application-reports/${report.id}/attachment`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {report.permissions.replace_attachment && (
                <form onSubmit={submit} className="flex items-center gap-2">
                    <Input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        aria-label={
                            report.attachment
                                ? 'Seleccionar nueva evidencia'
                                : 'Seleccionar evidencia'
                        }
                        className="h-9 max-w-52 text-xs"
                        onChange={(event) =>
                            form.setData(
                                'attachment',
                                event.target.files?.[0] ?? null,
                            )
                        }
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={!form.data.attachment || form.processing}
                    >
                        <Upload data-icon="inline-start" />
                        {report.attachment ? 'Reemplazar' : 'Agregar'}
                    </Button>
                </form>
            )}
            {report.attachment && report.permissions.remove_attachment && (
                <ConfirmActionDialog
                    trigger={
                        <Button size="sm" variant="ghost">
                            <Trash2 data-icon="inline-start" /> Retirar
                        </Button>
                    }
                    title="Retirar evidencia"
                    description="El archivo dejará de estar disponible y la acción quedará registrada en auditoría."
                    confirmLabel="Retirar evidencia"
                    destructive
                    onConfirm={() =>
                        router.delete(
                            `/material-application-reports/${report.id}/attachment`,
                            { preserveScroll: true },
                        )
                    }
                />
            )}
        </div>
    );
}

function ApplicationReportRow({
    application,
}: {
    application: ApplicationReportLine;
}) {
    return (
        <TableRow>
            <TableCell>
                <p className="font-medium">{application.material.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    Unidad: {application.unit.name} ({application.unit.symbol})
                </p>
                {application.legacy_slot && (
                    <Badge variant="outline" className="mt-1.5">
                        Histórico {application.legacy_slot}
                    </Badge>
                )}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
                {formatQuantity(application.quantity)} {application.unit.symbol}
            </TableCell>
            <TableCell>
                <Badge variant="success">Vigente</Badge>
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
