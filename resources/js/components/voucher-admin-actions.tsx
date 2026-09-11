import { router } from '@inertiajs/react';
import { EllipsisVertical, Link2, Send, Trash2, XCircle } from 'lucide-react';
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
import { VoucherShareLinkDialog } from '@/components/voucher-share-link-dialog';
import type { VoucherShareLink } from '@/components/voucher-share-link-dialog';
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
    const [shareOpen, setShareOpen] = useState(false);
    const [shareLink, setShareLink] = useState<VoucherShareLink | null>(null);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareError, setShareError] = useState<string | null>(null);
    const canCancel = voucher.status === 'active' && voucher.permissions.cancel;
    const canMarkLoaned =
        voucher.status === 'active' && voucher.permissions.mark_loaned;
    const canShare = voucher.permissions.share;

    if (
        !canCancel &&
        !canMarkLoaned &&
        !voucher.permissions.delete &&
        !canShare
    ) {
        return null;
    }

    const loadShareLink = async () => {
        setShareLoading(true);
        setShareError(null);
        setShareLink(null);

        try {
            const response = await fetch(`/vouchers/${voucher.id}/share-link`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('No fue posible generar el enlace.');
            }

            setShareLink((await response.json()) as VoucherShareLink);
        } catch (error) {
            setShareError(
                error instanceof Error
                    ? error.message
                    : 'No fue posible generar el enlace.',
            );
        } finally {
            setShareLoading(false);
        }
    };

    const handleShareOpenChange = (open: boolean) => {
        setShareOpen(open);

        if (open) {
            void loadShareLink();
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <IconButton label="Más acciones del vale" variant="outline">
                        <EllipsisVertical aria-hidden="true" />
                    </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52 p-1.5">
                    {canShare && (
                        <DropdownMenuItem
                            className="min-h-10 rounded-lg px-3 font-medium text-foreground focus:bg-hover focus:text-primary data-[highlighted]:bg-hover data-[highlighted]:text-primary"
                            onSelect={() => handleShareOpenChange(true)}
                        >
                            <Link2
                                className="text-primary"
                                aria-hidden="true"
                            />
                            Compartir enlace por 24 horas
                        </DropdownMenuItem>
                    )}
                    {canShare &&
                        (canMarkLoaned ||
                            canCancel ||
                            voucher.permissions.delete) && (
                            <DropdownMenuSeparator />
                        )}
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

            {canShare && (
                <VoucherShareLinkDialog
                    voucher={voucher}
                    open={shareOpen}
                    onOpenChange={handleShareOpenChange}
                    shareLink={shareLink}
                    loading={shareLoading}
                    error={shareError}
                    onRetry={() => void loadShareLink()}
                />
            )}
        </>
    );
}
