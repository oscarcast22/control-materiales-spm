import { useForm } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, FileUp, Search, Wrench } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, formatQuantity } from '@/lib/format';
import type { MaterialApplicationReport, Voucher, VoucherItem } from '@/types';

type VoucherOption = {
    id: number;
    folio: string;
    issued_on: string;
    voucher_type: { id: number; name: string; code: string };
    received_by: { id: number; name: string };
    destination_summary: string | null;
    items: VoucherItem[];
};

type ApplicationForm = {
    voucher_id: number | '';
    occurred_on: string;
    reference: string;
    notes: string;
    correction_reason: string;
    items: { voucher_item_id: number; quantity: string }[];
    attachment: File | null;
};

const today = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const activeQuantity = (
    report: MaterialApplicationReport | undefined,
    voucherItemId: number,
) => {
    const quantity = report?.applications.find(
        (application) =>
            application.voucher_item_id === voucherItemId &&
            !application.voided_at,
    )?.quantity;

    return quantity === undefined ? '' : String(Number(quantity));
};

const asOption = (
    voucher: Voucher,
    report?: MaterialApplicationReport,
): VoucherOption => ({
    id: voucher.id,
    folio: voucher.folio,
    issued_on: voucher.issued_on,
    voucher_type: voucher.voucher_type,
    received_by: voucher.received_by!,
    destination_summary: voucher.destination_summary ?? null,
    items: report
        ? voucher.items
        : voucher.items.filter((item) => Number(item.pending_quantity) > 0),
});

const initialForm = (
    voucher?: Voucher,
    report?: MaterialApplicationReport,
): ApplicationForm => ({
    voucher_id: voucher?.id ?? '',
    occurred_on: report?.occurred_on ?? today(),
    reference: report?.service_order ?? '',
    notes: report?.notes ?? '',
    correction_reason: '',
    items: voucher
        ? asOption(voucher, report).items.map((item) => ({
              voucher_item_id: item.id,
              quantity: activeQuantity(report, item.id),
          }))
        : [],
    attachment: null,
});

