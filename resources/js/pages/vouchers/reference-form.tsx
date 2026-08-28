import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Save } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect } from 'react';
import InputError from '@/components/input-error';
import { Page, PageHeader } from '@/components/page';
import { SimpleSelect } from '@/components/simple-select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Voucher, VoucherType } from '@/types';

export type VoucherReferenceFormProps = {
    voucher: Voucher;
    voucherTypes: VoucherType[];
    embedded?: boolean;
    onSuccess?: () => void;
    onDirtyChange?: (dirty: boolean) => void;
};

export default function VoucherReferenceForm({
    voucher,
    voucherTypes,
    embedded = false,
    onSuccess,
    onDirtyChange,
}: VoucherReferenceFormProps) {
    const form = useForm({
        _dialog: embedded,
        voucher_type_id: String(voucher.voucher_type.id),
        folio: voucher.folio,
        issued_on: voucher.issued_on,
        loaned_to_name: voucher.loaned_to_name ?? '',
    });

    useEffect(() => {
        onDirtyChange?.(form.isDirty);
    }, [form.isDirty, onDirtyChange]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.transform((data) =>
            voucher.status === 'loaned'
                ? data
                : {
                      _dialog: data._dialog,
                      voucher_type_id: data.voucher_type_id,
                      folio: data.folio,
                      issued_on: data.issued_on,
                  },
        );
        form.put(`/vouchers/${voucher.id}`, {
            preserveScroll: true,
            onSuccess,
        });
    };

    const content = (
        <form onSubmit={submit} className="flex flex-col gap-5">
            <PageHeader
                title={`Corregir folio ${voucher.folio}`}
                description={`Actualiza únicamente los datos de referencia del vale ${voucher.status === 'loaned' ? 'prestado' : 'cancelado'}.`}
                actions={
                    <>
                        {!embedded && (
                            <Button variant="ghost" asChild>
                                <Link href={`/vouchers/${voucher.id}`}>
                                    <ArrowLeft data-icon="inline-start" />
                                    Volver
                                </Link>
                            </Button>
                        )}
                        <Button
                            disabled={form.processing}
                            aria-busy={form.processing}
                        >
                            <Save data-icon="inline-start" />
                            {form.processing
                                ? 'Guardando…'
                                : 'Guardar corrección'}
                        </Button>
                    </>
                }
            />
            <Alert variant="info">
                <AlertDescription>
                    El estado no cambiará y la corrección quedará registrada en
                    la auditoría.
                </AlertDescription>
            </Alert>
            <Card>
                <CardHeader>
                    <CardTitle>Datos del folio</CardTitle>
                    <CardDescription>
                        No se pueden agregar técnicos, destinos ni materiales a
                        este registro.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FieldGroup className="grid gap-5 sm:grid-cols-2">
                        <Field
                            data-invalid={
                                Boolean(form.errors.voucher_type_id) ||
                                undefined
                            }
                        >
                            <FieldLabel htmlFor="reference-voucher-type">
                                Tipo de vale
                            </FieldLabel>
                            <SimpleSelect
                                id="reference-voucher-type"
                                value={form.data.voucher_type_id}
                                onValueChange={(value) =>
                                    form.setData('voucher_type_id', value)
                                }
                                options={voucherTypes.map((type) => ({
                                    value: String(type.id),
                                    label: type.name,
                                }))}
                                placeholder="Seleccionar tipo"
                                invalid={Boolean(form.errors.voucher_type_id)}
                            />
                            <InputError message={form.errors.voucher_type_id} />
                        </Field>
                        <Field
                            data-invalid={
                                Boolean(form.errors.folio) || undefined
                            }
                        >
                            <FieldLabel htmlFor="reference-voucher-folio">
                                Folio
                            </FieldLabel>
                            <Input
                                id="reference-voucher-folio"
                                value={form.data.folio}
                                onChange={(event) =>
                                    form.setData('folio', event.target.value)
                                }
                                aria-invalid={
                                    Boolean(form.errors.folio) || undefined
                                }
                            />
                            <InputError message={form.errors.folio} />
                        </Field>
                        <Field
                            data-invalid={
                                Boolean(form.errors.issued_on) || undefined
                            }
                        >
                            <FieldLabel htmlFor="reference-voucher-date">
                                Fecha
                            </FieldLabel>
                            <Input
                                id="reference-voucher-date"
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
                            <InputError message={form.errors.issued_on} />
                        </Field>
                        {voucher.status === 'loaned' && (
                            <Field
                                data-invalid={
                                    Boolean(form.errors.loaned_to_name) ||
                                    undefined
                                }
                            >
                                <FieldLabel htmlFor="reference-loaned-to">
                                    Prestado a (opcional)
                                </FieldLabel>
                                <Input
                                    id="reference-loaned-to"
                                    value={form.data.loaned_to_name}
                                    onChange={(event) =>
                                        form.setData(
                                            'loaned_to_name',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Nombre libre"
                                    aria-invalid={
                                        Boolean(form.errors.loaned_to_name) ||
                                        undefined
                                    }
                                />
                                <InputError
                                    message={form.errors.loaned_to_name}
                                />
                            </Field>
                        )}
                    </FieldGroup>
                </CardContent>
            </Card>
        </form>
    );

    if (embedded) {
        return content;
    }

    return (
        <>
            <Head title={`Corregir folio ${voucher.folio}`} />
            <Page width="content">{content}</Page>
        </>
    );
}
