import { Head } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    Download,
    FileText,
    Image,
    MapPin,
    PackageCheck,
    ShieldCheck,
} from 'lucide-react';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatBytes, formatDate, formatQuantity } from '@/lib/format';
import type { SharedVoucher } from '@/types';

export default function SharedVoucherShow({
    voucher,
    expiresAt,
}: {
    voucher: SharedVoucher;
    expiresAt: string;
}) {
    const expiresLabel = new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(expiresAt));
    const isEntry = voucher.direction === 'entry';

    return (
        <>
            <Head title={`Consulta del vale ${voucher.folio}`}>
                <meta name="robots" content="noindex, nofollow, noarchive" />
                <meta name="referrer" content="no-referrer" />
            </Head>

            <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(30,96,168,0.12),transparent_34rem),linear-gradient(180deg,hsl(var(--muted)/0.35),transparent_24rem)] px-4 py-6 text-foreground sm:px-6 sm:py-10">
                <div className="mx-auto grid w-full max-w-6xl gap-5">
                    <header className="overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-[0_18px_50px_rgb(15_42_78/0.10)]">
                        <div className="flex flex-col gap-5 border-b border-primary/15 bg-primary px-5 py-5 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
                            <div className="flex items-center gap-3">
                                <span className="flex size-11 items-center justify-center rounded-xl border border-white/25 bg-white/10">
                                    <ShieldCheck
                                        className="size-6"
                                        aria-hidden="true"
                                    />
                                </span>
                                <div>
                                    <p className="text-xs font-semibold tracking-[0.16em] text-primary-foreground/75 uppercase">
                                        Control de materiales SPM
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium">
                                <CalendarDays
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                Disponible hasta {expiresLabel}
                            </div>
                        </div>
                        <div className="px-5 py-5 sm:px-7 sm:py-6">
                            <div>
                                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                                    {voucher.voucher_type.name}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                    <h1 className="text-3xl font-bold tracking-[-0.035em]">
                                        Vale {voucher.folio}
                                    </h1>
                                    <StatusBadge
                                        state={voucher.balance_state}
                                    />
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {voucherKindLabel(voucher)} del{' '}
                                    {formatDate(voucher.issued_on)}
                                </p>
                            </div>
                        </div>
                    </header>

                    {voucher.status === 'cancelled' && (
                        <Alert variant="destructive">
                            <AlertDescription>
                                <p className="font-semibold text-foreground">
                                    Vale cancelado
                                </p>
                                <p className="mt-1">
                                    No genera seguimiento operativo ni
                                    responsabilidad pendiente.
                                </p>
                                {voucher.cancellation_reason && (
                                    <p className="mt-2">
                                        <span className="font-medium text-foreground">
                                            Motivo:{' '}
                                        </span>
                                        {voucher.cancellation_reason}
                                    </p>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {voucher.status === 'loaned' && (
                        <Alert variant="info">
                            <AlertDescription>
                                <p className="font-semibold text-foreground">
                                    {voucher.loaned_to_name
                                        ? `Vale prestado a ${voucher.loaned_to_name}`
                                        : 'Vale registrado como prestado'}
                                </p>
                                <p className="mt-1">
                                    Las cantidades se conservan como referencia
                                    administrativa y no generan saldo pendiente.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Datos del vale</CardTitle>
                            <CardDescription>
                                Información capturada en el documento.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Info
                                label="Fecha"
                                value={formatDate(voucher.issued_on)}
                            />
                            <Info
                                label="Movimiento"
                                value={voucherKindLabel(voucher)}
                            />
                            <Info
                                label="Recibió"
                                value={voucher.received_by ?? '—'}
                            />
                            <Info
                                label="Entregó"
                                value={voucher.delivered_by ?? '—'}
                            />
                            <Info
                                label="Autorizó"
                                value={voucher.authorized_by ?? '—'}
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
                                    <Info
                                        label="Indicador"
                                        value={voucher.indicator?.code ?? '—'}
                                    />
                                </>
                            )}
                            <div className="sm:col-span-2 lg:col-span-4">
                                <Info
                                    label="Ubicación"
                                    value={
                                        voucher.destinations.join(', ') || '—'
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
                        <Card>
                            <CardHeader>
                                <div className="flex items-start gap-3">
                                    <span className="flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary-subtle text-primary">
                                        <PackageCheck
                                            className="size-5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div>
                                        <CardTitle>
                                            {voucher.status === 'loaned'
                                                ? 'Material prestado'
                                                : voucher.status === 'cancelled'
                                                  ? 'Material registrado'
                                                  : isEntry
                                                    ? 'Material recibido'
                                                    : 'Saldo por material'}
                                        </CardTitle>
                                        <CardDescription>
                                            {isEntry ||
                                            voucher.status !== 'active'
                                                ? 'Las cantidades se conservan como referencia documental.'
                                                : 'Pendiente = entregado − aplicado.'}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 md:hidden">
                                    {voucher.items.map((item) => (
                                        <div
                                            key={`${item.description}-${item.quantity}`}
                                            className="rounded-xl border bg-surface-raised p-4"
                                        >
                                            <div className="grid gap-1">
                                                <p className="font-semibold break-words">
                                                    {item.description}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {item.unit.name} (
                                                    {item.unit.symbol})
                                                </p>
                                                {item.luminaire_folios && (
                                                    <p className="text-xs leading-5 break-words text-muted-foreground">
                                                        Folios:{' '}
                                                        {item.luminaire_folios}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                                <Metric
                                                    label={
                                                        isEntry
                                                            ? 'Recibido'
                                                            : 'Entregado'
                                                    }
                                                    value={`${formatQuantity(item.quantity)} ${item.unit.symbol}`}
                                                />
                                                {!isEntry &&
                                                    voucher.status ===
                                                        'active' && (
                                                        <Metric
                                                            label="Aplicado"
                                                            value={`${formatQuantity(item.used_quantity)} ${item.unit.symbol}`}
                                                        />
                                                    )}
                                                {!isEntry &&
                                                    voucher.status ===
                                                        'active' && (
                                                        <Metric
                                                            label="Pendiente"
                                                            value={`${formatQuantity(item.pending_quantity)} ${item.unit.symbol}`}
                                                            emphasis
                                                        />
                                                    )}
                                                {!isEntry &&
                                                    voucher.status ===
                                                        'active' && (
                                                        <div className="grid gap-1">
                                                            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                                                                Estado
                                                            </p>
                                                            <ItemBalance
                                                                state={
                                                                    item.balance_state
                                                                }
                                                            />
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="hidden overflow-x-auto md:block">
                                    <Table className="min-w-[660px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Material</TableHead>
                                                <TableHead>Unidad</TableHead>
                                                <TableHead className="text-right">
                                                    {isEntry
                                                        ? 'Recibido'
                                                        : 'Entregado'}
                                                </TableHead>
                                                {!isEntry &&
                                                    voucher.status ===
                                                        'active' && (
                                                        <>
                                                            <TableHead className="text-right">
                                                                Aplicado
                                                            </TableHead>
                                                            <TableHead className="text-right">
                                                                Pendiente
                                                            </TableHead>
                                                            <TableHead>
                                                                Estado
                                                            </TableHead>
                                                        </>
                                                    )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {voucher.items.map((item) => (
                                                <TableRow
                                                    key={`${item.description}-${item.quantity}`}
                                                >
                                                    <TableCell className="font-medium">
                                                        <div className="grid gap-1">
                                                            <span>
                                                                {
                                                                    item.description
                                                                }
                                                            </span>
                                                            {item.luminaire_folios && (
                                                                <span className="text-xs font-normal text-muted-foreground">
                                                                    Folios:{' '}
                                                                    {
                                                                        item.luminaire_folios
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.unit.name} (
                                                        {item.unit.symbol})
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium tabular-nums">
                                                        {formatQuantity(
                                                            item.quantity,
                                                        )}{' '}
                                                        {item.unit.symbol}
                                                    </TableCell>
                                                    {!isEntry &&
                                                        voucher.status ===
                                                            'active' && (
                                                            <>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {formatQuantity(
                                                                        item.used_quantity,
                                                                    )}{' '}
                                                                    {
                                                                        item
                                                                            .unit
                                                                            .symbol
                                                                    }
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold tabular-nums">
                                                                    {formatQuantity(
                                                                        item.pending_quantity,
                                                                    )}{' '}
                                                                    {
                                                                        item
                                                                            .unit
                                                                            .symbol
                                                                    }
                                                                </TableCell>
                                                                <TableCell>
                                                                    <ItemBalance
                                                                        state={
                                                                            item.balance_state
                                                                        }
                                                                    />
                                                                </TableCell>
                                                            </>
                                                        )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {voucher.application_reports.length > 0 && (
                        <section className="grid gap-4">
                            <div className="flex items-center gap-3 px-1">
                                <CheckCircle2
                                    className="size-5 text-primary"
                                    aria-hidden="true"
                                />
                                <div>
                                    <h2 className="text-lg font-semibold">
                                        Aplicaciones registradas
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Aplicaciones vigentes relacionadas con
                                        el vale.
                                    </p>
                                </div>
                            </div>
                            {voucher.application_reports.map((report) => (
                                <Card key={report.key}>
                                    <CardHeader className="gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <CardTitle className="text-lg">
                                                {report.service_order
                                                    ? `Orden ${report.service_order}`
                                                    : 'Aplicación sin orden'}
                                            </CardTitle>
                                            {report.service_order_type && (
                                                <Badge variant="outline">
                                                    {report.service_order_type}
                                                </Badge>
                                            )}
                                        </div>
                                        <CardDescription>
                                            {formatDate(report.occurred_on)}
                                        </CardDescription>
                                    </CardHeader>
                                    {(report.location || report.notes) && (
                                        <div className="border-y bg-muted/20 px-6 py-3 text-sm text-muted-foreground">
                                            {report.location && (
                                                <p className="flex gap-2">
                                                    <MapPin
                                                        className="mt-0.5 size-4 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                    {report.location}
                                                </p>
                                            )}
                                            {report.notes && (
                                                <p className="mt-1">
                                                    {report.notes}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <CardContent className="pt-6">
                                        <div className="grid gap-3 md:hidden">
                                            {report.applications.map(
                                                (application) => (
                                                    <div
                                                        key={`${application.material}-${application.quantity}`}
                                                        className="flex items-end justify-between gap-4 rounded-lg border bg-surface-raised p-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="font-medium break-words">
                                                                {
                                                                    application.material
                                                                }
                                                            </p>
                                                            <p className="mt-1 text-sm text-muted-foreground">
                                                                {
                                                                    application
                                                                        .unit
                                                                        .name
                                                                }{' '}
                                                                (
                                                                {
                                                                    application
                                                                        .unit
                                                                        .symbol
                                                                }
                                                                )
                                                            </p>
                                                        </div>
                                                        <p className="shrink-0 text-right font-semibold tabular-nums">
                                                            {formatQuantity(
                                                                application.quantity,
                                                            )}{' '}
                                                            {
                                                                application.unit
                                                                    .symbol
                                                            }
                                                        </p>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                        <div className="hidden overflow-x-auto md:block">
                                            <Table className="min-w-[480px]">
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>
                                                            Material
                                                        </TableHead>
                                                        <TableHead>
                                                            Unidad
                                                        </TableHead>
                                                        <TableHead className="text-right">
                                                            Cantidad aplicada
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {report.applications.map(
                                                        (application) => (
                                                            <TableRow
                                                                key={`${application.material}-${application.quantity}`}
                                                            >
                                                                <TableCell className="font-medium">
                                                                    {
                                                                        application.material
                                                                    }
                                                                </TableCell>
                                                                <TableCell>
                                                                    {
                                                                        application
                                                                            .unit
                                                                            .name
                                                                    }{' '}
                                                                    (
                                                                    {
                                                                        application
                                                                            .unit
                                                                            .symbol
                                                                    }
                                                                    )
                                                                </TableCell>
                                                                <TableCell className="text-right tabular-nums">
                                                                    {formatQuantity(
                                                                        application.quantity,
                                                                    )}{' '}
                                                                    {
                                                                        application
                                                                            .unit
                                                                            .symbol
                                                                    }
                                                                </TableCell>
                                                            </TableRow>
                                                        ),
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </section>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Comprobantes del vale</CardTitle>
                            <CardDescription>
                                Visualiza o descarga los archivos adjuntos a
                                este vale.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {voucher.attachments.length === 0 ? (
                                <div className="rounded-xl border border-dashed bg-muted/25 px-4 py-8 text-center text-sm text-muted-foreground">
                                    Este vale no tiene comprobantes adjuntos.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {voucher.attachments.map((attachment) => {
                                        const image =
                                            attachment.mime_type.startsWith(
                                                'image/',
                                            );

                                        return (
                                            <article
                                                key={attachment.preview_url}
                                                className="overflow-hidden rounded-xl border bg-surface-raised"
                                            >
                                                {image ? (
                                                    <a
                                                        href={
                                                            attachment.preview_url
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block bg-muted/35 p-3"
                                                    >
                                                        <img
                                                            src={
                                                                attachment.preview_url
                                                            }
                                                            alt={`Vista previa de ${attachment.original_name}`}
                                                            className="h-44 w-full rounded-lg object-contain"
                                                        />
                                                    </a>
                                                ) : (
                                                    <div className="flex h-44 items-center justify-center bg-muted/35 text-primary">
                                                        <FileText
                                                            className="size-12"
                                                            aria-hidden="true"
                                                        />
                                                    </div>
                                                )}
                                                <div className="grid gap-3 p-4">
                                                    <div className="flex min-w-0 items-start gap-2">
                                                        {image ? (
                                                            <Image
                                                                className="mt-0.5 size-4 shrink-0 text-primary"
                                                                aria-hidden="true"
                                                            />
                                                        ) : (
                                                            <FileText
                                                                className="mt-0.5 size-4 shrink-0 text-primary"
                                                                aria-hidden="true"
                                                            />
                                                        )}
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">
                                                                {
                                                                    attachment.original_name
                                                                }
                                                            </p>
                                                            <p className="mt-0.5 text-xs text-muted-foreground">
                                                                {formatBytes(
                                                                    attachment.size,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <a
                                                                href={
                                                                    attachment.preview_url
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                Visualizar
                                                            </a>
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            asChild
                                                        >
                                                            <a
                                                                href={
                                                                    attachment.download_url
                                                                }
                                                            >
                                                                <Download aria-hidden="true" />{' '}
                                                                Descargar
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid gap-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
            </p>
            <p className="text-sm leading-6 font-medium whitespace-pre-wrap">
                {value}
            </p>
        </div>
    );
}

function Metric({
    label,
    value,
    emphasis = false,
}: {
    label: string;
    value: string;
    emphasis?: boolean;
}) {
    return (
        <div className="grid gap-1">
            <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                {label}
            </p>
            <p
                className={
                    emphasis
                        ? 'font-semibold tabular-nums'
                        : 'font-medium tabular-nums'
                }
            >
                {value}
            </p>
        </div>
    );
}

function ItemBalance({
    state,
}: {
    state: SharedVoucher['items'][number]['balance_state'];
}) {
    if (state === 'anomaly') {
        return <Badge variant="destructive">Inconsistencia</Badge>;
    }

    if (state === 'settled') {
        return <Badge variant="success">Liquidado</Badge>;
    }

    return <Badge variant="warning">Pendiente</Badge>;
}

function voucherKindLabel(
    voucher: Pick<SharedVoucher, 'direction' | 'status'>,
): string {
    if (voucher.status === 'loaned') {
        return 'Vale prestado';
    }

    if (voucher.status === 'cancelled') {
        return voucher.direction === 'entry'
            ? 'Entrada cancelada'
            : 'Vale cancelado';
    }

    return voucher.direction === 'entry' ? 'Entrada' : 'Salida';
}
