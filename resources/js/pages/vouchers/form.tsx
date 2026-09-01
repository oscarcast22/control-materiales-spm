import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    Check,
    FileText,
    PackageSearch,
    Save,
    Trash2,
} from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { VoucherDestinationPicker } from '@/components/voucher-destination-picker';
import type {
    Action,
    ActionIndicator,
    ChoiceOption,
    Destination,
    Material,
    Named,
    Program,
    Voucher,
    VoucherType,
} from '@/types';

type Line = {
    client_id: string;
    id?: number;
    material_id: string;
    quantity: string;
    has_applications?: boolean;
    confirmed: boolean;
};
type FormData = {
    _dialog: boolean;
    voucher_type_id: string;
    folio: string;
    direction: 'entry' | 'exit';
    issued_on: string;
    received_by_id: string;
    delivered_by_id: string;
    authorized_by_id: string;
    action_id: string;
    action_indicator_id: string;
    destination_ids: string[];
    new_destinations: string[];
    usage_description: string;
    notes: string;
    items: Line[];
    attachments: File[];
};
export type VoucherFormProps = {
    voucher: Voucher | null;
    materials: Material[];
    receivers: Named[];
    deliverers: Named[];
    voucherTypes: VoucherType[];
    authorizers: Named[];
    programs: Program[];
    actions: Action[];
    indicators: ActionIndicator[];
    destinations: Destination[];
    embedded?: boolean;
    onSuccess?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
};

let nextLineId = 0;

const blankLine = (): Line => ({
    client_id: `new-${++nextLineId}`,
    material_id: '',
    quantity: '',
    confirmed: false,
});

