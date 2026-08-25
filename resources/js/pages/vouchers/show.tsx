import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    FileText,
    Pencil,
    Printer,
    RotateCcw,
    Wrench,
} from 'lucide-react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatBytes, formatDate, formatQuantity } from '@/lib/format';
import type { Disposition, Voucher, VoucherItem } from '@/types';

const labels: Record<string, string> = {
    pending: 'Pendiente',
    settled: 'Liquidado',
    anomaly: 'Anomalía',
    cancelled: 'Cancelado',
    received: 'Entrada recibida',
};

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

    return (
        <>
            <Head title={`Vale ${voucher.folio}`} />
            <div className="flex flex-1 flex-col gap-5 p-4 md:p-7">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/vouchers">
                                <ArrowLeft className="size-5" />
                            </Link>
                        </Button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-3xl font-bold">
                                    Vale #{voucher.folio}
                                </h1>
                                <Badge
                                    variant={
                                        voucher.balance_state === 'anomaly'
                                            ? 'destructive'
                                            : voucher.balance_state ===
                                                'settled'
                                              ? 'secondary'
                                              : 'outline'
                                    }
                                >
                                    {labels[voucher.balance_state]}
                                </Badge>
                                {voucher.needs_review && (
                                    <Badge
                                        className="border-amber-400 text-amber-700"
                                        variant="outline"
                                    >
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
                                <Printer className="mr-2 size-4" />
                                Imprimir
                            </a>
                        </Button>
                        {voucher.status === 'active' && (
                            <>
                                <Button variant="outline" asChild>
                                    <Link href={`/vouchers/${voucher.id}/edit`}>
                                        <Pencil className="mr-2 size-4" />
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
                <div className="space-y-5">
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
                                        className="flex min-w-0 items-center gap-2 text-sm font-medium text-sky-700 hover:underline"
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
            className={item.balance_state === 'anomaly' ? 'border-red-400' : ''}
        >
            <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <CardTitle>{item.description}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Unidad: {item.unit.name} ({item.unit.symbol})
                    </p>
                </div>
                <div
                    className={`grid gap-4 text-center ${direction === 'entry' ? 'grid-cols-1' : 'grid-cols-4'}`}
                >
                    <Quantity
                        label={direction === 'entry' ? 'Recibido' : 'Entregado'}
                        value={item.quantity}
                        unit={item.unit.symbol}
                    />
                    {direction === 'exit' && (
                        <>
                            <Quantity
                                label="Usado"
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
            <CardContent className="space-y-5">
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
                {direction === 'exit' && (
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

    return (
        <form
            onSubmit={submit}
            className="grid gap-3 rounded-xl border bg-sky-50/50 p-4 md:grid-cols-6 dark:bg-sky-950/20"
        >
            <div>
                <Label>Tipo</Label>
                <select
                    className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.data.type}
                    onChange={(e) => form.setData('type', e.target.value)}
                >
                    <option value="consumption">Aplicación</option>
                    <option value="return">Devolución</option>
                </select>
            </div>
            <div>
                <Label>Fecha</Label>
                <Input
                    className="mt-2"
                    type="date"
                    value={form.data.occurred_on}
                    onChange={(e) =>
                        form.setData('occurred_on', e.target.value)
                    }
                />
            </div>
            <div>
                <Label>Cantidad</Label>
                <Input
                    className="mt-2"
                    inputMode="decimal"
                    value={form.data.quantity}
                    onChange={(e) => form.setData('quantity', e.target.value)}
                    placeholder={`Máx. ${formatQuantity(item.pending_quantity)}`}
                />
                <InputError message={form.errors.quantity} />
            </div>
            <div>
                <Label>Reporte / orden</Label>
                <Input
                    className="mt-2"
                    value={form.data.reference}
                    onChange={(e) => form.setData('reference', e.target.value)}
                    placeholder="Opcional"
                />
            </div>
            <div className="md:col-span-2">
                <Label>Destino</Label>
                <div className="mt-2 flex gap-2">
                    <Input
                        value={form.data.destination}
                        onChange={(e) =>
                            form.setData('destination', e.target.value)
                        }
                    />
                    <Button disabled={form.processing}>
                        {form.data.type === 'return' ? (
                            <RotateCcw className="mr-2 size-4" />
                        ) : (
                            <Wrench className="mr-2 size-4" />
                        )}
                        {form.processing ? 'Guardando' : 'Registrar'}
                    </Button>
                </div>
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
                    strong ? 'font-bold text-amber-700' : 'font-semibold'
                }
            >
                {formatQuantity(value)}{' '}
                <span className="text-xs font-normal">{unit}</span>
            </p>
        </div>
    );
}
