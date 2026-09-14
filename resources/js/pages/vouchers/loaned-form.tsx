import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Check, PackageSearch, Save, Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { ModalFooter, ModalHeader } from '@/components/modal-shell';
import { Page, PageHeader } from '@/components/page';
import { SearchableSelect } from '@/components/searchable-select';
import { SimpleSelect } from '@/components/simple-select';
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
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VoucherEvidencePanel } from '@/components/voucher-evidence-panel';
import {
    isPositiveQuantity,
    quantityForInput,
    quantityInput,
} from '@/lib/quantity';
import type {
    ChoiceOption,
    Material,
    Named,
    Voucher,
    VoucherType,
} from '@/types';

type Line = {
    client_id: string;
    id?: number;
    material_id: string;
    quantity: string;
    luminaire_folios: string;
    confirmed: boolean;
    locked?: boolean;
};

type FormData = {
    _dialog: boolean;
    voucher_type_id: string;
    folio: string;
    issued_on: string;
    loaned_to_name: string;
    received_by_id: string;
    items: Line[];
    attachments: File[];
};

export type LoanedVoucherFormProps = {
    voucher: Voucher | null;
    materials: Material[];
    receivers: Named[];
    voucherTypes: VoucherType[];
    formKind?: 'loaned';
    embedded?: boolean;
    onSuccess?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
    onCancel?: () => void;
};

let nextLineId = 0;

const blankLine = (): Line => ({
    client_id: `loaned-${++nextLineId}`,
    material_id: '',
    quantity: '',
    luminaire_folios: '',
    confirmed: false,
});

