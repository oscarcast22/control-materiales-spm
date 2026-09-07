import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Button } from '@/components/ui/button';
import type { Voucher } from '@/types';

export function VoucherCancelAction({
    voucher,
    embedded = false,
    onCancelled,
}: {
    voucher: Voucher;
    embedded?: boolean;
    onCancelled?: () => void;
}) {
    const hasActiveApplications = voucher.items.some((item) =>
        item.applications.some((application) => !application.voided_at),
    );

    if (voucher.status !== 'active' || !voucher.permissions.cancel) {
        return null;
    }

    if (hasActiveApplications) {
        return (
            <div className="flex max-w-56 flex-col items-start gap-1">
                <Button
                    variant="outline"
                    className="border-danger/35 text-destructive hover:border-danger/55 hover:bg-danger-subtle hover:text-destructive"
                    disabled
                >
                    <Trash2 data-icon="inline-start" />
                    Cancelar vale
                </Button>
                <p className="text-xs leading-4 text-muted-foreground">
                    Anula primero las aplicaciones vigentes.
                </p>
            </div>
        );
    }

    return (
        <ConfirmActionDialog
            trigger={
                <Button
                    variant="outline"
                    className="border-danger/35 text-destructive hover:border-danger/55 hover:bg-danger-subtle hover:text-destructive"
                >
                    <Trash2 data-icon="inline-start" />
                    Cancelar vale
                </Button>
            }
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
            onConfirm={(reason) =>
                new Promise<void>((resolve, reject) => {
                    router.post(
                        `/vouchers/${voucher.id}/cancel`,
                        { reason, _dialog: embedded },
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
        />
    );
}
