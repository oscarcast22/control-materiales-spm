import { useForm } from '@inertiajs/react';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
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
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { VoucherType } from '@/types';

export function CancelledVoucherDialog({
    voucherTypes,
}: {
    voucherTypes: VoucherType[];
}) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        voucher_type_id: String(voucherTypes[0]?.id ?? ''),
        folio: '',
        issued_on: new Date().toISOString().slice(0, 10),
        cancellation_reason: '',
    });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/vouchers/cancelled', {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset('folio', 'cancellation_reason');
            },
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Ban data-icon="inline-start" />
                    Registrar cancelado
                </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <DialogHeader>
                        <DialogTitle>Registrar folio cancelado</DialogTitle>
                        <DialogDescription>
                            Conserva la continuidad de la serie sin pedir
                            personas, destino ni materiales.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                            <FieldLabel htmlFor="cancelled-voucher-type">
                                Tipo de vale
                            </FieldLabel>
                            <SimpleSelect
                                id="cancelled-voucher-type"
                                value={form.data.voucher_type_id}
                                onValueChange={(value) =>
                                    form.setData('voucher_type_id', value)
                                }
                                options={voucherTypes.map((voucherType) => ({
                                    value: String(voucherType.id),
                                    label: voucherType.name,
                                }))}
                                placeholder="Seleccionar tipo"
                                invalid={Boolean(form.errors.voucher_type_id)}
                            />
                            <InputError message={form.errors.voucher_type_id} />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="cancelled-voucher-folio">
                                Folio
                            </FieldLabel>
                            <Input
                                id="cancelled-voucher-folio"
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
                        <Field>
                            <FieldLabel htmlFor="cancelled-voucher-date">
                                Fecha
                            </FieldLabel>
                            <Input
                                id="cancelled-voucher-date"
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
                        <Field className="sm:col-span-2">
                            <FieldLabel htmlFor="cancelled-voucher-reason">
                                Motivo (opcional)
                            </FieldLabel>
                            <Textarea
                                id="cancelled-voucher-reason"
                                value={form.data.cancellation_reason}
                                onChange={(event) =>
                                    form.setData(
                                        'cancellation_reason',
                                        event.target.value,
                                    )
                                }
                                placeholder="Si se deja vacío, se registrará que el folio se conserva por continuidad."
                            />
                            <InputError
                                message={form.errors.cancellation_reason}
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={form.processing}>
                            Registrar folio
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