export default function LoanedVoucherForm({
    voucher,
    materials,
    receivers,
    voucherTypes,
    embedded = false,
    onSuccess,
    onDirtyChange,
    onCancel,
}: LoanedVoucherFormProps) {
    const formElement = useRef<HTMLFormElement>(null);
    const form = useForm<FormData>({
        _dialog: embedded,
        voucher_type_id: voucher
            ? String(voucher.voucher_type.id)
            : String(voucherTypes[0]?.id ?? ''),
        folio: voucher?.folio ?? '',
        issued_on: voucher?.issued_on ?? new Date().toISOString().slice(0, 10),
        loaned_to_name: voucher?.loaned_to_name ?? '',
        received_by_id: voucher?.received_by
            ? String(voucher.received_by.id)
            : '',
        attachments: [],
        items: voucher
            ? [
                  ...voucher.items.map((item) => ({
                      client_id: `saved-${item.id}`,
                      id: item.id,
                      material_id: String(item.material.id),
                      quantity: quantityForInput(item.quantity),
                      luminaire_folios: item.luminaire_folios ?? '',
                      confirmed: true,
                      locked: item.applications.length > 0,
                  })),
                  blankLine(),
              ]
            : [blankLine()],
    });
    const voucherTypeOptions = useMemo<ChoiceOption[]>(
        () =>
            voucherTypes.map((type) => ({
                value: String(type.id),
                label: type.name,
            })),
        [voucherTypes],
    );
    const receiverOptions = useMemo<ChoiceOption[]>(
        () =>
            receivers.map((person) => ({
                value: String(person.id),
                label: person.name,
            })),
        [receivers],
    );
    const materialOptions = useMemo<ChoiceOption[]>(
        () =>
            materials
                .filter((material) =>
                    material.voucher_types?.some(
                        (type) => String(type.id) === form.data.voucher_type_id,
                    ),
                )
                .map((material) => ({
                    value: String(material.id),
                    label: material.name,
                    meta: material.default_unit?.symbol ?? 's/e',
                    searchTerms: material.default_unit
                        ? [
                              material.default_unit.name,
                              material.default_unit.symbol,
                          ]
                        : [],
                })),
        [form.data.voucher_type_id, materials],
    );
    const confirmedCount = form.data.items.filter(
        (line) => line.confirmed,
    ).length;
    const hasLockedItems = form.data.items.some((line) => line.locked);
    const errorSignature = Object.entries(form.errors)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([field, message]) => `${field}:${message}`)
        .join('|');

    useEffect(() => {
        onDirtyChange?.(form.isDirty);
    }, [form.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!errorSignature) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const target = formElement.current?.querySelector<HTMLElement>(
                '[aria-invalid="true"]',
            );
            target?.scrollIntoView({ block: 'center' });
            target?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [errorSignature]);

    const changeVoucherType = (voucherTypeId: string) => {
        const allowed = new Set(
            materials
                .filter((material) =>
                    material.voucher_types?.some(
                        (type) => String(type.id) === voucherTypeId,
                    ),
                )
                .map((material) => String(material.id)),
        );
        let removed = 0;
        const items = form.data.items.map((line) => {
            if (line.material_id && !allowed.has(line.material_id)) {
                removed++;

                return {
                    ...line,
                    material_id: '',
                    quantity: '',
                    luminaire_folios: '',
                    confirmed: false,
                };
            }

            return line;
        });

        form.setData((current) => ({
            ...current,
            voucher_type_id: voucherTypeId,
            items,
        }));

        if (removed > 0) {
            toast.info(
                removed === 1
                    ? 'Se limpió un material que no pertenece al nuevo tipo de vale.'
                    : `Se limpiaron ${removed} materiales que no pertenecen al nuevo tipo de vale.`,
            );
        }
    };
    const changeLine = (index: number, values: Partial<Line>) => {
        form.setData(
            'items',
            form.data.items.map((line, candidateIndex) =>
                candidateIndex === index
                    ? {
                          ...line,
                          ...values,
                          confirmed:
                              line.locked ||
                              (!('material_id' in values) &&
                                  !('quantity' in values))
                                  ? line.confirmed
                                  : false,
                      }
                    : line,
            ),
        );
    };
    const selectMaterial = (index: number, materialId: string) => {
        changeLine(index, {
            material_id: materialId,
            luminaire_folios: '',
        });
        form.clearErrors(
            `items.${index}.luminaire_folios` as keyof typeof form.errors,
        );
        window.setTimeout(
            () =>
                document
                    .getElementById(`loaned-item-${index}-quantity`)
                    ?.focus(),
            0,
        );
    };
    const confirmLine = (index: number) => {
        const line = form.data.items[index];

        if (!line || !isComplete(line, materials)) {
            form.setError(
                'items',
                'Completa el material y la cantidad antes de confirmarlo.',
            );

            return;
        }

        const otherDraft = form.data.items.findIndex(
            (candidate, candidateIndex) =>
                candidateIndex !== index &&
                !candidate.confirmed &&
                !hasValues(candidate),
        );
        form.clearErrors('items');
        form.setData('items', [
            ...form.data.items.map((candidate, candidateIndex) =>
                candidateIndex === index
                    ? { ...candidate, confirmed: true }
                    : candidate,
            ),
            ...(otherDraft === -1 ? [blankLine()] : []),
        ]);
    };
    const removeLine = (index: number) => {
        const items = form.data.items.filter(
            (_, candidateIndex) => candidateIndex !== index,
        );
        form.setData('items', items.length > 0 ? items : [blankLine()]);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();

        const draftIndex = form.data.items.findIndex(
            (line) => !line.confirmed && hasValues(line),
        );

        if (draftIndex !== -1) {
            form.setError(
                'items',
                isComplete(form.data.items[draftIndex], materials)
                    ? 'Confirma el material pendiente antes de guardar.'
                    : 'Completa y confirma el material pendiente antes de guardar.',
            );

            return;
        }

        form.transform((data) => ({
            ...data,
            items: data.items
                .filter((line) => line.confirmed)
                .map((line) => ({
                    ...(line.id === undefined ? {} : { id: line.id }),
                    material_id: line.material_id,
                    quantity: line.quantity,
                    luminaire_folios: line.luminaire_folios,
                })),
        }));
        const options = { preserveScroll: true, onSuccess };

        if (voucher) {
            form.put(`/vouchers/${voucher.id}`, options);
        } else {
            form.post('/vouchers/loaned', options);
        }
    };

    const body = (
        <>
            <Alert variant="info">
                <AlertDescription>
                    Este vale conserva únicamente una referencia administrativa.
                    No genera saldos pendientes ni permite registrar
                    aplicaciones.
                </AlertDescription>
            </Alert>
            {voucher && (
                <VoucherEvidencePanel attachments={voucher.attachments} />
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Datos del vale prestado</CardTitle>
                    <CardDescription>
                        El técnico, la persona responsable y los materiales son
                        opcionales y pueden completarse después.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            id="loaned-voucher-type"
                            label="Tipo de vale"
                            error={form.errors.voucher_type_id}
                            description={
                                hasLockedItems
                                    ? 'No se puede cambiar porque el vale conserva aplicaciones históricas.'
                                    : undefined
                            }
                        >
                            <SimpleSelect
                                id="loaned-voucher-type"
                                value={form.data.voucher_type_id}
                                onValueChange={changeVoucherType}
                                options={voucherTypeOptions}
                                placeholder="Seleccionar tipo"
                                disabled={hasLockedItems}
                                invalid={Boolean(form.errors.voucher_type_id)}
                            />
                        </FormField>
                        <FormField
                            id="loaned-voucher-folio"
                            label="Folio"
                            error={form.errors.folio}
                        >
                            <Input
                                id="loaned-voucher-folio"
                                value={form.data.folio}
                                onChange={(event) =>
                                    form.setData('folio', event.target.value)
                                }
                                placeholder="Ej. 16576"
                                aria-invalid={
                                    Boolean(form.errors.folio) || undefined
                                }
                            />
                        </FormField>
                        <FormField
                            id="loaned-voucher-date"
                            label="Fecha"
                            error={form.errors.issued_on}
                        >
                            <Input
                                id="loaned-voucher-date"
                                type="date"
                                value={form.data.issued_on}
                                onChange={(event) =>
                                    form.setData(
                                        'issued_on',
                                        event.target.value,
                                    )
                                }
                                aria-invalid={
                                    Boolean(form.errors.issued_on) || undefined
                                }
                            />
                        </FormField>
                        <FormField
                            id="loaned-voucher-holder"
                            label="Persona responsable (opcional)"
                            error={form.errors.loaned_to_name}
                        >
                            <Input
                                id="loaned-voucher-holder"
                                value={form.data.loaned_to_name}
                                onChange={(event) =>
                                    form.setData(
                                        'loaned_to_name',
                                        event.target.value,
                                    )
                                }
                                placeholder="Nombre libre"
                                autoComplete="off"
                                aria-invalid={
                                    Boolean(form.errors.loaned_to_name) ||
                                    undefined
                                }
                            />
                        </FormField>
                        <FormField
                            id="loaned-voucher-technician"
                            label="Técnico (opcional)"
                            error={form.errors.received_by_id}
                            className="sm:col-span-2"
                        >
                            <SearchableSelect
                                id="loaned-voucher-technician"
                                value={form.data.received_by_id}
                                onValueChange={(value) =>
                                    form.setData('received_by_id', value)
                                }
                                options={receiverOptions}
                                placeholder="Seleccionar técnico"
                                searchPlaceholder="Buscar técnico…"
                                emptyMessage="No se encontró ningún técnico."
                                emptyLabel="Sin técnico asignado"
                                invalid={Boolean(form.errors.received_by_id)}
                            />
                        </FormField>
                    </FieldGroup>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle>Material prestado</CardTitle>
                            <CardDescription>
                                Registra sólo las cantidades del documento; no
                                se calcularán como pendientes.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary">
                            {confirmedCount}{' '}
                            {confirmedCount === 1 ? 'material' : 'materiales'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <FieldGroup>
                        {form.data.items.map((line, index) => {
                            const materialError =
                                form.errors[
                                    `items.${index}.material_id` as keyof typeof form.errors
                                ];
                            const quantityError =
                                form.errors[
                                    `items.${index}.quantity` as keyof typeof form.errors
                                ];
                            const luminaireFoliosError =
                                form.errors[
                                    `items.${index}.luminaire_folios` as keyof typeof form.errors
                                ];
                            const selectedMaterial = materials.find(
                                (material) =>
                                    String(material.id) === line.material_id,
                            );
                            const unit = selectedMaterial?.default_unit;
                            const quantityConfig = quantityInput(unit);

                            return (
                                <fieldset
                                    key={line.client_id}
                                    data-confirmed={line.confirmed || undefined}
                                    className="grid min-w-0 items-start gap-4 rounded-xl border border-border/80 bg-surface-subtle/55 p-4 transition-[background-color,border-color] data-[confirmed=true]:border-success/35 data-[confirmed=true]:bg-success-subtle/45 min-[900px]:!grid-cols-[minmax(260px,1fr)_minmax(190px,220px)_190px] sm:grid-cols-2"
                                >
                                    <legend className="sr-only">
                                        Material {index + 1}
                                    </legend>
                                    <FormField
                                        id={`loaned-item-${index}-material`}
                                        label={
                                            <span className="flex items-center gap-2">
                                                <span>
                                                    Material {index + 1}
                                                </span>
                                                {line.confirmed && (
                                                    <Badge
                                                        variant={
                                                            line.locked
                                                                ? 'outline'
                                                                : 'success'
                                                        }
                                                        className="min-h-5 px-2 text-[11px]"
                                                    >
                                                        {line.locked
                                                            ? 'Con historial'
                                                            : 'Agregado'}
                                                    </Badge>
                                                )}
                                            </span>
                                        }
                                        error={materialError}
                                        className="min-[900px]:!col-span-1 sm:col-span-2"
                                    >
                                        <SearchableSelect
                                            id={`loaned-item-${index}-material`}
                                            value={line.material_id}
                                            onValueChange={(value) =>
                                                selectMaterial(index, value)
                                            }
                                            options={materialOptions}
                                            placeholder="Seleccionar material"
                                            searchPlaceholder="Buscar material…"
                                            emptyMessage="No encontramos ese material."
                                            disabled={line.locked}
                                            invalid={Boolean(materialError)}
                                        />
                                    </FormField>
                                    <FormField
                                        id={`loaned-item-${index}-quantity`}
                                        label={
                                            <span className="flex min-w-0 items-baseline gap-1.5 overflow-hidden">
                                                <span className="shrink-0">
                                                    Cantidad
                                                </span>
                                                {unit && (
                                                    <span
                                                        className="min-w-0 truncate text-xs font-medium text-muted-foreground"
                                                        title={`Unidad: ${unit.name} (${unit.symbol})`}
                                                    >
                                                        Unidad: {unit.name} (
                                                        {unit.symbol})
                                                    </span>
                                                )}
                                            </span>
                                        }
                                        error={quantityError}
                                    >
                                        <Input
                                            id={`loaned-item-${index}-quantity`}
                                            inputMode={quantityConfig.inputMode}
                                            pattern={quantityConfig.pattern}
                                            value={line.quantity}
                                            onChange={(event) =>
                                                changeLine(index, {
                                                    quantity:
                                                        event.target.value,
                                                })
                                            }
                                            placeholder={
                                                quantityConfig.placeholder
                                            }
                                            disabled={line.locked}
                                            aria-invalid={
                                                Boolean(quantityError) ||
                                                undefined
                                            }
                                            aria-describedby={
                                                quantityError
                                                    ? `loaned-item-${index}-quantity-error`
                                                    : undefined
                                            }
                                        />
                                    </FormField>
                                    {selectedMaterial?.is_luminaire && (
                                        <FormField
                                            id={`loaned-item-${index}-luminaire-folios`}
                                            label="Folios de luminarias"
                                            error={luminaireFoliosError}
                                            description="Opcional. Escribe rangos o folios separados como aparecen en el documento."
                                            className="min-[900px]:!col-span-2 sm:col-span-2"
                                        >
                                            <Textarea
                                                id={`loaned-item-${index}-luminaire-folios`}
                                                rows={2}
                                                maxLength={5000}
                                                value={line.luminaire_folios}
                                                onChange={(event) =>
                                                    changeLine(index, {
                                                        luminaire_folios:
                                                            event.target.value,
                                                    })
                                                }
                                                placeholder="Ej. 100-130, 145, 152, 180-185"
                                                aria-invalid={
                                                    Boolean(
                                                        luminaireFoliosError,
                                                    ) || undefined
                                                }
                                                aria-describedby={
                                                    [
                                                        `loaned-item-${index}-luminaire-folios-description`,
                                                        luminaireFoliosError
                                                            ? `loaned-item-${index}-luminaire-folios-error`
                                                            : undefined,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ') || undefined
                                                }
                                            />
                                        </FormField>
                                    )}
                                    <MaterialLineAction>
                                        {line.locked ? (
                                            <div className="flex min-h-10 w-full items-center rounded-lg border border-border-strong bg-muted/45 px-3 text-xs leading-5 font-medium text-muted-foreground">
                                                Conservado como referencia
                                            </div>
                                        ) : line.confirmed ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full border-danger/35 text-destructive hover:border-danger/55 hover:bg-danger-subtle hover:text-destructive"
                                                onClick={() =>
                                                    removeLine(index)
                                                }
                                                aria-label={`Eliminar material ${index + 1}`}
                                            >
                                                <Trash2
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />{' '}
                                                Eliminar material
                                            </Button>
                                        ) : isComplete(line, materials) ? (
                                            <Button
                                                type="button"
                                                variant="success"
                                                className="w-full"
                                                onClick={() =>
                                                    confirmLine(index)
                                                }
                                                aria-label={`Confirmar material ${index + 1}`}
                                            >
                                                <Check
                                                    data-icon="inline-start"
                                                    aria-hidden="true"
                                                />{' '}
                                                Confirmar material
                                            </Button>
                                        ) : (
                                            <div
                                                role="status"
                                                aria-live="polite"
                                                className="flex min-h-10 w-full items-center rounded-lg border border-dashed border-border-strong/70 bg-surface-raised/60 px-3 text-xs leading-5 font-medium text-muted-foreground max-sm:min-h-11"
                                            >
                                                Completa material y cantidad
                                            </div>
                                        )}
                                    </MaterialLineAction>
                                </fieldset>
                            );
                        })}
                        <InputError
                            id="loaned-voucher-items-error"
                            message={form.errors.items}
                        />
                        <p className="flex items-start gap-2 text-sm text-muted-foreground">
                            <PackageSearch
                                className="mt-0.5 size-4 shrink-0"
                                aria-hidden="true"
                            />
                            Puedes guardar el vale sin materiales y completarlos
                            posteriormente.
                        </p>
                    </FieldGroup>
                </CardContent>
            </Card>
            {!voucher && (
                <Card>
                    <CardHeader>
                        <CardTitle>Respaldo del vale</CardTitle>
                        <CardDescription>
                            Adjunta evidencia del formato prestado para
                            consultarla después.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Field>
                            <FieldLabel htmlFor="loaned-voucher-attachments">
                                Foto o PDF del vale (opcional)
                            </FieldLabel>
                            <Input
                                id="loaned-voucher-attachments"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                multiple
                                onChange={(event) =>
                                    form.setData(
                                        'attachments',
                                        Array.from(event.target.files ?? []),
                                    )
                                }
                                aria-invalid={
                                    Boolean(form.errors.attachments) ||
                                    undefined
                                }
                            />
                            <FieldDescription>
                                Hasta 5 archivos de 10 MB cada uno.
                            </FieldDescription>
                            <InputError message={form.errors.attachments} />
                        </Field>
                    </CardContent>
                </Card>
            )}
        </>
    );

    const content = (
        <form
            ref={formElement}
            onSubmit={submit}
            className={
                embedded
                    ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    : 'flex flex-col gap-5'
            }
        >
            {embedded ? (
                <ModalHeader
                    title={
                        voucher
                            ? `Editar prestado ${voucher.folio}`
                            : 'Registrar folio prestado'
                    }
                />
            ) : (
                <PageHeader
                    title={
                        voucher
                            ? `Editar prestado ${voucher.folio}`
                            : 'Registrar folio prestado'
                    }
                    description="Conserva responsables y material sin generar seguimiento operativo."
                    actions={
                        <>
                            <Button variant="ghost" asChild>
                                <Link
                                    href={
                                        voucher
                                            ? `/vouchers/${voucher.id}`
                                            : '/vouchers'
                                    }
                                >
                                    <ArrowLeft data-icon="inline-start" />{' '}
                                    Volver
                                </Link>
                            </Button>
                            <Button
                                disabled={form.processing}
                                aria-busy={form.processing}
                            >
                                <Save data-icon="inline-start" />
                                {form.processing
                                    ? 'Guardando…'
                                    : 'Guardar prestado'}
                            </Button>
                        </>
                    }
                />
            )}
            {embedded ? (
                <div
                    data-slot="dialog-body"
                    className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
                >
                    {body}
                </div>
            ) : (
                body
            )}
            {embedded && (
                <ModalFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={form.processing}
                        onClick={onCancel}
                    >
                        {voucher ? 'Volver al detalle' : 'Cancelar'}
                    </Button>
                    <Button
                        disabled={form.processing}
                        aria-busy={form.processing}
                    >
                        <Save data-icon="inline-start" />
                        {form.processing ? 'Guardando…' : 'Guardar prestado'}
                    </Button>
                </ModalFooter>
            )}
        </form>
    );

    if (embedded) {
        return content;
    }

    return (
        <>
            <Head
                title={
                    voucher
                        ? `Editar prestado ${voucher.folio}`
                        : 'Registrar prestado'
                }
            />
            <Page width="content">{content}</Page>
        </>
    );
}

function FormField({
    id,
    label,
    error,
    description,
    className,
    children,
}: {
    id: string;
    label: ReactNode;
    error?: string;
    description?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Field data-invalid={Boolean(error) || undefined} className={className}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {children}
            {description && (
                <FieldDescription id={`${id}-description`}>
                    {description}
                </FieldDescription>
            )}
            <InputError id={`${id}-error`} message={error} />
        </Field>
    );
}

function MaterialLineAction({ children }: { children: ReactNode }) {
    return (
        <div className="flex w-full flex-col gap-2">
            <span aria-hidden="true" className="h-4" />
            {children}
        </div>
    );
}

function hasValues(line: Line) {
    return Boolean(
        line.material_id ||
        line.quantity.trim() ||
        line.luminaire_folios.trim(),
    );
}

function isComplete(line: Line, materials: Material[]) {
    const unit = materials.find(
        (material) => String(material.id) === line.material_id,
    )?.default_unit;

    return line.material_id !== '' && isPositiveQuantity(line.quantity, unit);
}
