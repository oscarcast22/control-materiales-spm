import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ClipboardCheck,
    FileText,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
import InputError from '@/components/input-error';
import { PageHeader } from '@/components/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Material, Named, StorageLocation, Unit, Voucher } from '@/types';

type Line = {
    id?: number;
    material_id: string;
    unit_id: string;
    quantity: string;
};
type FormData = {
    storage_location_id: string;
    folio: string;
    direction: 'entry' | 'exit';
    issued_on: string;
    issued_time: string;
    received_by_id: string;
    delivered_by_id: string;
    authorized_by_id: string;
    destination: string;
    notes: string;
    items: Line[];
    attachments: File[];
};
type Props = {
    voucher: Voucher | null;
    materials: Material[];
    units: Unit[];
    receivers: Named[];
    deliverers: Named[];
    locations: StorageLocation[];
    authorizers: Named[];
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
    locations,
    authorizers,
}: Props) {
    const [unitOverrides, setUnitOverrides] = useState<boolean[]>(
        () => voucher?.items.map(() => false) ?? [false],
    );
    const form = useForm<FormData>({
        storage_location_id: voucher
            ? String(voucher.location.id)
            : String(locations[0]?.id ?? ''),
        folio: voucher?.folio ?? '',
        direction: voucher?.direction ?? 'exit',
        issued_on: voucher?.issued_on ?? new Date().toISOString().slice(0, 10),
        issued_time: voucher?.issued_time?.slice(0, 5) ?? '',
        received_by_id: voucher ? String(voucher.received_by.id) : '',
        delivered_by_id: voucher ? String(voucher.delivered_by.id) : '',
        authorized_by_id: voucher
            ? voucher.authorized_by
                ? String(voucher.authorized_by.id)
                : ''
            : authorizers.length === 1
              ? String(authorizers[0].id)
              : '',
        destination: voucher?.destination ?? '',
        notes: voucher?.notes ?? '',
        items: voucher?.items.map((item) => ({
            id: item.id,
            material_id: String(item.material.id),
            unit_id: String(item.unit.id),
            quantity: item.quantity,
        })) ?? [blankLine()],
        attachments: [],
    });
    const missingDeliverers = voucher === null && deliverers.length === 0;
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
    };
    const addLine = () => {
        form.setData('items', [...form.data.items, blankLine()]);
        setUnitOverrides((current) => [...current, false]);
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
        const options = { forceFormData: true, preserveScroll: true };

        if (voucher) {
            form.put(`/vouchers/${voucher.id}`, options);
        } else {
            form.post('/vouchers', options);
        }
    };

    return (
        <>
            <Head
                title={voucher ? `Editar vale ${voucher.folio}` : 'Nuevo vale'}
            />
            <form
                onSubmit={submit}
                className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 py-6 min-[1200px]:px-8 md:px-6"
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
                            <Button
                                disabled={form.processing || missingDeliverers}
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
                    <Alert variant="destructive" aria-live="polite">
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
                <Card>
                    <CardHeader>
                        <CardTitle>Datos del vale</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <Field label="Folio" error={form.errors.folio}>
                            <Input
                                value={form.data.folio}
                                onChange={(e) =>
                                    form.setData('folio', e.target.value)
                                }
                                placeholder="Ej. 16576"
                            />
                        </Field>
                        <Field
                            label="Área de resguardo"
                            error={form.errors.storage_location_id}
                        >
                            <Select
                                value={form.data.storage_location_id}
                                onChange={(v) =>
                                    form.setData('storage_location_id', v)
                                }
                                placeholder="Seleccionar área"
                                options={locations.map((location) => ({
                                    value: String(location.id),
                                    label: location.name,
                                }))}
                            />
                        </Field>
                        <Field label="Movimiento" error={form.errors.direction}>
                            <Select
                                value={form.data.direction}
                                onChange={(v) =>
                                    form.setData(
                                        'direction',
                                        v as 'entry' | 'exit',
                                    )
                                }
                                placeholder="Seleccionar movimiento"
                                options={[
                                    { value: 'exit', label: 'Salida' },
                                    { value: 'entry', label: 'Entrada' },
                                ]}
                            />
                        </Field>
                        <Field label="Fecha" error={form.errors.issued_on}>
                            <Input
                                type="date"
                                value={form.data.issued_on}
                                onChange={(e) =>
                                    form.setData('issued_on', e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Hora (opcional)"
                            error={form.errors.issued_time}
                        >
                            <Input
                                type="time"
                                value={form.data.issued_time}
                                onChange={(e) =>
                                    form.setData('issued_time', e.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Recibió"
                            error={form.errors.received_by_id}
                        >
                            <Select
                                value={form.data.received_by_id}
                                onChange={(v) =>
                                    form.setData('received_by_id', v)
                                }
                                placeholder="Seleccionar persona"
                                options={receivers.map((p) => ({
                                    value: String(p.id),
                                    label: p.name,
                                }))}
                            />
                        </Field>
                        <Field
                            label="Autorizó (opcional)"
                            error={form.errors.authorized_by_id}
                        >
                            <Select
                                value={form.data.authorized_by_id}
                                onChange={(v) =>
                                    form.setData('authorized_by_id', v)
                                }
                                placeholder="Sin autorizar registrado"
                                options={authorizers.map((p) => ({
                                    value: String(p.id),
                                    label: p.name,
                                }))}
                            />
                        </Field>
                        <Field
                            label="Entregó material"
                            error={form.errors.delivered_by_id}
                        >
                            <Select
                                value={form.data.delivered_by_id}
                                onChange={(v) =>
                                    form.setData('delivered_by_id', v)
                                }
                                placeholder="Seleccionar persona"
                                options={deliverers.map((p) => ({
                                    value: String(p.id),
                                    label: p.name,
                                }))}
                            />
                        </Field>
                        <div className="md:col-span-2 xl:col-span-4">
                            <Field
                                label={
                                    form.data.direction === 'entry'
                                        ? 'Origen o concepto de la entrada'
                                        : 'Destino del vale'
                                }
                                error={form.errors.destination}
                            >
                                <Textarea
                                    value={form.data.destination}
                                    onChange={(e) =>
                                        form.setData(
                                            'destination',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="Lugar, poblado o trabajo al que se destina el material"
                                />
                            </Field>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>
                                Material{' '}
                                {form.data.direction === 'entry'
                                    ? 'recibido'
                                    : 'entregado'}
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                La unidad se asigna desde el catálogo y queda
                                guardada con el renglón.
                            </p>
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
                    <CardContent className="flex flex-col gap-3">
                        {duplicateMaterials.length > 0 && (
                            <Alert variant="warning">
                                <AlertDescription>
                                    Hay materiales repetidos. Puedes conservar
                                    renglones separados o sumar sus cantidades.
                                </AlertDescription>
                            </Alert>
                        )}
                        {form.data.items.map((line, index) => (
                            <div
                                key={line.id ?? `new-${index}`}
                                className="grid items-end gap-3 border-t pt-4 first:border-t-0 first:pt-0 md:grid-cols-[minmax(240px,1fr)_210px_180px_auto]"
                            >
                                <Field
                                    label={`Material ${index + 1}`}
                                    error={
                                        form.errors[
                                            `items.${index}.material_id` as keyof typeof form.errors
                                        ]
                                    }
                                >
                                    <NativeSelect
                                        value={line.material_id}
                                        onChange={(e) =>
                                            selectMaterial(
                                                index,
                                                e.target.value,
                                            )
                                        }
                                    >
                                        <option value="">
                                            Seleccionar material
                                        </option>
                                        {materials.map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.name}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </Field>
                                <UnitField
                                    index={index}
                                    line={line}
                                    materials={materials}
                                    units={units}
                                    override={unitOverrides[index] ?? false}
                                    error={
                                        form.errors[
                                            `items.${index}.unit_id` as keyof typeof form.errors
                                        ]
                                    }
                                    onChange={(unitId) =>
                                        changeLine(index, { unit_id: unitId })
                                    }
                                    onOverrideChange={(enabled) =>
                                        setUnitOverrides((current) =>
                                            current.map((value, i) =>
                                                i === index ? enabled : value,
                                            ),
                                        )
                                    }
                                />
                                <Field
                                    label="Cantidad"
                                    error={
                                        form.errors[
                                            `items.${index}.quantity` as keyof typeof form.errors
                                        ]
                                    }
                                >
                                    <Input
                                        inputMode="decimal"
                                        value={line.quantity}
                                        onChange={(e) =>
                                            changeLine(index, {
                                                quantity: e.target.value,
                                            })
                                        }
                                        placeholder="0"
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={form.data.items.length === 1}
                                    onClick={() => removeLine(index)}
                                >
                                    <Trash2 className="text-destructive" />
                                    <span className="sr-only">
                                        Eliminar material {index + 1}
                                    </span>
                                </Button>
                            </div>
                        ))}
                        <InputError message={form.errors.items} />
                        <p className="text-sm text-muted-foreground">
                            ¿No aparece un material?{' '}
                            <Link
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                href="/catalogs"
                            >
                                Agrégalo primero al catálogo.
                            </Link>
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Respaldo y observaciones</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                        <Field
                            label="Foto o PDF del vale (opcional)"
                            error={form.errors.attachments}
                        >
                            <Input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                multiple
                                onChange={(e) =>
                                    form.setData(
                                        'attachments',
                                        Array.from(e.target.files ?? []),
                                    )
                                }
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                                Hasta 5 archivos de 10 MB cada uno.
                            </p>
                        </Field>
                        <Field label="Observaciones" error={form.errors.notes}>
                            <Textarea
                                value={form.data.notes}
                                onChange={(e) =>
                                    form.setData('notes', e.target.value)
                                }
                            />
                        </Field>
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
    override,
    error,
    onChange,
    onOverrideChange,
}: {
    index: number;
    line: Line;
    materials: Material[];
    units: Unit[];
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

    return (
        <div
            className="flex min-w-0 flex-col gap-2"
            data-invalid={!!error || undefined}
        >
            <div className="flex min-h-4 items-center justify-between gap-2">
                <Label
                    htmlFor={showSelector ? fieldId : undefined}
                    className="text-[13px] font-medium text-text-secondary"
                >
                    Unidad
                </Label>
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
                <NativeSelect
                    id={fieldId}
                    value={line.unit_id}
                    aria-invalid={!!error || undefined}
                    onChange={(event) => onChange(event.target.value)}
                >
                    <option value="">Seleccionar unidad</option>
                    {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
                        </option>
                    ))}
                </NativeSelect>
            ) : (
                <div className="flex h-10 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium text-foreground">
                    {currentUnit
                        ? `${currentUnit.name} (${currentUnit.symbol})`
                        : 'Se asignará al elegir material'}
                </div>
            )}
            {showSelector && defaultUnit?.symbol === 's/e' && (
                <p className="text-xs leading-4 text-muted-foreground">
                    Este material no tiene una unidad habitual. Selecciona la
                    indicada en el vale.
                </p>
            )}
            {showSelector &&
                !override &&
                currentUnit?.symbol === 's/e' &&
                defaultUnit?.symbol !== 's/e' && (
                    <p className="text-xs leading-4 text-muted-foreground">
                        La unidad guardada está sin especificar. Selecciona la
                        indicada en el vale.
                    </p>
                )}
            {showSelector && override && defaultUnit?.symbol !== 's/e' && (
                <p className="text-xs leading-4 text-muted-foreground">
                    La excepción sólo se guardará en este vale.
                </p>
            )}
            <InputError message={error} />
        </div>
    );
}

function Field({
    label,
    error,
    children,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div
            className="flex min-w-0 flex-col gap-2"
            data-invalid={!!error || undefined}
        >
            <Label className="flex flex-col gap-2 text-[13px] font-medium text-text-secondary">
                <span>{label}</span>
                {isValidElement(children)
                    ? cloneElement(
                          children as React.ReactElement<{
                              'aria-invalid'?: boolean;
                          }>,
                          { 'aria-invalid': !!error || undefined },
                      )
                    : children}
            </Label>
            <InputError message={error} />
        </div>
    );
}
function Select({
    value,
    onChange,
    placeholder,
    options,
    ...props
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    options: { value: string; label: string }[];
} & Pick<React.ComponentProps<'select'>, 'aria-invalid'>) {
    return (
        <NativeSelect
            value={value}
            onChange={(e) => onChange(e.target.value)}
            {...props}
        >
            <option value="">{placeholder}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </NativeSelect>
    );
}
