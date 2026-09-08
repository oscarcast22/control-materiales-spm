import { router } from '@inertiajs/react';
import { EllipsisVertical, Send, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { VoucherCancelAction } from '@/components/voucher-cancel-action';
import { VoucherLoanAction } from '@/components/voucher-loan-action';
import type { Voucher } from '@/types';

export function VoucherAdminActions({
    voucher,
    embedded = false,
    onCancelled,
    onLoaned,
    onDeleted,
}: {
    voucher: Voucher;
    embedded?: boolean;
    onCancelled?: () => void;
    onLoaned?: () => void;
    onDeleted?: () => void;
}) {
    const [cancelOpen, setCancelOpen] = useState(false);
    const [loanOpen, setLoanOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const canCancel = voucher.status === 'active' && voucher.permissions.cancel;
    const canMarkLoaned =
        voucher.status === 'active' && voucher.permissions.mark_loaned;

    if (!canCancel && !canMarkLoaned && !voucher.permissions.delete) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <IconButton label="Más acciones del vale" variant="outline">
                        <EllipsisVertical aria-hidden="true" />
                    </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52 p-1.5">
                    {canMarkLoaned && (
                        <DropdownMenuItem
                            className="min-h-10 rounded-lg px-3 font-medium text-foreground focus:bg-hover focus:text-primary data-[highlighted]:bg-hover data-[highlighted]:text-primary"
                            onSelect={() => setLoanOpen(true)}
                        >
                            <Send className="text-primary" aria-hidden="true" />
                            Marcar como prestado
                        </DropdownMenuItem>
                    )}
                    {canCancel && (
                        <DropdownMenuItem
                            className="min-h-10 rounded-lg px-3 font-medium text-foreground focus:bg-hover focus:text-primary data-[highlighted]:bg-hover data-[highlighted]:text-primary"
                            onSelect={() => setCancelOpen(true)}
                        >
                            <XCircle
                                className="text-primary"
                                aria-hidden="true"
                            />
                            Cancelar vale
                        </DropdownMenuItem>
                    )}
                    {canCancel && voucher.permissions.delete && (
                        <DropdownMenuSeparator />
                    )}
                    {voucher.permissions.delete && (
                        <DropdownMenuItem
                            variant="destructive"
                            className="min-h-10 rounded-lg px-3 font-medium"
                            onSelect={() => setDeleteOpen(true)}
                        >
                            <Trash2 aria-hidden="true" />
                            Eliminar vale
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {canCancel && (
                <VoucherCancelAction
                    voucher={voucher}
                    embedded={embedded}
                    onCancelled={onCancelled}
                    open={cancelOpen}
                    onOpenChange={setCancelOpen}
                />
            )}

            {canMarkLoaned && (
                <VoucherLoanAction
                    voucher={voucher}
                    embedded={embedded}
                    onLoaned={onLoaned}
                    open={loanOpen}
                    onOpenChange={setLoanOpen}
                />
            )}

            {voucher.permissions.delete && (
                <ConfirmActionDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    title="Eliminar vale definitivamente"
                    description={`Se eliminarán el vale ${voucher.folio}, sus materiales, aplicaciones, comprobantes y toda su información. Esta acción es irreversible.`}
                    confirmLabel="Eliminar vale"
                    cancelLabel="Cancelar"
                    destructive
                    onConfirm={() =>
                        new Promise<void>((resolve, reject) => {
                            router.delete(`/vouchers/${voucher.id}`, {
                                data: { _dialog: embedded },
                                preserveScroll: true,
                                onSuccess: () => {
                                    onDeleted?.();
                                    resolve();
                                },
                                onError: () =>
                                    reject(
                                        new Error(
                                            'No fue posible eliminar el vale.',
                                        ),
                                    ),
                            });
                        })
                    }
                />
            )}
        </>
    );
}
