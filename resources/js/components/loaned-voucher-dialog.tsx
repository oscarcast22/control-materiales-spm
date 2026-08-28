import { useForm } from '@inertiajs/react';
import { Send } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { SimpleSelect } from '@/components/simple-select';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { VoucherType } from '@/types';

export function LoanedVoucherDialog({
    voucherTypes,
}: {
    voucherTypes: VoucherType[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        _dialog: true,
        voucher_type_id: String(voucherTypes[0]?.id ?? ''),
        folio: '',
        issued_on: new Date().toISOString().slice(0, 10),
        loaned_to_name: '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/vouchers/loaned', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset('folio', 'loaned_to_name');
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Send data-icon="inline-start" />
                    Registrar prestado
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <DialogHeader>
                        <DialogTitle>Registrar folio prestado</DialogTitle>
                        <DialogDescription>
                            Conserva la continuidad de la serie. Este registro
                            no tendrá técnico, destino ni materiales.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup className="grid gap-4 sm:grid-cols-2">
                        <Field
                            data-invalid={
                                Boolean(form.errors.voucher_type_id) ||
                                undefined
                            }
                        >
                            <FieldLabel htmlFor="loaned-voucher-type">
                                Tipo de vale
                            </FieldLabel>
                            <SimpleSelect
                                id="loaned-voucher-type"
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
                            <FieldLabel htmlFor="loaned-voucher-folio">
                                Folio
                            </FieldLabel>
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
                            <InputError message={form.errors.folio} />
                        </Field>
                        <Field
                            data-invalid={
                                Boolean(form.errors.issued_on) || undefined
                            }
                        >
                            <FieldLabel htmlFor="loaned-voucher-date">
                                Fecha
                            </FieldLabel>
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
                            <InputError message={form.errors.issued_on} />
                        </Field>
                        <Field
                            data-invalid={
                                Boolean(form.errors.loaned_to_name) || undefined
                            }
                        >
                            <FieldLabel htmlFor="loaned-voucher-name">
                                Prestado a (opcional)
                            </FieldLabel>
                            <Input
                                id="loaned-voucher-name"
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
                            <InputError message={form.errors.loaned_to_name} />
                        </Field>
                    </FieldGroup>
                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={form.processing}
                            aria-busy={form.processing}
                        >
                            {form.processing
                                ? 'Registrando…'
                                : 'Registrar folio'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
