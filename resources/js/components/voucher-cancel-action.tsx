import { router } from '@inertiajs/react';
import { useState } from 'react';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { Voucher } from '@/types';

export function VoucherCancelAction({
    voucher,
    embedded = false,
    onCancelled,
    open,
    onOpenChange,
}: {
    voucher: Voucher;
    embedded?: boolean;
    onCancelled?: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [voidApplications, setVoidApplications] = useState(true);
    const hasActiveApplications = voucher.items.some((item) =>
        item.applications.some((application) => !application.voided_at),
    );

    if (voucher.status !== 'active' || !voucher.permissions.cancel) {
        return null;
    }

    return (
        <ConfirmActionDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setVoidApplications(true);
                }

                onOpenChange(nextOpen);
            }}
            title="Cancelar vale"
            description={
                voucher.direction === 'exit'
                    ? 'La cancelación conserva el folio, clasifica el material como sin usar y deja una traza auditable.'
                    : 'La cancelación conserva el folio y deja una traza auditable.'
            }
            confirmLabel="Cancelar vale"
            destructive
            reasonLabel="Motivo de cancelación (opcional)"
            reasonPlaceholder="Explica por qué se cancela este vale"
            reasonRequired={false}
            cancelLabel="Volver"
            onConfirm={(reason) =>
                new Promise<void>((resolve, reject) => {
                    router.post(
                        `/vouchers/${voucher.id}/cancel`,
                        {
                            reason,
                            void_applications:
                                hasActiveApplications && voidApplications,
                            _dialog: embedded,
                        },
                        {
                            preserveScroll: true,
                            onSuccess: () => {
                                onCancelled?.();
                                resolve();
                            },
                            onError: () =>
                                reject(
                                    new Error(
                                        'No fue posible cancelar el vale.',
                                    ),
                                ),
                        },
                    );
                })
            }
        >
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
        </ConfirmActionDialog>
    );
}
