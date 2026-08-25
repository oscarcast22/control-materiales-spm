import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, FileText, Plus, Save, Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
    Material,
    Named,
    Program,
    StorageLocation,
    Unit,
    Voucher,
} from '@/types';

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
    reference: string;
    issued_on: string;
    issued_time: string;
    received_by_id: string;
    delivered_by_id: string;
    authorized_by_id: string;
    program_id: string;
    action_id: string;
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
    programs: Program[];
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
    programs,
    locations,
    authorizers,
}: Props) {
    const form = useForm<FormData>({
        storage_location_id: voucher
            ? String(voucher.location.id)
            : String(locations[0]?.id ?? ''),
        folio: voucher?.folio ?? '',
        direction: voucher?.direction ?? 'exit',
        reference: voucher?.reference ?? '',
        issued_on: voucher?.issued_on ?? new Date().toISOString().slice(0, 10),
        issued_time: voucher?.issued_time?.slice(0, 5) ?? '',
        received_by_id: voucher ? String(voucher.received_by.id) : '',
        delivered_by_id: voucher ? String(voucher.delivered_by.id) : '',
        authorized_by_id: voucher?.authorized_by
            ? String(voucher.authorized_by.id)
            : '',
        program_id: voucher?.program ? String(voucher.program.id) : '',
        action_id: voucher?.action ? String(voucher.action.id) : '',
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
    const actions =
        programs.find((program) => String(program.id) === form.data.program_id)
            ?.actions ?? [];
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
            unit_id: material
                ? String(material.default_unit_id)
                : form.data.items[index].unit_id,
        });
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
                className="flex flex-1 flex-col gap-5 p-4 md:p-7"
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" asChild>
                            <Link
                                href={
                                    voucher
                                        ? `/vouchers/${voucher.id}`
                                        : '/vouchers'
                                }
                            >
                                <ArrowLeft className="size-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">
                                {voucher ? 'Editar vale' : 'Capturar vale'}
                            </h1>
                            <p className="text-muted-foreground">
                                Registra el documento una sola vez y agrega
                                todos sus materiales.
                            </p>
                        </div>
                    </div>
                    <Button disabled={form.processing}>
                        <Save className="mr-2 size-4" />
                        {form.processing ? 'Guardando…' : 'Guardar vale'}
                    </Button>
                </div>
                {Object.keys(form.errors).length > 0 && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            Revisa los campos marcados antes de guardar.
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
                        <Field
                            label="Referencia / folio relacionado (opcional)"
                            error={form.errors.reference}
                        >
                            <Input
                                value={form.data.reference}
                                onChange={(e) =>
                                    form.setData('reference', e.target.value)
                                }
                                placeholder="Orden, reporte o autorización"
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
                        <Field
                            label="Programa (opcional)"
                            error={form.errors.program_id}
                        >
                            <Select
                                value={form.data.program_id}
                                onChange={(v) => {
                                    form.setData('program_id', v);
                                    form.setData('action_id', '');
                                }}
                                placeholder="Sin programa"
                                options={programs.map((p) => ({
                                    value: String(p.id),
                                    label:
                                        p.code + (p.name ? ` · ${p.name}` : ''),
                                }))}
                            />
                        </Field>
                        <Field
                            label="Acción (opcional)"
                            error={form.errors.action_id}
                        >
                            <Select
                                value={form.data.action_id}
                                onChange={(v) => form.setData('action_id', v)}
                                placeholder="Sin acción"
                                options={actions.map((a) => ({
                                    value: String(a.id),
                                    label:
                                        a.code + (a.name ? ` · ${a.name}` : ''),
                                }))}
                            />
                        </Field>
                        <div className="md:col-span-2 xl:col-span-4">
                            <Field
                                label={
                                    form.data.direction === 'entry'
                                        ? 'Origen, destino o concepto de la entrada'
                                        : 'Descripción de uso y destino'
                                }
                                error={form.errors.destination}
                            >
                                <textarea
                                    className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
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
                                La unidad queda guardada con el renglón aunque
                                el catálogo cambie.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                form.setData('items', [
                                    ...form.data.items,
                                    blankLine(),
                                ])
                            }
                        >
                            <Plus className="mr-2 size-4" />
                            Agregar material
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {duplicateMaterials.length > 0 && (
                            <Alert>
                                <AlertDescription>
                                    Hay materiales repetidos. Puedes conservar
                                    renglones separados o sumar sus cantidades.
                                </AlertDescription>
                            </Alert>
                        )}
                        {form.data.items.map((line, index) => (
                            <div
                                key={line.id ?? `new-${index}`}
                                className="grid items-end gap-3 rounded-xl border bg-muted/15 p-4 md:grid-cols-[minmax(240px,1fr)_180px_180px_auto]"
                            >
                                <Field
                                    label={`Material ${index + 1}`}
                                    error={
                                        form.errors[
                                            `items.${index}.material_id` as keyof typeof form.errors
                                        ]
                                    }
                                >
                                    <select
                                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
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
                                    </select>
                                </Field>
                                <Field
                                    label="Unidad"
                                    error={
                                        form.errors[
                                            `items.${index}.unit_id` as keyof typeof form.errors
                                        ]
                                    }
                                >
                                    <Select
                                        value={line.unit_id}
                                        onChange={(v) =>
                                            changeLine(index, { unit_id: v })
                                        }
                                        placeholder="Unidad"
                                        options={units.map((u) => ({
                                            value: String(u.id),
                                            label: `${u.name} (${u.symbol})`,
                                        }))}
                                    />
                                </Field>
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
                                    onClick={() =>
                                        form.setData(
                                            'items',
                                            form.data.items.filter(
                                                (_, i) => i !== index,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 className="size-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                        <InputError message={form.errors.items} />
                        <p className="text-sm text-muted-foreground">
                            ¿No aparece un material?{' '}
                            <Link
                                className="font-medium text-sky-700 hover:underline"
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
                            <textarea
                                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
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
                                        className="mr-3 inline-flex items-center text-sm text-sky-700 hover:underline"
                                        href={`/attachments/${file.id}`}
                                    >
                                        <FileText className="mr-1 size-4" />
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
        <div className="grid gap-2">
            <Label>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}
function Select({
    value,
    onChange,
    placeholder,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    options: { value: string; label: string }[];
}) {
    return (
        <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            <option value="">{placeholder}</option>
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
