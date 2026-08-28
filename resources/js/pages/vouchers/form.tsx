import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ClipboardCheck,
    FileText,
    PackageSearch,
    Plus,
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
    ChoiceOption,
    Destination,
    Material,
    Named,
    Program,
    Unit,
    Voucher,
    VoucherType,
} from '@/types';

type Line = {
    id?: number;
    material_id: string;
    unit_id: string;
    quantity: string;
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
    program_id: string;
    action_id: string;
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
    units: Unit[];
    receivers: Named[];
    deliverers: Named[];
    voucherTypes: VoucherType[];
    authorizers: Named[];
    programs: Program[];
    actions: Action[];
    destinations: Destination[];
    embedded?: boolean;
    onSuccess?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
};

const blankLine = (): Line => ({
    material_id: '',
    unit_id: '',
    quantity: '',
});

export default function VoucherForm({
    voucher,
    materials,
    units,
    receivers,
    deliverers,
    voucherTypes,
    authorizers,
    programs,
    actions,
    destinations,
    embedded = false,
    onSuccess,
    onDirtyChange,
}: VoucherFormProps) {
    const formElement = useRef<HTMLFormElement>(null);
    const [unitOverrides, setUnitOverrides] = useState<boolean[]>(
        () => voucher?.items.map(() => false) ?? [false],
    );
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
    const unitById = useMemo(
        () => new Map(units.map((unit) => [unit.id, unit])),
        [units],
    );
    const unitOptions = useMemo<ChoiceOption[]>(
        () =>
            units.map((unit) => ({
                value: String(unit.id),
                label: `${unit.name} (${unit.symbol})`,
                searchTerms: [unit.symbol],
            })),
        [units],
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
    const initialUsesProgramAndAction =
        voucherTypes.find(
            (voucherType) => String(voucherType.id) === initialVoucherTypeId,
        )?.code === 'warehouse';
    const defaultProgramId = initialUsesProgramAndAction
        ? voucher?.program
            ? String(voucher.program.id)
            : programs.length === 1
              ? String(programs[0].id)
              : ''
        : '';
    const eligibleDefaultActions = actions.filter(
        (action) => String(action.program_id) === defaultProgramId,
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
        program_id: defaultProgramId,
        action_id: initialUsesProgramAndAction
            ? voucher?.action
                ? String(voucher.action.id)
                : eligibleDefaultActions.length === 1
                  ? String(eligibleDefaultActions[0].id)
                  : ''
            : '',
        destination_ids:
            voucher?.destinations.map((destination) =>
                String(destination.id),
            ) ?? [],
        new_destinations: [],
        usage_description: voucher?.usage_description ?? '',
        notes: voucher?.notes ?? '',
        items: voucher?.items.map((item) => ({
            id: item.id,
            material_id: String(item.material.id),
            unit_id: String(item.unit.id),
            quantity: item.quantity,
        })) ?? [blankLine()],
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
                .map((material) => {
                    const unit = unitById.get(material.default_unit_id);

                    return {
                        value: String(material.id),
                        label: material.name,
                        meta: unit?.symbol ?? 's/e',
                        searchTerms: unit ? [unit.name, unit.symbol] : [],
                    };
                }),
        [form.data.voucher_type_id, materials, unitById],
    );
    const programOptions = useMemo<ChoiceOption[]>(
        () =>
            programs.map((program) => ({
                value: String(program.id),
                label: program.code,
                meta: program.name ?? undefined,
                searchTerms: program.name ? [program.name] : [],
            })),
        [programs],
    );
    const actionOptions = useMemo<ChoiceOption[]>(
        () =>
            actions
                .filter(
                    (action) =>
                        String(action.program_id) === form.data.program_id,
                )
                .map((action) => ({
                    value: String(action.id),
                    label: action.code,
                    meta: action.name ?? undefined,
                    searchTerms: action.name ? [action.name] : [],
                })),
        [actions, form.data.program_id],
    );
    const usesProgramAndAction =
        voucherTypes.find(
            (voucherType) =>
                String(voucherType.id) === form.data.voucher_type_id,
        )?.code === 'warehouse';
    const errorSignature = Object.keys(form.errors).sort().join('|');

    useEffect(() => {
        onDirtyChange?.(form.isDirty);
    }, [form.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!errorSignature) {
            return;
        }

        const frame = window.requestAnimationFrame(() => {
            const target =
                formElement.current?.querySelector<HTMLElement>(
                    '[aria-invalid="true"]',
                ) ??
                formElement.current?.querySelector<HTMLElement>(
                    '[data-error-summary]',
                );

            target?.focus();
        });

        return () => window.cancelAnimationFrame(frame);
    }, [errorSignature]);
    const missingDeliverers = deliverers.length === 0;
    const missingAuthorizers = authorizers.length === 0;
    const duplicateMaterials = form.data.items
        .map((line) => line.material_id)
        .filter(Boolean)
        .filter((id, index, array) => array.indexOf(id) !== index);
    const changeLine = (index: number, values: Partial<Line>) =>
        form.setData(
            'items',
            form.data.items.map((line, i) =>
                i === index ? { ...line, ...values } : line,
            ),
        );
    const selectMaterial = (index: number, materialId: string) => {
        const material = materials.find((m) => String(m.id) === materialId);
        changeLine(index, {
            material_id: materialId,
            unit_id: material ? String(material.default_unit_id) : '',
        });
        setUnitOverrides((current) =>
            current.map((enabled, i) => (i === index ? false : enabled)),
        );
        window.setTimeout(
            () => document.getElementById(`item-${index}-quantity`)?.focus(),
            0,
        );
    };
    const changeVoucherType = (voucherTypeId: string) => {
        const usesClassification =
            voucherTypes.find(
                (voucherType) => String(voucherType.id) === voucherTypeId,
            )?.code === 'warehouse';
        const programId = usesClassification
            ? programs.length === 1
                ? String(programs[0].id)
                : ''
            : '';
        const eligibleActions = actions.filter(
            (action) => String(action.program_id) === programId,
        );
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

                return { ...line, material_id: '', unit_id: '', quantity: '' };
            }

            return line;
        });
        form.setData((current) => ({
            ...current,
            voucher_type_id: voucherTypeId,
            program_id: programId,
            action_id:
                usesClassification && eligibleActions.length === 1
                    ? String(eligibleActions[0].id)
                    : '',
            items,
        }));

        if (removed > 0) {
            setUnitOverrides((current) => current.map(() => false));
            toast.info(
                removed === 1
                    ? 'Se limpió un material que no pertenece al nuevo tipo de vale.'
                    : `Se limpiaron ${removed} materiales que no pertenecen al nuevo tipo de vale.`,
            );
        }
    };
    const addLine = () => {
        const nextIndex = form.data.items.length;
        form.setData('items', [...form.data.items, blankLine()]);
        setUnitOverrides((current) => [...current, false]);
        window.setTimeout(
            () =>
                document.getElementById(`item-${nextIndex}-material`)?.focus(),
            0,
        );
    };
    const removeLine = (index: number) => {
        form.setData(
            'items',
            form.data.items.filter((_, i) => i !== index),
        );
        setUnitOverrides((current) => current.filter((_, i) => i !== index));
    };
    const submit = (event: FormEvent) => {
        event.preventDefault();
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
                        : 'mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-6 min-[1200px]:px-8 md:px-6'
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
                {form.data.direction === 'exit' && (
                    <Alert variant="info">
                        <ClipboardCheck aria-hidden="true" />
                        <AlertDescription>
                            <p className="font-medium text-foreground">
                                Este formulario registra el vale original.
                            </p>
                            <p>
                                Captura el vale → registra el material utilizado
                                desde la lista o el detalle → consulta el saldo
                                pendiente actualizado.
                            </p>
                            {voucher && (
                                <Link
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    href={`/vouchers/${voucher.id}`}
                                >
                                    Ir al detalle del vale
                                </Link>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
                {Object.keys(form.errors).length > 0 && (
                    <Alert
                        variant="destructive"
                        aria-live="polite"
                        tabIndex={-1}
                        data-error-summary
                    >
                        <AlertDescription>
                            Revisa los campos marcados antes de guardar.
                        </AlertDescription>
                    </Alert>
                )}
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
                <Card>
                    <CardHeader>
                        <CardTitle>1. Datos del vale</CardTitle>
                        <CardDescription>
                            Transcribe los datos tal como aparecen en el
                            documento físico.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                                    type="single"
                                    variant="outline"
                                    value={form.data.direction}
                                    onValueChange={(value) => {
                                        if (
                                            value === 'entry' ||
                                            value === 'exit'
                                        ) {
                                            form.setData('direction', value);
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
                            {usesProgramAndAction && (
                                <>
                                    <VoucherField
                                        id="voucher-program"
                                        label="Programa (opcional)"
                                        error={form.errors.program_id}
                                    >
                                        <SearchableSelect
                                            id="voucher-program"
                                            value={form.data.program_id}
                                            onValueChange={(value) => {
                                                form.setData((current) => ({
                                                    ...current,
                                                    program_id: value,
                                                    action_id: '',
                                                }));
                                            }}
                                            options={programOptions}
                                            placeholder="Sin programa"
                                            emptyLabel="Sin programa"
                                            searchPlaceholder="Buscar programa…"
                                            emptyMessage="No se encontró el programa."
                                            invalid={Boolean(
                                                form.errors.program_id,
                                            )}
                                            describedBy={errorDescriptionId(
                                                'voucher-program',
                                                form.errors.program_id,
                                            )}
                                        />
                                    </VoucherField>
                                    <VoucherField
                                        id="voucher-action"
                                        label="Acción (opcional)"
                                        error={form.errors.action_id}
                                    >
                                        <SearchableSelect
                                            id="voucher-action"
                                            value={form.data.action_id}
                                            onValueChange={(value) =>
                                                form.setData('action_id', value)
                                            }
                                            options={actionOptions}
                                            placeholder={
                                                form.data.program_id
                                                    ? 'Sin acción'
                                                    : 'Selecciona un programa'
                                            }
                                            emptyLabel="Sin acción"
                                            searchPlaceholder="Buscar acción…"
                                            emptyMessage="No se encontró la acción."
                                            disabled={!form.data.program_id}
                                            invalid={Boolean(
                                                form.errors.action_id,
                                            )}
                                            describedBy={errorDescriptionId(
                                                'voucher-action',
                                                form.errors.action_id,
                                            )}
                                        />
                                    </VoucherField>
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
                            <div className="md:col-span-2 xl:col-span-4">
                                <VoucherField
                                    id="voucher-destination"
                                    label={
                                        form.data.direction === 'entry'
                                            ? 'Origen o ubicación'
                                            : 'Ubicación del destino'
                                    }
                                    error={
                                        form.errors.destination_ids ??
                                        form.errors.new_destinations
                                    }
                                >
                                    <VoucherDestinationPicker
                                        id="voucher-destination"
                                        destinations={destinations}
                                        selectedIds={form.data.destination_ids}
                                        newDestinations={
                                            form.data.new_destinations
                                        }
                                        onSelectedIdsChange={(ids) =>
                                            form.setData('destination_ids', ids)
                                        }
                                        onNewDestinationsChange={(names) =>
                                            form.setData(
                                                'new_destinations',
                                                names,
                                            )
                                        }
                                        invalid={Boolean(
                                            form.errors.destination_ids ??
                                            form.errors.new_destinations,
                                        )}
                                        describedBy={errorDescriptionId(
                                            'voucher-destination',
                                            form.errors.destination_ids ??
                                                form.errors.new_destinations,
                                        )}
                                    />
                                </VoucherField>
                                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors hover:bg-muted/30">
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
                                                onChange={(event) =>
                                                    form.setData(
                                                        'usage_description',
                                                        event.target.value,
                                                    )
                                                }
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
                <Card>
                    <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <CardTitle>
                                2. Material{' '}
                                {form.data.direction === 'entry'
                                    ? 'recibido'
                                    : 'entregado'}
                                <Badge variant="secondary" className="ml-2">
                                    {form.data.items.length}{' '}
                                    {form.data.items.length === 1
                                        ? 'partida'
                                        : 'partidas'}
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                La unidad se asigna desde el catálogo y queda
                                guardada con el renglón.
                            </CardDescription>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addLine}
                        >
                            <Plus data-icon="inline-start" />
                            Agregar material
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="gap-4">
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
                                const materialError =
                                    form.errors[
                                        `items.${index}.material_id` as keyof typeof form.errors
                                    ];
                                const unitError =
                                    form.errors[
                                        `items.${index}.unit_id` as keyof typeof form.errors
                                    ];
                                const quantityError =
                                    form.errors[
                                        `items.${index}.quantity` as keyof typeof form.errors
                                    ];
                                const materialId = `item-${index}-material`;
                                const quantityId = `item-${index}-quantity`;

                                return (
                                    <fieldset
                                        key={line.id ?? `new-${index}`}
                                        className="grid min-w-0 items-end gap-4 rounded-lg border bg-surface-subtle/55 p-4 lg:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_210px_170px_auto]"
                                    >
                                        <legend className="sr-only">
                                            Material {index + 1}
                                        </legend>
                                        <VoucherField
                                            id={materialId}
                                            label={`Material ${index + 1}`}
                                            error={materialError}
                                            className="lg:col-span-2 xl:col-span-1"
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
                                                invalid={Boolean(materialError)}
                                                describedBy={errorDescriptionId(
                                                    materialId,
                                                    materialError,
                                                )}
                                            />
                                        </VoucherField>
                                        <UnitField
                                            index={index}
                                            line={line}
                                            materials={materials}
                                            units={units}
                                            unitOptions={unitOptions}
                                            override={
                                                unitOverrides[index] ?? false
                                            }
                                            error={unitError}
                                            onChange={(unitId) =>
                                                changeLine(index, {
                                                    unit_id: unitId,
                                                })
                                            }
                                            onOverrideChange={(enabled) =>
                                                setUnitOverrides((current) =>
                                                    current.map((value, i) =>
                                                        i === index
                                                            ? enabled
                                                            : value,
                                                    ),
                                                )
                                            }
                                        />
                                        <VoucherField
                                            id={quantityId}
                                            label="Cantidad"
                                            error={quantityError}
                                        >
                                            <Input
                                                id={quantityId}
                                                inputMode="decimal"
                                                value={line.quantity}
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
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            disabled={
                                                form.data.items.length === 1
                                            }
                                            onClick={() => removeLine(index)}
                                            className="justify-self-end lg:col-span-2 xl:col-span-1 xl:justify-self-auto"
                                        >
                                            <Trash2 className="text-destructive" />
                                            <span className="sr-only">
                                                Eliminar material {index + 1}
                                            </span>
                                        </Button>
                                    </fieldset>
                                );
                            })}
                            <InputError message={form.errors.items} />
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
                <Card>
                    <CardHeader>
                        <CardTitle>3. Respaldo y observaciones</CardTitle>
                        <CardDescription>
                            Adjunta evidencia del documento y conserva cualquier
                            aclaración útil para su consulta.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup className="grid gap-5 md:grid-cols-2">
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

function UnitField({
    index,
    line,
    materials,
    units,
    unitOptions,
    override,
    error,
    onChange,
    onOverrideChange,
}: {
    index: number;
    line: Line;
    materials: Material[];
    units: Unit[];
    unitOptions: ChoiceOption[];
    override: boolean;
    error?: string;
    onChange: (unitId: string) => void;
    onOverrideChange: (enabled: boolean) => void;
}) {
    const material = materials.find(
        (item) => String(item.id) === line.material_id,
    );
    const currentUnit = units.find((unit) => String(unit.id) === line.unit_id);
    const defaultUnit = units.find(
        (unit) => unit.id === material?.default_unit_id,
    );
    const showSelector =
        Boolean(material) &&
        (override || !currentUnit || currentUnit.symbol === 's/e');
    const fieldId = `item-${index}-unit`;
    const labelId = `${fieldId}-label`;
    let description: string | undefined;

    if (showSelector && defaultUnit?.symbol === 's/e') {
        description =
            'Este material no tiene una unidad habitual. Selecciona la indicada en el vale.';
    } else if (
        showSelector &&
        !override &&
        currentUnit?.symbol === 's/e' &&
        defaultUnit?.symbol !== 's/e'
    ) {
        description =
            'La unidad guardada está sin especificar. Selecciona la indicada en el vale.';
    } else if (showSelector && override && defaultUnit?.symbol !== 's/e') {
        description = 'La excepción sólo se guardará en este vale.';
    }

    return (
        <Field invalid={Boolean(error)} data-disabled={!material || undefined}>
            <div className="flex min-h-4 items-center justify-between gap-2">
                <FieldLabel
                    id={labelId}
                    htmlFor={showSelector ? fieldId : undefined}
                >
                    Unidad
                </FieldLabel>
                {material && !showSelector && currentUnit && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-my-1.5 h-7 px-2 text-xs"
                        onClick={() => onOverrideChange(true)}
                    >
                        Cambiar
                    </Button>
                )}
                {showSelector && override && defaultUnit && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-my-1.5 h-7 px-2 text-xs"
                        onClick={() => {
                            onChange(String(defaultUnit.id));
                            onOverrideChange(false);
                        }}
                    >
                        Usar habitual
                    </Button>
                )}
            </div>
            {showSelector ? (
                <SimpleSelect
                    id={fieldId}
                    value={line.unit_id}
                    onValueChange={onChange}
                    options={unitOptions}
                    placeholder="Seleccionar unidad"
                    invalid={Boolean(error)}
                    describedBy={fieldDescriptionIds(
                        fieldId,
                        error,
                        Boolean(description),
                    )}
                />
            ) : (
                <div
                    className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium text-foreground"
                    aria-labelledby={labelId}
                >
                    {currentUnit
                        ? `${currentUnit.name} (${currentUnit.symbol})`
                        : 'Se asignará al elegir material'}
                </div>
            )}
            {description && (
                <FieldDescription id={`${fieldId}-description`}>
                    {description}
                </FieldDescription>
            )}
            <FieldError id={`${fieldId}-error`}>{error}</FieldError>
        </Field>
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
    label: string;
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