export function QuickApplicationDialog({
    trigger,
    voucher,
    report,
    onSuccess,
}: {
    trigger: ReactNode;
    voucher?: Voucher;
    report?: MaterialApplicationReport;
    onSuccess?: () => void;
}) {
    const editMode = Boolean(report);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<VoucherOption[]>([]);
    const [selected, setSelected] = useState<VoucherOption | null>(
        voucher ? asOption(voucher, report) : null,
    );
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [itemsError, setItemsError] = useState('');
    const form = useForm<ApplicationForm>(initialForm(voucher, report));

    useEffect(() => {
        if (!open || voucher || selected || search.trim() === '') {
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            setSearching(true);
            setSearchError('');

            try {
                const response = await fetch(
                    `/material-applications/vouchers?search=${encodeURIComponent(search.trim())}`,
                    {
                        headers: { Accept: 'application/json' },
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    throw new Error('No fue posible consultar los vales.');
                }

                const payload = (await response.json()) as {
                    data: VoucherOption[];
                };
                setResults(payload.data);
            } catch (error) {
                if (!(
                    error instanceof DOMException && error.name === 'AbortError'
                )) {
                    setSearchError('No fue posible consultar los vales.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setSearching(false);
                }
            }
        }, 250);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [open, search, selected, voucher]);

    const chooseVoucher = (option: VoucherOption) => {
        setSelected(option);
        setItemsError('');
        form.clearErrors();
        form.setData({
            ...form.data,
            voucher_id: option.id,
            items: option.items.map((item) => ({
                voucher_item_id: item.id,
                quantity: '',
            })),
        });
    };

    const changeVoucher = () => {
        if (voucher) {
            return;
        }

        setSelected(null);
        setResults([]);
        setSearch('');
        form.setData('voucher_id', '');
        form.setData('items', []);
    };

    const close = (force = false) => {
        if (form.processing && !force) {
            return;
        }

        setOpen(false);
        setSearch('');
        setResults([]);
        setSearchError('');
        setItemsError('');
        form.reset();
        form.clearErrors();
        setSelected(voucher ? asOption(voucher, report) : null);
    };

    const openDialog = () => {
        const nextSelected = voucher ? asOption(voucher, report) : null;

        setSelected(nextSelected);
        form.setData(initialForm(voucher, report));
        form.clearErrors();
        setItemsError('');
        setOpen(true);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const positiveItems = form.data.items.filter(
            (item) => Number(item.quantity) > 0,
        );

        if (!editMode && positiveItems.length === 0) {
            setItemsError(
                'Captura la cantidad aplicada de al menos un material.',
            );

            return;
        }

        setItemsError('');
        form.transform((data) => ({
            ...data,
            items: editMode
                ? data.items.map((item) => ({
                      ...item,
                      quantity: item.quantity === '' ? '0' : item.quantity,
                  }))
                : positiveItems,
        }));
        const options = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                close(true);
                onSuccess?.();
            },
        };

        if (editMode && report?.id) {
            form.put(`/material-application-reports/${report.id}`, options);
        } else {
            form.post('/material-applications', {
                ...options,
                forceFormData: true,
            });
        }
    };

    const selectedCount = form.data.items.filter(
        (item) => Number(item.quantity) > 0,
    ).length;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? openDialog() : close())}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
                <DialogHeader className="border-b px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
                    <div className="flex items-start gap-3 pr-8">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-subtle text-primary">
                            <Wrench className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <DialogTitle>
                                {editMode
                                    ? 'Editar aplicación'
                                    : 'Registrar aplicación'}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {editMode
                                    ? 'Corrige la fecha, la orden o las cantidades aplicadas. El cambio quedará auditado.'
                                    : 'Registra la orden de servicio y las cantidades utilizadas.'}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {!selected ? (
                    <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
                        <Field>
                            <FieldLabel htmlFor="application-voucher-search">
                                Folio del vale
                            </FieldLabel>
                            <div className="relative">
                                <Search
                                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    id="application-voucher-search"
                                    className="pl-9"
                                    autoFocus
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Ej. 15628"
                                    autoComplete="off"
                                />
                            </div>
                            <FieldDescription>
                                Sólo aparecen vales de salida activos con
                                material pendiente.
                            </FieldDescription>
                        </Field>

                        <div
                            className="flex min-h-40 flex-col gap-2"
                            aria-live="polite"
                        >
                            {searching && (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    Buscando vale…
                                </p>
                            )}
                            {!searching &&
                                search.trim() !== '' &&
                                results.length === 0 &&
                                !searchError && (
                                    <div className="rounded-md border border-dashed px-4 py-8 text-center">
                                        <p className="font-medium">
                                            No se encontró un vale pendiente
                                        </p>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            Revisa el folio o abre el detalle
                                            para confirmar su estado.
                                        </p>
                                    </div>
                                )}
                            {!searching &&
                                results.map((option) => (
                                    <button
                                        type="button"
                                        key={option.id}
                                        onClick={() => chooseVoucher(option)}
                                        className="flex w-full items-center justify-between gap-4 rounded-md border border-border-strong bg-surface px-4 py-3 text-left transition-colors hover:border-primary/55 hover:bg-primary-subtle/25 focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none"
                                    >
                                        <span className="min-w-0">
                                            <span className="block font-semibold">
                                                Vale {option.folio}
                                            </span>
                                            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                                                {option.voucher_type.name} ·{' '}
                                                {option.received_by.name} ·{' '}
                                                {formatDate(option.issued_on)}
                                            </span>
                                        </span>
                                        <Badge
                                            variant="warning"
                                            className="shrink-0"
                                        >
                                            {option.items.length}{' '}
                                            {option.items.length === 1
                                                ? 'partida'
                                                : 'partidas'}
                                        </Badge>
                                    </button>
                                ))}
                            <FieldError>{searchError}</FieldError>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="flex flex-col">
                        <div className="flex flex-col gap-5 px-5 py-5 sm:px-6">
                            <section className="rounded-md border border-primary/20 bg-primary-subtle/25 p-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="font-semibold">
                                            Vale {selected.folio}
                                        </p>
                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                            {selected.voucher_type.name} ·{' '}
                                            {selected.received_by.name} ·{' '}
                                            {formatDate(selected.issued_on)}
                                        </p>
                                        <p className="mt-2 text-sm">
                                            {selected.destination_summary ??
                                                'Sin ubicación o actividad registrada'}
                                        </p>
                                    </div>
                                    {!voucher && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={changeVoucher}
                                        >
                                            <ArrowLeft data-icon="inline-start" />
                                            Cambiar vale
                                        </Button>
                                    )}
                                </div>
                            </section>

                            <FieldGroup className="grid gap-4 sm:grid-cols-2">
                                <Field
                                    invalid={Boolean(form.errors.occurred_on)}
                                >
                                    <FieldLabel htmlFor="application-date">
                                        Fecha de aplicación
                                    </FieldLabel>
                                    <Input
                                        id="application-date"
                                        type="date"
                                        value={form.data.occurred_on}
                                        onChange={(event) =>
                                            form.setData(
                                                'occurred_on',
                                                event.target.value,
                                            )
                                        }
                                        aria-invalid={
                                            !!form.errors.occurred_on ||
                                            undefined
                                        }
                                    />
                                    <FieldError>
                                        {form.errors.occurred_on}
                                    </FieldError>
                                </Field>
                                <Field invalid={Boolean(form.errors.reference)}>
                                    <FieldLabel htmlFor="application-reference">
                                        Orden de servicio
                                    </FieldLabel>
                                    <Input
                                        id="application-reference"
                                        value={form.data.reference}
                                        onChange={(event) =>
                                            form.setData(
                                                'reference',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Ej. A-24391"
                                        required
                                        aria-invalid={
                                            !!form.errors.reference || undefined
                                        }
                                    />
                                    <FieldError>
                                        {form.errors.reference}
                                    </FieldError>
                                </Field>
                            </FieldGroup>

                            <Field invalid={Boolean(form.errors.notes)}>
                                <FieldLabel htmlFor="application-notes">
                                    Comentarios (opcional)
                                </FieldLabel>
                                <Textarea
                                    id="application-notes"
                                    value={form.data.notes}
                                    onChange={(event) =>
                                        form.setData(
                                            'notes',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Aclaraciones generales de esta aplicación"
                                    rows={3}
                                    aria-invalid={
                                        !!form.errors.notes || undefined
                                    }
                                />
                                <FieldError>{form.errors.notes}</FieldError>
                            </Field>

                            <section
                                className="flex flex-col gap-3"
                                aria-labelledby="application-materials-title"
                            >
                                <div>
                                    <h3
                                        id="application-materials-title"
                                        className="font-semibold"
                                    >
                                        Material utilizado
                                    </h3>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        Escribe únicamente las cantidades
                                        reportadas en esta aplicación.
                                    </p>
                                </div>
                                <div className="overflow-hidden rounded-md border">
                                    {selected.items.map((item, index) => {
                                        const error = (
                                            form.errors as Record<
                                                string,
                                                string
                                            >
                                        )[`items.${index}.quantity`];
                                        const registered = Number(
                                            activeQuantity(report, item.id) ||
                                                0,
                                        );
                                        const maximum =
                                            Number(item.pending_quantity) +
                                            registered;

                                        return (
                                            <div
                                                key={item.id}
                                                className="grid gap-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium">
                                                        {item.description}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {editMode ? (
                                                            <>
                                                                Registrado:{' '}
                                                                {formatQuantity(
                                                                    registered,
                                                                )}{' '}
                                                                {
                                                                    item.unit
                                                                        .symbol
                                                                }{' '}
                                                                · máximo:{' '}
                                                                {formatQuantity(
                                                                    maximum,
                                                                )}{' '}
                                                                {
                                                                    item.unit
                                                                        .symbol
                                                                }
                                                            </>
                                                        ) : (
                                                            <>
                                                                Pendiente:{' '}
                                                                {formatQuantity(
                                                                    item.pending_quantity,
                                                                )}{' '}
                                                                {
                                                                    item.unit
                                                                        .symbol
                                                                }
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                                <Field invalid={Boolean(error)}>
                                                    <FieldLabel
                                                        htmlFor={`application-item-${item.id}`}
                                                        className="sr-only"
                                                    >
                                                        Cantidad aplicada de{' '}
                                                        {item.description}
                                                    </FieldLabel>
                                                    <div className="relative">
                                                        <Input
                                                            id={`application-item-${item.id}`}
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={
                                                                form.data.items[
                                                                    index
                                                                ]?.quantity ??
                                                                ''
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                const items = [
                                                                    ...form.data
                                                                        .items,
                                                                ];
                                                                items[index] = {
                                                                    voucher_item_id:
                                                                        item.id,
                                                                    quantity:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                };
                                                                form.setData(
                                                                    'items',
                                                                    items,
                                                                );
                                                            }}
                                                            placeholder="0"
                                                            aria-invalid={
                                                                !!error ||
                                                                undefined
                                                            }
                                                            className="pr-14 text-right tabular-nums"
                                                        />
                                                        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                                                            {item.unit.symbol}
                                                        </span>
                                                    </div>
                                                    <FieldError className="text-xs">
                                                        {error}
                                                    </FieldError>
                                                </Field>
                                            </div>
                                        );
                                    })}
                                </div>
                                <FieldError>
                                    {itemsError || form.errors.items}
                                </FieldError>
                            </section>

                            {editMode ? (
                                <Field
                                    invalid={Boolean(
                                        form.errors.correction_reason,
                                    )}
                                >
                                    <FieldLabel htmlFor="application-correction-reason">
                                        Motivo de la corrección
                                    </FieldLabel>
                                    <Textarea
                                        id="application-correction-reason"
                                        value={form.data.correction_reason}
                                        onChange={(event) =>
                                            form.setData(
                                                'correction_reason',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Explica qué dato se corrige"
                                        rows={2}
                                        required
                                        aria-invalid={
                                            !!form.errors.correction_reason ||
                                            undefined
                                        }
                                    />
                                    <FieldDescription>
                                        Las cantidades anteriores se conservarán
                                        anuladas en el historial. Si dejas todas
                                        en 0, la aplicación quedará anulada.
                                    </FieldDescription>
                                    <FieldError>
                                        {form.errors.correction_reason}
                                    </FieldError>
                                </Field>
                            ) : (
                                <Field
                                    invalid={Boolean(form.errors.attachment)}
                                >
                                    <FieldLabel htmlFor="application-attachment">
                                        Foto o PDF de respaldo (opcional)
                                    </FieldLabel>
                                    <Input
                                        id="application-attachment"
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                                        onChange={(event) =>
                                            form.setData(
                                                'attachment',
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                        aria-invalid={
                                            !!form.errors.attachment ||
                                            undefined
                                        }
                                    />
                                    <FieldDescription className="flex items-center gap-2">
                                        <FileUp
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        Un archivo privado de hasta 10 MB.
                                    </FieldDescription>
                                    <FieldError>
                                        {form.errors.attachment}
                                    </FieldError>
                                </Field>
                            )}
                        </div>

                        <DialogFooter className="border-t bg-muted/25 px-5 py-4 sm:px-6">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={form.processing}
                                >
                                    Cancelar
                                </Button>
                            </DialogClose>
                            <Button
                                disabled={
                                    form.processing ||
                                    (!editMode && selectedCount === 0)
                                }
                                aria-busy={form.processing}
                            >
                                {form.processing ? (
                                    'Guardando…'
                                ) : editMode ? (
                                    <>
                                        <CheckCircle2 data-icon="inline-start" />
                                        Guardar corrección
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 data-icon="inline-start" />
                                        Registrar {selectedCount || ''}{' '}
                                        {selectedCount === 1
                                            ? 'aplicación'
                                            : 'aplicaciones'}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