const quantityForInput = (quantity: string) =>
    quantity.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export default function VoucherForm({
    voucher,
    materials,
    receivers,
    deliverers,
    voucherTypes,
    authorizers,
    programs,
    actions,
    indicators,
    destinations,
    embedded = false,
    onSuccess,
    onDirtyChange,
}: VoucherFormProps) {
    const formElement = useRef<HTMLFormElement>(null);
    const [showUsageDescription, setShowUsageDescription] = useState(
        Boolean(voucher?.usage_description),
    );
    const voucherTypeOptions = useMemo<ChoiceOption[]>(
        () =>
            voucherTypes.map((voucherType) => ({
                value: String(voucherType.id),
                label: voucherType.name,
            })),
        [voucherTypes],
    );
    const receiverOptions = useMemo(
        () => peopleOptions(receivers),
        [receivers],
    );
    const delivererOptions = useMemo(
        () => peopleOptions(deliverers),
        [deliverers],
    );
    const authorizerOptions = useMemo(
        () => peopleOptions(authorizers),
        [authorizers],
    );
    const initialVoucherTypeId = voucher
        ? String(voucher.voucher_type.id)
        : String(voucherTypes[0]?.id ?? '');
    const initialUsesClassification =
        voucherTypes.find(
            (voucherType) => String(voucherType.id) === initialVoucherTypeId,
        )?.code === 'warehouse' && (voucher?.direction ?? 'exit') === 'exit';
    const fixedProgram = programs.find((program) => program.code === 'SPM-06');
    const initialActionId = initialUsesClassification
        ? String(voucher?.action?.id ?? '')
        : '';
    const initialIndicators = indicators.filter(
        (indicator) => String(indicator.action_id) === initialActionId,
    );
    const form = useForm<FormData>({
        _dialog: embedded,
        voucher_type_id: initialVoucherTypeId,
        folio: voucher?.folio ?? '',
        direction: voucher?.direction ?? 'exit',
        issued_on: voucher?.issued_on ?? new Date().toISOString().slice(0, 10),
        received_by_id: voucher?.received_by
            ? String(voucher.received_by.id)
            : '',
        delivered_by_id: voucher?.delivered_by
            ? String(voucher.delivered_by.id)
            : '',
        authorized_by_id: voucher
            ? voucher.authorized_by
                ? String(voucher.authorized_by.id)
                : ''
            : authorizers.length === 1
              ? String(authorizers[0].id)
              : '',
        action_id: initialActionId,
        action_indicator_id: initialUsesClassification
            ? voucher?.indicator
                ? String(voucher.indicator.id)
                : !voucher && initialIndicators.length === 1
                  ? String(initialIndicators[0].id)
                  : ''
            : '',
        destination_ids:
            voucher?.destinations.map((destination) =>
                String(destination.id),
            ) ?? [],
        new_destinations: [],
        usage_description: voucher?.usage_description ?? '',
        notes: voucher?.notes ?? '',
        items: voucher
            ? [
                  ...voucher.items.map((item) => ({
                      client_id: `saved-${item.id}`,
                      id: item.id,
                      material_id: String(item.material.id),
                      quantity: quantityForInput(item.quantity),
                      has_applications: Number(item.used_quantity) > 0,
                      confirmed: true,
                  })),
                  blankLine(),
              ]
            : [blankLine()],
        attachments: [],
    });
    const materialOptions = useMemo<ChoiceOption[]>(
        () =>
            materials
                .filter((material) =>
                    material.voucher_types?.some(
                        (voucherType) =>
                            String(voucherType.id) ===
                            form.data.voucher_type_id,
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
    const actionOptions = useMemo<ChoiceOption[]>(
        () =>
            actions
                .filter(
                    (action) =>
                        String(action.program_id) ===
                        String(fixedProgram?.id ?? ''),
                )
                .map((action) => ({
                    value: String(action.id),
                    label: action.code,
                    meta: action.name ?? undefined,
                    searchTerms: action.name ? [action.name] : [],
                })),
        [actions, fixedProgram?.id],
    );
    const selectedIndicators = useMemo(
        () =>
            indicators.filter(
                (indicator) =>
                    String(indicator.action_id) === form.data.action_id,
            ),
        [form.data.action_id, indicators],
    );
    const indicatorOptions = useMemo<ChoiceOption[]>(
        () =>
            selectedIndicators.map((indicator) => ({
                value: String(indicator.id),
                label: indicator.code,
                meta: indicator.name,
                searchTerms: [indicator.name],
            })),
        [selectedIndicators],
    );
    const usesClassification =
        voucherTypes.find(
            (voucherType) =>
                String(voucherType.id) === form.data.voucher_type_id,
        )?.code === 'warehouse' && form.data.direction === 'exit';
    const errorSignature = Object.entries(form.errors)
        .sort(([firstField], [secondField]) =>
            firstField.localeCompare(secondField),
        )
        .map(([field, message]) => `${field}:${message}`)
        .join('|');
    const destinationError = Object.entries(form.errors).find(([field]) =>
        ['destination_ids', 'new_destinations'].some(
            (prefix) => field === prefix || field.startsWith(`${prefix}.`),
        ),
    )?.[1];
    const destinationLabel =
        form.data.direction === 'entry'
            ? 'Origen o ubicación'
            : 'Ubicación del destino';

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
    const missingDeliverers = deliverers.length === 0;
    const missingAuthorizers = authorizers.length === 0;
    const clearDestinationErrors = () => {
        const fields = Object.keys(form.errors).filter((field) =>
            ['destination_ids', 'new_destinations'].some(
                (prefix) => field === prefix || field.startsWith(`${prefix}.`),
            ),
        );

        fields.forEach((field) =>
            form.clearErrors(field as keyof typeof form.errors),
        );
    };
    const duplicateMaterials = form.data.items
        .map((line) => line.material_id)
        .filter(Boolean)
        .filter((id, index, array) => array.indexOf(id) !== index);
    const confirmedMaterialCount = form.data.items.filter(
        (line) => line.confirmed,
    ).length;
    const changeLine = (index: number, values: Partial<Line>) =>
        form.setData(
            'items',
            form.data.items.map((line, i) =>
                i === index
                    ? {
                          ...line,
                          ...values,
                          confirmed:
                              line.has_applications ||
                              (!('material_id' in values) &&
                                  !('quantity' in values))
                                  ? line.confirmed
                                  : false,
                      }
                    : line,
            ),
        );
    const selectMaterial = (index: number, materialId: string) => {
        changeLine(index, {
            material_id: materialId,
        });
        window.setTimeout(
            () => document.getElementById(`item-${index}-quantity`)?.focus(),
            0,
        );
    };
    const changeVoucherType = (voucherTypeId: string) => {
        const allowed = new Set(
            materials
                .filter((material) =>
                    material.voucher_types?.some(
                        (voucherType) =>
                            String(voucherType.id) === voucherTypeId,
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
                    confirmed: false,
                };
            }

            return line;
        });
        form.setData((current) => ({
            ...current,
            voucher_type_id: voucherTypeId,
            action_id: '',
            action_indicator_id: '',
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
    const changeDirection = (direction: 'entry' | 'exit') => {
        form.setData((current) => ({
            ...current,
            direction,
            action_id: '',
            action_indicator_id: '',
        }));
    };
    const changeAction = (actionId: string) => {
        const eligibleIndicators = indicators.filter(
            (indicator) => String(indicator.action_id) === actionId,
        );
        form.clearErrors('action_id', 'action_indicator_id');
        form.setData((current) => ({
            ...current,
            action_id: actionId,
            action_indicator_id:
                eligibleIndicators.length === 1
                    ? String(eligibleIndicators[0].id)
                    : '',
        }));
    };
    const focusMaterial = (index: number) => {
        window.setTimeout(
            () => document.getElementById(`item-${index}-material`)?.focus(),
            0,
        );
    };
    const confirmLine = (index: number) => {
        const line = form.data.items[index];

        if (!line || !isCompleteMaterial(line)) {
            const focusId = line?.material_id
                ? `item-${index}-quantity`
                : `item-${index}-material`;
            form.setError(
                'items',
                'Completa el material y la cantidad antes de confirmarlo.',
            );
            window.setTimeout(
                () => document.getElementById(focusId)?.focus(),
                0,
            );

            return;
        }

        const draftIndex = form.data.items.findIndex(
            (candidate, candidateIndex) =>
                candidateIndex !== index &&
                !candidate.confirmed &&
                !candidate.has_applications,
        );
        const nextIndex =
            draftIndex === -1 ? form.data.items.length : draftIndex;

        form.clearErrors('items');
        form.setData('items', [
            ...form.data.items.map((candidate, candidateIndex) =>
                candidateIndex === index
                    ? { ...candidate, confirmed: true }
                    : candidate,
            ),
            ...(draftIndex === -1 ? [blankLine()] : []),
        ]);
        focusMaterial(nextIndex);
    };
    const removeLine = (index: number) => {
        const items = form.data.items.filter((_, i) => i !== index);

        form.setData('items', items.length > 0 ? items : [blankLine()]);
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
        const draftIndex = form.data.items.findIndex(
            (line) => !line.confirmed && hasMaterialValues(line),
        );

        if (draftIndex !== -1) {
            const draft = form.data.items[draftIndex];
            const focusId = isCompleteMaterial(draft)
                ? `item-${draftIndex}-confirm`
                : draft.material_id
                  ? `item-${draftIndex}-quantity`
                  : `item-${draftIndex}-material`;
            form.setError(
                'items',
                isCompleteMaterial(draft)
                    ? 'Confirma el material pendiente antes de guardar.'
                    : 'Completa y confirma el material pendiente antes de guardar.',
            );
            window.setTimeout(
                () => document.getElementById(focusId)?.focus(),
                0,
            );

            return;
        }

        if (confirmedMaterialCount === 0) {
            form.setError(
                'items',
                'Agrega y confirma al menos un material antes de guardar.',
            );
            focusMaterial(0);

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
                })),
        }));
        const options = {
            forceFormData: true,
            preserveScroll: true,
            onSuccess,
        };

        if (voucher) {
            form.put(`/vouchers/${voucher.id}`, options);
        } else {
            form.post('/vouchers', options);
        }
    };

    return (
        <>
            {!embedded && (
                <Head
                    title={
                        voucher ? `Editar vale ${voucher.folio}` : 'Nuevo vale'
                    }
                />
            )}
            <form
                ref={formElement}
                onSubmit={submit}
                className={
                    embedded
                        ? 'flex w-full flex-col gap-6 px-1 py-1'
                        : 'mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 px-4 py-6 min-[1200px]:px-8 md:px-6'
                }
            >
                <PageHeader
                    title={voucher ? 'Editar vale' : 'Capturar vale'}
                    description={
                        voucher
                            ? 'Corrige los datos del documento original sin alterar su historial.'
                            : 'Registra el documento original y todos los materiales entregados.'
                    }
                    actions={
                        <>
                            {!embedded && (
                                <Button variant="ghost" asChild>
                                    <Link
                                        href={
                                            voucher
                                                ? `/vouchers/${voucher.id}`
                                                : '/vouchers'
                                        }
                                    >
                                        <ArrowLeft data-icon="inline-start" />
                                        Volver
                                    </Link>
                                </Button>
                            )}
                            <Button
                                disabled={
                                    form.processing ||
                                    missingDeliverers ||
                                    missingAuthorizers
                                }
                                aria-busy={form.processing}
                            >
                                <Save data-icon="inline-start" />
                                {form.processing
                                    ? 'Guardando…'
                                    : 'Guardar vale'}
                            </Button>
                        </>
                    }
                />
                {missingDeliverers && (
                    <Alert variant="warning">
                        <AlertDescription>
                            <p className="font-medium text-foreground">
                                Falta configurar quién entrega el material.
                            </p>
                            <p>
                                Habilita al menos una persona con la función
                                “Entrega material” antes de capturar un vale.{' '}
                                <Link
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    href="/catalogs"
                                >
                                    Ir a Catálogos
                                </Link>
                            </p>
                        </AlertDescription>
                    </Alert>
                )}
                {missingAuthorizers && (
                    <Alert variant="warning">
                        <AlertDescription>
                            <p className="font-medium text-foreground">
                                Falta configurar quién autoriza el material.
                            </p>
                            <p>
                                Habilita al menos una persona con la función
                                “Autoriza material” antes de guardar el vale.{' '}
                                <Link
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    href="/catalogs"
                                >
                                    Ir a Catálogos
                                </Link>
                            </p>
                        </AlertDescription>
                    </Alert>
                )}
                <Card className="gap-0 overflow-hidden border-border/85 py-0">
                    <CardHeader className="border-b border-border/75 bg-surface-subtle/45 pt-6 pb-5">
                        <VoucherSectionHeading
                            step="1"
                            title="Datos del vale"
                            description="Transcribe los datos tal como aparecen en el documento físico."
                        />
                    </CardHeader>
                    <CardContent className="pt-5 pb-6">
                        <FieldGroup className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                            <VoucherField
                                id="voucher-type"
                                label="Tipo de vale"
                                error={form.errors.voucher_type_id}
                            >
                                <SimpleSelect
                                    id="voucher-type"
                                    value={form.data.voucher_type_id}
                                    onValueChange={changeVoucherType}
                                    placeholder="Seleccionar tipo"
                                    options={voucherTypeOptions}
                                    invalid={Boolean(
                                        form.errors.voucher_type_id,
                                    )}
                                    describedBy={errorDescriptionId(
                                        'voucher-type',
                                        form.errors.voucher_type_id,
                                    )}
                                />
                            </VoucherField>
                            <Field invalid={Boolean(form.errors.direction)}>
                                <FieldLabel id="voucher-direction-label">
                                    Movimiento
                                </FieldLabel>
                                <ToggleGroup
                                    id="voucher-direction"
                                    type="single"
                                    variant="outline"
                                    value={form.data.direction}
                                    onValueChange={(value) => {
                                        if (
                                            value === 'entry' ||
                                            value === 'exit'
                                        ) {
                                            changeDirection(value);
                                        }
                                    }}
                                    className="grid w-full grid-cols-2"
                                    aria-labelledby="voucher-direction-label"
                                    aria-describedby={errorDescriptionId(
                                        'voucher-direction',
                                        form.errors.direction,
                                    )}
                                    aria-invalid={
                                        Boolean(form.errors.direction) ||
                                        undefined
                                    }
                                >
                                    <ToggleGroupItem
                                        value="exit"
                                        aria-invalid={
                                            Boolean(form.errors.direction) ||
                                            undefined
                                        }
                                        aria-describedby={errorDescriptionId(
                                            'voucher-direction',
                                            form.errors.direction,
                                        )}
                                    >
                                        Salida
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="entry"
                                        aria-invalid={
                                            Boolean(form.errors.direction) ||
                                            undefined
                                        }
                                        aria-describedby={errorDescriptionId(
                                            'voucher-direction',
                                            form.errors.direction,
                                        )}
                                    >
                                        Entrada
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                <FieldError id="voucher-direction-error">
                                    {form.errors.direction}
                                </FieldError>
                            </Field>
                            <VoucherField
                                id="voucher-folio"
                                label="Folio"
                                error={form.errors.folio}
                            >
                                <Input
                                    id="voucher-folio"
                                    value={form.data.folio}
                                    onChange={(e) =>
                                        form.setData('folio', e.target.value)
                                    }
                                    placeholder="Ej. 16576"
                                    aria-invalid={
                                        Boolean(form.errors.folio) || undefined
                                    }
                                    aria-describedby={errorDescriptionId(
                                        'voucher-folio',
                                        form.errors.folio,
                                    )}
                                />
                            </VoucherField>
                            <VoucherField
                                id="voucher-date"
                                label="Fecha"
                                error={form.errors.issued_on}
                            >
                                <Input
                                    id="voucher-date"
                                    type="date"
                                    value={form.data.issued_on}
                                    onChange={(e) =>
                                        form.setData(
                                            'issued_on',
                                            e.target.value,
                                        )
                                    }
                                    aria-invalid={
                                        Boolean(form.errors.issued_on) ||
                                        undefined
                                    }
                                    aria-describedby={errorDescriptionId(
                                        'voucher-date',
                                        form.errors.issued_on,
                                    )}
                                />
                            </VoucherField>
                            {usesClassification && (
                                <>
                                    <VoucherField
                                        id="voucher-program"
                                        label="Programa"
                                    >
                                        <div
                                            id="voucher-program"
                                            className="flex min-h-11 items-center rounded-md border border-input bg-muted/40 px-3 text-sm"
                                        >
                                            <span className="font-mono font-semibold">
                                                {fixedProgram?.code ?? 'SPM-06'}
                                            </span>
                                            <span className="mx-2 text-muted-foreground">
                                                ·
                                            </span>
                                            <span>
                                                {fixedProgram?.name ??
                                                    'Alumbrado público'}
                                            </span>
                                        </div>
                                    </VoucherField>
                                    <VoucherField
                                        id="voucher-action"
                                        label="Acción"
                                        error={form.errors.action_id}
                                    >
                                        <SearchableSelect
                                            id="voucher-action"
                                            value={form.data.action_id}
                                            onValueChange={changeAction}
                                            options={actionOptions}
                                            optionLayout="code-description"
                                            placeholder="Seleccionar acción"
                                            searchPlaceholder="Buscar acción…"
                                            emptyMessage="No se encontró la acción."
                                            invalid={Boolean(
                                                form.errors.action_id,
                                            )}
                                            describedBy={errorDescriptionId(
                                                'voucher-action',
                                                form.errors.action_id,
                                            )}
                                        />
                                    </VoucherField>
                                    {selectedIndicators.length > 1 && (
                                        <VoucherField
                                            id="voucher-indicator"
                                            label="Indicador"
                                            error={
                                                form.errors.action_indicator_id
                                            }
                                        >
                                            <SearchableSelect
                                                id="voucher-indicator"
                                                value={
                                                    form.data
                                                        .action_indicator_id
                                                }
                                                onValueChange={(value) =>
                                                    form.setData(
                                                        'action_indicator_id',
                                                        value,
                                                    )
                                                }
                                                options={indicatorOptions}
                                                optionLayout="code-description"
                                                placeholder="Seleccionar indicador"
                                                searchPlaceholder="Buscar indicador…"
                                                emptyMessage="No se encontró el indicador."
                                                invalid={Boolean(
                                                    form.errors
                                                        .action_indicator_id,
                                                )}
                                                describedBy={errorDescriptionId(
                                                    'voucher-indicator',
                                                    form.errors
                                                        .action_indicator_id,
                                                )}
                                            />
                                        </VoucherField>
                                    )}
                                </>
                            )}
                            <VoucherField
                                id="voucher-receiver"
                                label="Recibió"
                                error={form.errors.received_by_id}
                            >
                                <SearchableSelect
                                    id="voucher-receiver"
                                    value={form.data.received_by_id}
                                    onValueChange={(v) =>
                                        form.setData('received_by_id', v)
                                    }
                                    placeholder="Seleccionar persona"
                                    searchPlaceholder="Buscar por nombre…"
                                    emptyMessage="No encontramos a esa persona."
                                    options={receiverOptions}
                                    invalid={Boolean(
                                        form.errors.received_by_id,
                                    )}
                                    describedBy={errorDescriptionId(
                                        'voucher-receiver',
                                        form.errors.received_by_id,
                                    )}
                                />
                            </VoucherField>
                            <VoucherField
                                id="voucher-deliverer"
                                label="Entregó material"
                                error={form.errors.delivered_by_id}
                            >
                                <SearchableSelect
                                    id="voucher-deliverer"
                                    value={form.data.delivered_by_id}
                                    onValueChange={(v) =>
                                        form.setData('delivered_by_id', v)
                                    }
                                    placeholder="Seleccionar persona"
                                    searchPlaceholder="Buscar por nombre…"
                                    emptyMessage="No encontramos a esa persona."
                                    options={delivererOptions}
                                    disabled={missingDeliverers}
                                    invalid={Boolean(
                                        form.errors.delivered_by_id,
                                    )}
                                    describedBy={errorDescriptionId(
                                        'voucher-deliverer',
                                        form.errors.delivered_by_id,
                                    )}
                                />
                            </VoucherField>
                            {authorizers.length > 1 && (
                                <VoucherField
                                    id="voucher-authorizer"
                                    label="Autorizó"
                                    error={form.errors.authorized_by_id}
                                >
                                    <SearchableSelect
                                        id="voucher-authorizer"
                                        value={form.data.authorized_by_id}
                                        onValueChange={(v) =>
                                            form.setData('authorized_by_id', v)
                                        }
                                        placeholder="Seleccionar persona"
                                        searchPlaceholder="Buscar por nombre…"
                                        emptyMessage="No encontramos a esa persona."
                                        options={authorizerOptions}
                                        invalid={Boolean(
                                            form.errors.authorized_by_id,
                                        )}
                                        describedBy={errorDescriptionId(
                                            'voucher-authorizer',
                                            form.errors.authorized_by_id,
                                        )}
                                    />
                                </VoucherField>
                            )}
                            <div
                                data-invalid={
                                    Boolean(destinationError) || undefined
                                }
                                className="rounded-xl border border-border/75 bg-surface-subtle/35 p-4 transition-[background-color,border-color] data-[invalid=true]:border-danger/50 data-[invalid=true]:bg-danger-subtle/10 md:col-span-2 md:p-5 xl:col-span-4"
                            >
                                <VoucherField
                                    id="voucher-destination"
                                    label={destinationLabel}
                                    error={destinationError}
                                >
                                    <VoucherDestinationPicker
                                        id="voucher-destination"
                                        destinations={destinations}
                                        selectedIds={form.data.destination_ids}
                                        newDestinations={
                                            form.data.new_destinations
                                        }
                                        onSelectedIdsChange={(ids) => {
                                            clearDestinationErrors();
                                            form.setData(
                                                'destination_ids',
                                                ids,
                                            );
                                        }}
                                        onNewDestinationsChange={(names) => {
                                            clearDestinationErrors();
                                            form.setData(
                                                'new_destinations',
                                                names,
                                            );
                                        }}
                                        invalid={Boolean(destinationError)}
                                        describedBy={errorDescriptionId(
                                            'voucher-destination',
                                            destinationError,
                                        )}
                                    />
                                </VoucherField>
                                <label
                                    data-invalid={
                                        Boolean(destinationError) || undefined
                                    }
                                    className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-dashed px-4 py-3 transition-[background-color,border-color] hover:bg-muted/30 data-[invalid=true]:border-danger/35 data-[invalid=true]:bg-danger-subtle/15"
                                >
                                    <Checkbox
                                        checked={showUsageDescription}
                                        onCheckedChange={(checked) => {
                                            const enabled = checked === true;
                                            setShowUsageDescription(enabled);

                                            if (!enabled) {
                                                form.setData(
                                                    'usage_description',
                                                    '',
                                                );
                                            }
                                        }}
                                        className="mt-0.5"
                                    />
                                    <span>
                                        <span className="block text-sm font-medium">
                                            Agregar descripción de uso o
                                            actividad
                                        </span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                            Úsala para trabajos, actualizaciones
                                            o destinos que no sean una
                                            ubicación.
                                        </span>
                                    </span>
                                </label>
                                {showUsageDescription && (
                                    <div className="mt-3">
                                        <VoucherField
                                            id="voucher-usage-description"
                                            label={
                                                form.data.direction === 'entry'
                                                    ? 'Concepto de la entrada'
                                                    : 'Uso o actividad'
                                            }
                                            error={
                                                form.errors.usage_description
                                            }
                                        >
                                            <Textarea
                                                id="voucher-usage-description"
                                                value={
                                                    form.data.usage_description
                                                }
                                                onChange={(event) => {
                                                    if (
                                                        event.target.value.trim()
                                                    ) {
                                                        clearDestinationErrors();
                                                    }

                                                    form.setData(
                                                        'usage_description',
                                                        event.target.value,
                                                    );
                                                }}
                                                placeholder="Describe el trabajo, actualización o uso del material"
                                                aria-invalid={
                                                    Boolean(
                                                        form.errors
                                                            .usage_description,
                                                    ) || undefined
                                                }
                                                aria-describedby={errorDescriptionId(
                                                    'voucher-usage-description',
                                                    form.errors
                                                        .usage_description,
                                                )}
                                            />
                                        </VoucherField>
                                    </div>
                                )}
                            </div>
                        </FieldGroup>
                    </CardContent>
                </Card>
                <Card className="gap-0 overflow-hidden border-success/25 py-0">
                    <CardHeader className="border-b border-success/20 bg-success-subtle/30 pt-6 pb-5">
                        <VoucherSectionHeading
                            step="2"
                            title={`Material ${
                                form.data.direction === 'entry'
                                    ? 'recibido'
                                    : 'entregado'
                            }`}
                            description="Cada material usa su unidad canónica. Completa sus datos y confírmalo antes de agregar el siguiente."
                        >
                            <Badge
                                variant={
                                    confirmedMaterialCount > 0
                                        ? 'success'
                                        : 'secondary'
                                }
                                className="tabular-nums"
                            >
                                {confirmedMaterialCount}{' '}
                                {confirmedMaterialCount === 1
                                    ? 'material agregado'
                                    : 'materiales agregados'}
                            </Badge>
                        </VoucherSectionHeading>
                    </CardHeader>
                    <CardContent className="pt-5 pb-6">
                        <FieldGroup className="gap-5">
                            {duplicateMaterials.length > 0 && (
                                <Alert variant="warning">
                                    <AlertDescription>
                                        Hay materiales repetidos. Puedes
                                        conservar renglones separados o sumar
                                        sus cantidades.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {form.data.items.map((line, index) => {
                                const hasApplications = Boolean(
                                    line.has_applications,
                                );
                                const isConfirmed = line.confirmed;
                                const materialFieldError =
                                    form.errors[
                                        `items.${index}.material_id` as keyof typeof form.errors
                                    ];
                                const itemError = Object.entries(
                                    form.errors,
                                ).find(([field]) =>
                                    field.startsWith(`items.${index}.`),
                                )?.[1];
                                const materialError =
                                    materialFieldError ?? itemError;
                                const quantityError =
                                    form.errors[
                                        `items.${index}.quantity` as keyof typeof form.errors
                                    ];
                                const unit = materials.find(
                                    (material) =>
                                        String(material.id) ===
                                        line.material_id,
                                )?.default_unit;
                                const materialId = `item-${index}-material`;
                                const quantityId = `item-${index}-quantity`;

                                return (
                                    <fieldset
                                        key={line.client_id}
                                        data-confirmed={
                                            isConfirmed || undefined
                                        }
                                        className="grid min-w-0 items-start gap-4 rounded-xl border border-border/80 bg-surface-subtle/55 p-4 transition-[background-color,border-color] data-[confirmed=true]:border-success/35 data-[confirmed=true]:bg-success-subtle/45 min-[900px]:!grid-cols-[minmax(260px,1fr)_minmax(190px,220px)_190px] sm:grid-cols-2"
                                    >
                                        <legend className="sr-only">
                                            Material {index + 1}
                                        </legend>
                                        <VoucherField
                                            id={materialId}
                                            label={
                                                <span className="flex items-center gap-2">
                                                    <span>
                                                        Material {index + 1}
                                                    </span>
                                                    {isConfirmed && (
                                                        <Badge
                                                            variant="success"
                                                            className="min-h-5 px-2 text-[11px]"
                                                        >
                                                            Agregado
                                                        </Badge>
                                                    )}
                                                </span>
                                            }
                                            error={materialError}
                                            className="min-[900px]:!col-span-1 sm:col-span-2"
                                        >
                                            <SearchableSelect
                                                id={materialId}
                                                value={line.material_id}
                                                onValueChange={(materialId) =>
                                                    selectMaterial(
                                                        index,
                                                        materialId,
                                                    )
                                                }
                                                placeholder="Seleccionar material"
                                                searchPlaceholder="Buscar material…"
                                                emptyMessage="No encontramos ese material."
                                                options={materialOptions}
                                                disabled={hasApplications}
                                                invalid={Boolean(materialError)}
                                                describedBy={errorDescriptionId(
                                                    materialId,
                                                    materialError,
                                                )}
                                            />
                                        </VoucherField>
                                        <VoucherField
                                            id={quantityId}
                                            label={
                                                <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                                    <span>Cantidad</span>
                                                    {unit && (
                                                        <span className="text-xs font-medium text-muted-foreground">
                                                            Unidad: {unit.name}{' '}
                                                            ({unit.symbol})
                                                        </span>
                                                    )}
                                                </span>
                                            }
                                            error={quantityError}
                                        >
                                            <Input
                                                id={quantityId}
                                                inputMode="decimal"
                                                value={line.quantity}
                                                readOnly={hasApplications}
                                                onChange={(e) =>
                                                    changeLine(index, {
                                                        quantity:
                                                            e.target.value,
                                                    })
                                                }
                                                placeholder="0"
                                                aria-invalid={
                                                    Boolean(quantityError) ||
                                                    undefined
                                                }
                                                aria-describedby={errorDescriptionId(
                                                    quantityId,
                                                    quantityError,
                                                )}
                                            />
                                        </VoucherField>
                                        {isConfirmed ? (
                                            <MaterialLineAction>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={hasApplications}
                                                    onClick={() =>
                                                        removeLine(index)
                                                    }
                                                    aria-label={`Eliminar material ${index + 1}`}
                                                    className="w-full border-danger/35 text-destructive hover:border-danger/55 hover:bg-danger-subtle hover:text-destructive"
                                                >
                                                    <Trash2
                                                        data-icon="inline-start"
                                                        aria-hidden="true"
                                                    />
                                                    Eliminar material
                                                </Button>
                                            </MaterialLineAction>
                                        ) : isCompleteMaterial(line) ? (
                                            <MaterialLineAction>
                                                <Button
                                                    id={`item-${index}-confirm`}
                                                    type="button"
                                                    variant="success"
                                                    onClick={() =>
                                                        confirmLine(index)
                                                    }
                                                    aria-label={`Confirmar material ${index + 1}`}
                                                    aria-describedby={
                                                        form.errors.items
                                                            ? 'voucher-items-error'
                                                            : undefined
                                                    }
                                                    className="w-full"
                                                >
                                                    <Check
                                                        data-icon="inline-start"
                                                        aria-hidden="true"
                                                    />
                                                    Confirmar material
                                                </Button>
                                            </MaterialLineAction>
                                        ) : (
                                            <MaterialLineAction>
                                                <div
                                                    role="status"
                                                    aria-live="polite"
                                                    className="flex min-h-10 w-full items-center rounded-lg border border-dashed border-border-strong/70 bg-surface-raised/60 px-3 text-xs leading-5 font-medium text-muted-foreground max-sm:min-h-11"
                                                >
                                                    Completa material y cantidad
                                                </div>
                                            </MaterialLineAction>
                                        )}
                                        {hasApplications && (
                                            <p className="text-sm text-muted-foreground min-[900px]:!col-span-3 sm:col-span-2">
                                                Este material ya tiene
                                                aplicaciones registradas. Anula
                                                primero sus aplicaciones para
                                                cambiarlo.
                                            </p>
                                        )}
                                    </fieldset>
                                );
                            })}
                            <InputError
                                id="voucher-items-error"
                                message={form.errors.items}
                            />
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <PackageSearch
                                    className="mt-0.5 size-4 shrink-0"
                                    aria-hidden="true"
                                />
                                <p>
                                    ¿No aparece un material?{' '}
                                    <Link
                                        className="font-medium text-primary underline-offset-4 hover:underline"
                                        href="/catalogs"
                                    >
                                        Agrégalo primero al catálogo.
                                    </Link>
                                </p>
                            </div>
                        </FieldGroup>
                    </CardContent>
                </Card>
                <Card className="gap-0 overflow-hidden border-border/85 py-0">
                    <CardHeader className="border-b border-border/75 bg-surface-subtle/45 pt-6 pb-5">
                        <VoucherSectionHeading
                            step="3"
                            title="Respaldo y observaciones"
                            description="Adjunta evidencia del documento y conserva cualquier aclaración útil para su consulta."
                        />
                    </CardHeader>
                    <CardContent className="pt-5 pb-6">
                        <FieldGroup className="grid gap-6 md:grid-cols-2">
                            <VoucherField
                                id="voucher-attachments"
                                label="Foto o PDF del vale (opcional)"
                                error={form.errors.attachments}
                                description="Hasta 5 archivos de 10 MB cada uno."
                            >
                                <Input
                                    id="voucher-attachments"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                    multiple
                                    onChange={(e) =>
                                        form.setData(
                                            'attachments',
                                            Array.from(e.target.files ?? []),
                                        )
                                    }
                                    aria-invalid={
                                        Boolean(form.errors.attachments) ||
                                        undefined
                                    }
                                    aria-describedby={fieldDescriptionIds(
                                        'voucher-attachments',
                                        form.errors.attachments,
                                        true,
                                    )}
                                />
                            </VoucherField>
                            <VoucherField
                                id="voucher-notes"
                                label="Observaciones"
                                error={form.errors.notes}
                            >
                                <Textarea
                                    id="voucher-notes"
                                    value={form.data.notes}
                                    onChange={(e) =>
                                        form.setData('notes', e.target.value)
                                    }
                                    placeholder="Aclaraciones del vale, correcciones visibles o contexto adicional"
                                    aria-invalid={
                                        Boolean(form.errors.notes) || undefined
                                    }
                                    aria-describedby={errorDescriptionId(
                                        'voucher-notes',
                                        form.errors.notes,
                                    )}
                                />
                            </VoucherField>
                            {voucher && voucher.attachments.length > 0 && (
                                <div className="md:col-span-2">
                                    <p className="mb-2 text-sm font-medium">
                                        Archivos existentes
                                    </p>
                                    {voucher.attachments.map((file) => (
                                        <a
                                            key={file.id}
                                            className="mr-3 inline-flex items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
                                            href={`/attachments/${file.id}`}
                                        >
                                            <FileText
                                                className="mr-1 size-4"
                                                aria-hidden="true"
                                            />
                                            {file.original_name}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </FieldGroup>
                    </CardContent>
                </Card>
            </form>
        </>
    );
}

function VoucherSectionHeading({
    step,
    title,
    description,
    children,
}: {
    step: string;
    title: string;
    description: string;
    children?: ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground tabular-nums shadow-[var(--shadow-control)]"
            >
                {step}
            </span>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-[17px] tracking-[-0.015em]">
                        {title}
                    </CardTitle>
                    {children}
                </div>
                <CardDescription className="mt-1 max-w-3xl leading-6">
                    {description}
                </CardDescription>
            </div>
        </div>
    );
}

function MaterialLineAction({ children }: { children: ReactNode }) {
    return (
        <div className="flex w-full flex-col gap-2">
            <span aria-hidden="true" className="h-5" />
            {children}
        </div>
    );
}

function VoucherField({
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
    children: ReactNode;
}) {
    return (
        <Field invalid={Boolean(error)} className={className}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {children}
            {description && (
                <FieldDescription id={`${id}-description`}>
                    {description}
                </FieldDescription>
            )}
            <FieldError id={`${id}-error`}>{error}</FieldError>
        </Field>
    );
}

function peopleOptions(people: Named[]): ChoiceOption[] {
    return people.map((person) => ({
        value: String(person.id),
        label: person.name,
    }));
}

function errorDescriptionId(id: string, error?: string) {
    return error ? `${id}-error` : undefined;
}

function hasMaterialValues(line: Line) {
    return Boolean(line.material_id || line.quantity.trim());
}

function isCompleteMaterial(line: Line) {
    const quantity = Number(line.quantity);

    return (
        line.material_id !== '' &&
        line.quantity.trim() !== '' &&
        Number.isFinite(quantity) &&
        quantity > 0
    );
}

function fieldDescriptionIds(
    id: string,
    error: string | undefined,
    hasDescription: boolean,
) {
    return (
        [
            hasDescription ? `${id}-description` : undefined,
            error ? `${id}-error` : undefined,
        ]
            .filter(Boolean)
            .join(' ') || undefined
    );
}
