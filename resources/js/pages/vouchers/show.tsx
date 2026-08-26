import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    CircleCheck,
    ClipboardCheck,
    FileText,
    Pencil,
    Printer,
    RotateCcw,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { formatBytes, formatDate, formatQuantity } from '@/lib/format';
import type { Disposition, Voucher, VoucherItem } from '@/types';

export default function VoucherShow({ voucher }: { voucher: Voucher }) {
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
            <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 py-5 sm:px-6 md:py-7 lg:px-8">
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
                                <h1 className="text-3xl font-semibold tracking-[-0.025em]">
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
                        <Info
                            label="Referencia"
                            value={voucher.reference ?? '—'}
                        />
                        <Info
                            label="Programa"
                            value={voucher.program?.code ?? '—'}
                        />
                        <Info
                            label="Acción"
                            value={voucher.action?.code ?? '—'}
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
                                        Comprobación de materiales
                                    </h2>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        Registra para cada material lo utilizado
                                        en un trabajo o lo que fue devuelto.
                                    </p>
                                </div>
                            </div>
                            <p className="shrink-0 rounded-md border bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
                                Pendiente = entregado − aplicado − devuelto
                            </p>
                        </div>
                    )}
                    {voucher.items.map((item) => (
                        <MaterialCard
                            key={item.id}
                            item={item}
                            active={voucher.status === 'active'}
                            direction={voucher.direction}
                            defaultDestination={voucher.destination}
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
    defaultDestination,
}: {
    item: VoucherItem;
    active: boolean;
    direction: 'entry' | 'exit';
    defaultDestination: string;
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
                    className={`grid gap-4 text-center ${direction === 'entry' ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'}`}
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
                                label="Devuelto"
                                value={item.returned_quantity}
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
                            La comprobación histórica supera la cantidad
                            entregada. Revisa este renglón.
                        </AlertDescription>
                    </Alert>
                )}
                {direction === 'exit' &&
                    active &&
                    Number(item.pending_quantity) > 0 && (
                        <DispositionForm
                            item={item}
                            defaultDestination={defaultDestination}
                        />
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
                                    Todo lo entregado fue aplicado o devuelto;
                                    no queda saldo por registrar.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}
                {direction === 'exit' && (
                    <div className="flex flex-col gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">
                                Historial de movimientos
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Aplicaciones, devoluciones y movimientos
                                anulados de este material.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="border-y bg-muted/40 text-left text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Fecha</th>
                                        <th className="px-3 py-2">Tipo</th>
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
                                    {item.dispositions.map((row) => (
                                        <DispositionRow
                                            key={row.id}
                                            row={row}
                                            unit={item.unit.symbol}
                                            active={active}
                                        />
                                    ))}
                                    {item.dispositions.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="px-3 py-8 text-center text-muted-foreground"
                                            >
                                                Aún no hay aplicaciones ni
                                                devoluciones.
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

function DispositionForm({
    item,
    defaultDestination,
}: {
    item: VoucherItem;
    defaultDestination: string;
}) {
    const form = useForm({
        type: 'consumption',
        occurred_on: new Date().toISOString().slice(0, 10),
        quantity: '',
        reference: '',
        destination: defaultDestination,
        notes: '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post(`/voucher-items/${item.id}/dispositions`, {
            preserveScroll: true,
            onSuccess: () => form.reset('quantity', 'reference', 'notes'),
        });
    };
    const isReturn = form.data.type === 'return';
    const fieldId = (name: string) => `item-${item.id}-${name}`;

    return (
        <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-md border border-primary/25 bg-primary-subtle/35 p-4 sm:p-5"
        >
            <div>
                <h3 className="font-semibold">Registrar comprobación</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                    Indica qué ocurrió con una parte del material entregado.
                </p>
            </div>
            <div className="flex flex-col gap-2">
                <Label>¿Qué ocurrió con el material?</Label>
                <RadioGroup
                    aria-label="Qué ocurrió con el material"
                    aria-invalid={!!form.errors.type || undefined}
                    className="grid gap-3 sm:grid-cols-2"
                    value={form.data.type}
                    onValueChange={(value) => form.setData('type', value)}
                >
                    <Label
                        htmlFor={fieldId('consumption')}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-[background-color,border-color,box-shadow] ${!isReturn ? 'border-primary bg-surface shadow-xs ring-2 ring-primary/10' : 'border-border-strong bg-surface hover:bg-hover'}`}
                    >
                        <RadioGroupItem
                            id={fieldId('consumption')}
                            value="consumption"
                            className="mt-0.5"
                        />
                        <Wrench
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                        />
                        <span>
                            <span className="block font-medium">
                                Material utilizado
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                Aplicación en un trabajo o servicio.
                            </span>
                        </span>
                    </Label>
                    <Label
                        htmlFor={fieldId('return')}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-[background-color,border-color,box-shadow] ${isReturn ? 'border-primary bg-surface shadow-xs ring-2 ring-primary/10' : 'border-border-strong bg-surface hover:bg-hover'}`}
                    >
                        <RadioGroupItem
                            id={fieldId('return')}
                            value="return"
                            className="mt-0.5"
                        />
                        <RotateCcw
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                        />
                        <span>
                            <span className="block font-medium">
                                Material devuelto
                            </span>
                            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                                Regresó sin utilizarse y deja de estar
                                pendiente.
                            </span>
                        </span>
                    </Label>
                </RadioGroup>
                <InputError message={form.errors.type} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="flex flex-col gap-2">
                    <Label htmlFor={fieldId('date')}>Fecha</Label>
                    <Input
                        id={fieldId('date')}
                        type="date"
                        value={form.data.occurred_on}
                        onChange={(e) =>
                            form.setData('occurred_on', e.target.value)
                        }
                        aria-invalid={!!form.errors.occurred_on || undefined}
                    />
                    <InputError message={form.errors.occurred_on} />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                        <Label htmlFor={fieldId('quantity')}>Cantidad</Label>
                        <span
                            id={fieldId('quantity-help')}
                            className="text-xs text-muted-foreground"
                        >
                            Disponible: {formatQuantity(item.pending_quantity)}{' '}
                            {item.unit.symbol}
                        </span>
                    </div>
                    <Input
                        id={fieldId('quantity')}
                        inputMode="decimal"
                        value={form.data.quantity}
                        onChange={(e) =>
                            form.setData('quantity', e.target.value)
                        }
                        placeholder="0.000"
                        aria-describedby={fieldId('quantity-help')}
                        aria-invalid={!!form.errors.quantity || undefined}
                    />
                    <InputError message={form.errors.quantity} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={fieldId('reference')}>
                        Reporte / orden (opcional)
                    </Label>
                    <Input
                        id={fieldId('reference')}
                        value={form.data.reference}
                        onChange={(e) =>
                            form.setData('reference', e.target.value)
                        }
                        placeholder="Ej. reporte 22072"
                        aria-invalid={!!form.errors.reference || undefined}
                    />
                    <InputError message={form.errors.reference} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor={fieldId('destination')}>
                        Destino (opcional)
                    </Label>
                    <Input
                        id={fieldId('destination')}
                        value={form.data.destination}
                        onChange={(e) =>
                            form.setData('destination', e.target.value)
                        }
                        aria-invalid={!!form.errors.destination || undefined}
                    />
                    <InputError message={form.errors.destination} />
                </div>
            </div>
            <div className="flex justify-end border-t border-primary/15 pt-4">
                <Button
                    className="w-full sm:w-auto"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {isReturn ? (
                        <RotateCcw data-icon="inline-start" />
                    ) : (
                        <Wrench data-icon="inline-start" />
                    )}
                    {form.processing
                        ? 'Guardando…'
                        : isReturn
                          ? 'Registrar devolución'
                          : 'Registrar material utilizado'}
                </Button>
            </div>
        </form>
    );
}

function DispositionRow({
    row,
    unit,
    active,
}: {
    row: Disposition;
    unit: string;
    active: boolean;
}) {
    const voidRow = () => {
        const reason = window.prompt(
            'Motivo de anulación (mínimo 5 caracteres):',
        );

        if (reason) {
            router.post(
                `/dispositions/${row.id}/void`,
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
                <Badge variant="outline">
                    {row.type === 'return' ? 'Devolución' : 'Aplicación'}
                </Badge>
                {row.legacy_slot && (
                    <span className="ml-2 text-xs text-muted-foreground">
                        Histórico {row.legacy_slot}
                    </span>
                )}
            </td>
            <td className="px-3 py-3">
                <p>{row.reference || 'Sin referencia'}</p>
                <p className="text-xs text-muted-foreground">
                    {row.destination}
                </p>
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
