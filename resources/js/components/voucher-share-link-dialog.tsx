import { Check, Copy, Link2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useClipboard } from '@/hooks/use-clipboard';
import type { Voucher } from '@/types';

export type VoucherShareLink = {
    url: string;
    expires_at: string;
};

export function VoucherShareLinkDialog({
    voucher,
    open,
    onOpenChange,
    shareLink,
    loading,
    error,
    onRetry,
}: {
    voucher: Pick<Voucher, 'id' | 'folio'>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shareLink: VoucherShareLink | null;
    loading: boolean;
    error: string | null;
    onRetry: () => void;
}) {
    const [copiedText, copy] = useClipboard();

    const expiresAt = shareLink
        ? new Intl.DateTimeFormat('es-MX', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(shareLink.expires_at))
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <div className="mb-1 flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary-subtle text-primary">
                        <Link2 className="size-5" aria-hidden="true" />
                    </div>
                    <DialogTitle>Compartir vale {voucher.folio}</DialogTitle>
                    <DialogDescription>
                        Genera un enlace temporal para consultar el detalle y
                        los comprobantes de este vale sin iniciar sesión.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="flex min-h-28 items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground">
                        <LoaderCircle
                            className="size-5 animate-spin text-primary"
                            aria-hidden="true"
                        />
                        Generando enlace seguro…
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <TriangleAlert aria-hidden="true" />
                        <AlertDescription className="flex flex-col gap-3">
                            <span>{error}</span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-fit"
                                onClick={onRetry}
                            >
                                Intentar de nuevo
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}

                {shareLink && (
                    <div className="grid gap-4">
                        <div className="rounded-xl border border-primary/15 bg-primary-subtle/55 p-3.5 text-sm">
                            <p className="font-semibold text-foreground">
                                Disponible hasta el {expiresAt}
                            </p>
                            <p className="mt-1 leading-5 text-muted-foreground">
                                Cualquier persona que reciba este enlace podrá
                                consultar el vale durante ese periodo.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <label
                                className="text-sm font-medium"
                                htmlFor="voucher-share-link"
                            >
                                Enlace temporal
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    id="voucher-share-link"
                                    value={shareLink.url}
                                    readOnly
                                    onFocus={(event) =>
                                        event.currentTarget.select()
                                    }
                                    className="font-mono text-xs"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    aria-label="Copiar enlace temporal"
                                    onClick={() => void copy(shareLink.url)}
                                >
                                    {copiedText === shareLink.url ? (
                                        <Check aria-hidden="true" />
                                    ) : (
                                        <Copy aria-hidden="true" />
                                    )}
                                </Button>
                            </div>
                            {copiedText === shareLink.url && (
                                <p className="text-sm font-medium text-success">
                                    Enlace copiado.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
