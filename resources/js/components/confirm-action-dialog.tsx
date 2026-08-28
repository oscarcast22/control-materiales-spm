import { useId, useState } from 'react';
import type { ReactNode } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ConfirmActionDialog({
    trigger,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive = false,
    reasonLabel,
    reasonPlaceholder,
}: {
    trigger: ReactNode;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: (reason?: string) => void;
    destructive?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const reasonId = useId();
    const requiresReason = Boolean(reasonLabel);
    const canConfirm = !requiresReason || reason.trim().length >= 5;

    const close = () => {
        setOpen(false);
        setReason('');
    };

    const confirm = () => {
        if (!canConfirm) {
            return;
        }

        onConfirm(requiresReason ? reason.trim() : undefined);
        close();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {reasonLabel && (
                    <div className="grid gap-2">
                        <Label htmlFor={reasonId}>{reasonLabel}</Label>
                        <Textarea
                            id={reasonId}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={reasonPlaceholder}
                            aria-describedby={`${reasonId}-help`}
                        />
                        <p
                            id={`${reasonId}-help`}
                            className="text-xs text-muted-foreground"
                        >
                            Escribe al menos 5 caracteres.
                        </p>
                    </div>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={close}>
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={!canConfirm}
                        onClick={confirm}
                    >
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
