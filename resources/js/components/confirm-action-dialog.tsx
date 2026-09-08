import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

export function ConfirmActionDialog({
    trigger,
    open: controlledOpen,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive = false,
    reasonLabel,
    reasonPlaceholder,
    reasonRequired = true,
    cancelLabel = 'Volver',
    children,
}: {
    trigger?: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: (reason?: string) => void | Promise<void>;
    destructive?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    reasonRequired?: boolean;
    cancelLabel?: string;
    children?: ReactNode;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const reasonId = useId();
    const hasReasonField = Boolean(reasonLabel);
    const reasonLength = reason.trim().length;
    const canConfirm =
        !hasReasonField ||
        (reasonRequired
            ? reasonLength >= 5
            : reasonLength === 0 || reasonLength >= 5);

    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = (nextOpen: boolean) => {
        if (controlledOpen === undefined) {
            setUncontrolledOpen(nextOpen);
        }

        onOpenChange?.(nextOpen);
    };

    const close = () => {
        if (processing) {
            return;
        }

        setOpen(false);
        setReason('');
        setError('');
    };

    const confirm = async () => {
        if (!canConfirm) {
            return;
        }

        setProcessing(true);
        setError('');

        try {
            await onConfirm(
                hasReasonField && reasonLength > 0 ? reason.trim() : undefined,
            );
            setProcessing(false);
            setOpen(false);
            setReason('');
            setError('');
        } catch {
            setProcessing(false);
            setError(
                'No fue posible completar la acción. Revisa los datos e inténtalo de nuevo.',
            );
        }
    };

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
        >
            {trigger && (
                <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            )}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {children}
                {reasonLabel && (
                    <Field invalid={Boolean(error)}>
                        <FieldLabel htmlFor={reasonId}>
                            {reasonLabel}
                        </FieldLabel>
                        <Textarea
                            id={reasonId}
                            value={reason}
                            onChange={(event) => {
                                setReason(event.target.value);
                                setError('');
                            }}
                            placeholder={reasonPlaceholder}
                            maxLength={1000}
                            aria-describedby={`${reasonId}-help`}
                            aria-invalid={Boolean(error) || undefined}
                            disabled={processing}
                        />
                        <FieldDescription id={`${reasonId}-help`}>
                            {reasonRequired
                                ? 'Escribe al menos 5 caracteres.'
                                : 'Opcional. Si escribes un motivo, usa al menos 5 caracteres.'}
                        </FieldDescription>
                        <FieldError>{error}</FieldError>
                    </Field>
                )}
                {!reasonLabel && <FieldError>{error}</FieldError>}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={processing}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <Button
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={!canConfirm || processing}
                        aria-busy={processing}
                        onClick={() => void confirm()}
                    >
                        {processing && <Spinner data-icon="inline-start" />}
                        {processing ? 'Procesando…' : confirmLabel}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
