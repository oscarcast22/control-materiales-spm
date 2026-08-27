import { useForm } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, FileUp, Search, Wrench } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatQuantity } from '@/lib/format';
import type { Voucher, VoucherItem } from '@/types';

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
    items: { voucher_item_id: number; quantity: string }[];
    attachment: File | null;
};

const today = () => {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const asOption = (voucher: Voucher): VoucherOption => ({
    id: voucher.id,
    folio: voucher.folio,
    issued_on: voucher.issued_on,
    voucher_type: voucher.voucher_type,
    received_by: voucher.received_by!,
    destination_summary: voucher.destination_summary ?? null,
    items: voucher.items.filter((item) => Number(item.pending_quantity) > 0),
});

export function QuickApplicationDialog({
    trigger,
    voucher,
}: {
    trigger: ReactNode;
    voucher?: Voucher;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<VoucherOption[]>([]);
    const [selected, setSelected] = useState<VoucherOption | null>(
        voucher ? asOption(voucher) : null,
    );
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    const [itemsError, setItemsError] = useState('');
    const form = useForm<ApplicationForm>({
        voucher_id: voucher?.id ?? '',
        occurred_on: today(),
        reference: '',
        items: voucher
            ? asOption(voucher).items.map((item) => ({
                  voucher_item_id: item.id,
                  quantity: '',
              }))
            : [],
        attachment: null,
    });

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

    const close = () => {
        if (form.processing) {
            return;
        }

        setOpen(false);
        setSearch('');
        setResults([]);
        setSearchError('');
        setItemsError('');
        form.reset();
        form.clearErrors();
        setSelected(voucher ? asOption(voucher) : null);
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        const appliedItems = form.data.items.filter(
            (item) => Number(item.quantity) > 0,
        );

        if (appliedItems.length === 0) {
            setItemsError(
                'Captura la cantidad aplicada de al menos un material.',
            );

            return;
        }

        setItemsError('');
        form.transform((data) => ({ ...data, items: appliedItems }));
        form.post('/material-applications', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: close,
        });
    };

    const selectedCount = useMemo(
        () =>
            form.data.items.filter((item) => Number(item.quantity) > 0).length,
        [form.data.items],
    );

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => (next ? setOpen(true) : close())}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
                <DialogHeader className="border-b px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
                    <div className="flex items-start gap-3 pr-8">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary-subtle text-primary">
                            <Wrench className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                            <DialogTitle>Registrar aplicación</DialogTitle>
                            <DialogDescription className="mt-1">
                                Registra en qué vale y qué cantidades ya fueron
                                utilizadas.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {!selected ? (
                    <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="application-voucher-search">
                                Folio del vale
                            </Label>
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
                            <p className="text-xs text-muted-foreground">
                                Sólo aparecen vales de salida activos o
                                prestados con material pendiente.
                            </p>
                        </div>

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
                            <InputError message={searchError} />
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

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="application-date">
                                        Fecha de aplicación
                                    </Label>
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
                                    <InputError
                                        message={form.errors.occurred_on}
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="application-reference">
                                        Orden de servicio (opcional)
                                    </Label>
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
                                        aria-invalid={
                                            !!form.errors.reference || undefined
                                        }
                                    />
                                    <InputError
                                        message={form.errors.reference}
                                    />
                                </div>
                            </div>

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
                                        reportadas en esta orden.
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
                                                        Pendiente:{' '}
                                                        {formatQuantity(
                                                            item.pending_quantity,
                                                        )}{' '}
                                                        {item.unit.symbol}
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <Label
                                                        htmlFor={`application-item-${item.id}`}
                                                        className="sr-only"
                                                    >
                                                        Cantidad aplicada de{' '}
                                                        {item.description}
                                                    </Label>
                                                    <div className="relative">
                                                        <Input
                                                            id={`application-item-${item.id}`}
                                                            inputMode="decimal"
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
                                                            placeholder="0.000"
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
                                                    <InputError
                                                        message={error}
                                                        className="text-xs"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <InputError
                                    message={itemsError || form.errors.items}
                                />
                            </section>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="application-attachment">
                                    Foto o PDF de la orden (opcional)
                                </Label>
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
                                        !!form.errors.attachment || undefined
                                    }
                                />
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <FileUp
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    Un archivo privado de hasta 10 MB.
                                </div>
                                <InputError message={form.errors.attachment} />
                            </div>
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
                                    form.processing || selectedCount === 0
                                }
                                aria-busy={form.processing}
                            >
                                {form.processing ? (
                                    'Guardando…'
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
