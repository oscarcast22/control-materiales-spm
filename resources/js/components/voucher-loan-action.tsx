import { router } from '@inertiajs/react';
import { useId, useState } from 'react';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { Voucher } from '@/types';

export function VoucherLoanAction({
    voucher,
    embedded = false,
    onLoaned,
    open,
    onOpenChange,
}: {
    voucher: Voucher;
    embedded?: boolean;
    onLoaned?: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const responsibleId = useId();
    const [loanedToName, setLoanedToName] = useState('');
    const [voidApplications, setVoidApplications] = useState(true);
    const hasActiveApplications = voucher.items.some((item) =>
        item.applications.some((application) => !application.voided_at),
    );

    if (voucher.status !== 'active' || !voucher.permissions.mark_loaned) {
        return null;
    }

    return (
        <ConfirmActionDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setLoanedToName('');
                    setVoidApplications(true);
                }

                onOpenChange(nextOpen);
            }}
            title="Marcar vale como prestado"
            description="El vale dejará de generar saldo pendiente y no admitirá nuevas aplicaciones. Sus datos actuales se conservarán como referencia."
            confirmLabel="Marcar como prestado"
            cancelLabel="Volver"
            onConfirm={() =>
                new Promise<void>((resolve, reject) => {
                    router.post(
                        `/vouchers/${voucher.id}/loan`,
                        {
                            loaned_to_name: loanedToName.trim() || null,
                            void_applications:
                                hasActiveApplications && voidApplications,
                            _dialog: embedded,
                        },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                onLoaned?.();
                                resolve();
                            },
                            onError: () =>
                                reject(
                                    new Error(
                                        'No fue posible marcar el vale como prestado.',
                                    ),
                                ),
                        },
                    );
                })
            }
        >
            <div className="flex flex-col gap-4">
                <Field>
                    <FieldLabel htmlFor={responsibleId}>
                        Persona responsable (opcional)
                    </FieldLabel>
                    <Input
                        id={responsibleId}
                        value={loanedToName}
                        onChange={(event) =>
                            setLoanedToName(event.target.value)
                        }
                        placeholder="Nombre libre"
                        maxLength={255}
                        autoComplete="off"
                    />
                    <FieldDescription>
                        Puedes completarla o corregirla después desde Editar.
                    </FieldDescription>
                </Field>

                {hasActiveApplications && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-strong bg-muted/35 p-4">
                        <Checkbox
                            className="mt-0.5"
                            checked={voidApplications}
                            onCheckedChange={(checked) =>
                                setVoidApplications(checked === true)
                            }
                        />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-foreground">
                                Anular las aplicaciones vigentes
                            </span>
                            <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                                {voidApplications
                                    ? 'Se conservarán como anuladas y dejarán de contar como material aplicado.'
                                    : 'Se conservarán vigentes como antecedente de sólo lectura, sin generar pendiente ni seguimiento.'}
                            </span>
                        </span>
                    </label>
                )}
            </div>
        </ConfirmActionDialog>
    );
}
