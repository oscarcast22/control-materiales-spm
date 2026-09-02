import type { MouseEvent, ReactNode } from 'react';
import {
    createContext,
    lazy,
    Suspense,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { VoucherFormProps } from '@/pages/vouchers/form';
import type { VoucherReferenceFormProps } from '@/pages/vouchers/reference-form';
import type { Voucher } from '@/types';

const VoucherForm = lazy(() => import('@/pages/vouchers/form'));
const VoucherReferenceForm = lazy(
    () => import('@/pages/vouchers/reference-form'),
);
const VoucherShow = lazy(() => import('@/pages/vouchers/show'));

type DialogMode = 'create' | 'detail' | 'edit';
type FormPayload = Omit<
    VoucherFormProps,
    'embedded' | 'onSuccess' | 'onDirtyChange'
>;
type ReferencePayload = Omit<
    VoucherReferenceFormProps,
    'embedded' | 'onSuccess' | 'onDirtyChange'
>;
type Payload = FormPayload | ReferencePayload | { voucher: Voucher };

type VoucherDialogsContextValue = {
    openCreate: () => void;
    openDetail: (voucherId: number) => void;
    openEdit: (voucherId: number) => void;
};

const VoucherDialogsContext = createContext<VoucherDialogsContextValue | null>(
    null,
);

export function VoucherDialogsProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<DialogMode | null>(null);
    const [voucherId, setVoucherId] = useState<number | null>(null);
    const [payload, setPayload] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dirty, setDirty] = useState(false);

    const load = useCallback(async (nextMode: DialogMode, id?: number) => {
        const path =
            nextMode === 'create'
                ? '/vouchers/create'
                : `/vouchers/${id}${nextMode === 'edit' ? '/edit' : ''}`;

        setMode(nextMode);
        setVoucherId(id ?? null);
        setPayload(null);
        setError('');
        setDirty(false);
        setLoading(true);

        try {
            const response = await fetch(path, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(
                    'No fue posible cargar la información del vale.',
                );
            }

            setPayload((await response.json()) as Payload);
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : 'No fue posible cargar la información del vale.',
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const close = useCallback(() => {
        if (
            dirty &&
            !window.confirm(
                'Hay cambios sin guardar. ¿Deseas cerrar el formulario?',
            )
        ) {
            return;
        }

        setMode(null);
        setVoucherId(null);
        setPayload(null);
        setDirty(false);
        setError('');
    }, [dirty]);

    const success = useCallback(() => {
        setDirty(false);
        setMode(null);
        setPayload(null);
    }, []);

    const value = useMemo<VoucherDialogsContextValue>(
        () => ({
            openCreate: () => void load('create'),
            openDetail: (id) => void load('detail', id),
            openEdit: (id) => void load('edit', id),
        }),
        [load],
    );

    const refreshDetail = useCallback(() => {
        if (voucherId === null) {
            return;
        }

        void fetch(`/vouchers/${voucherId}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        'No fue posible actualizar el detalle del vale.',
                    );
                }

                setPayload((await response.json()) as Payload);
            })
            .catch((refreshError) => {
                setError(
                    refreshError instanceof Error
                        ? refreshError.message
                        : 'No fue posible actualizar el detalle del vale.',
                );
            });
    }, [voucherId]);

    return (
        <VoucherDialogsContext.Provider value={value}>
            {children}
            <Dialog
                open={mode !== null}
                onOpenChange={(open) => !open && close()}
            >
                <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-y-auto p-3 sm:max-w-[min(96vw,1280px)] sm:p-5">
                    <DialogHeader className="sr-only">
                        <DialogTitle>
                            {mode === 'create'
                                ? 'Capturar vale'
                                : mode === 'edit'
                                  ? 'Editar vale'
                                  : 'Detalle del vale'}
                        </DialogTitle>
                        <DialogDescription>
                            Ventana de gestión de vales de material.
                        </DialogDescription>
                    </DialogHeader>
                    {loading && <VoucherDialogLoading />}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription className="flex flex-col gap-3">
                                <span>{error}</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        mode &&
                                        void load(mode, voucherId ?? undefined)
                                    }
                                >
                                    Intentar de nuevo
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    <Suspense fallback={<VoucherDialogLoading />}>
                        {!loading && !error && payload && mode === 'create' && (
                            <VoucherForm
                                {...(payload as FormPayload)}
                                embedded
                                onSuccess={success}
                                onDirtyChange={setDirty}
                            />
                        )}
                        {!loading &&
                            !error &&
                            payload &&
                            mode === 'edit' &&
                            ((payload as { voucher: Voucher }).voucher
                                .status === 'active' ? (
                                <VoucherForm
                                    {...(payload as FormPayload)}
                                    embedded
                                    onSuccess={success}
                                    onDirtyChange={setDirty}
                                />
                            ) : (
                                <VoucherReferenceForm
                                    {...(payload as ReferencePayload)}
                                    embedded
                                    onSuccess={success}
                                    onDirtyChange={setDirty}
                                />
                            ))}
                        {!loading && !error && payload && mode === 'detail' && (
                            <VoucherShow
                                voucher={
                                    (payload as { voucher: Voucher }).voucher
                                }
                                embedded
                                onEdit={() =>
                                    voucherId !== null &&
                                    void load('edit', voucherId)
                                }
                                onRefresh={refreshDetail}
                            />
                        )}
                    </Suspense>
                </DialogContent>
            </Dialog>
        </VoucherDialogsContext.Provider>
    );
}

function VoucherDialogLoading() {
    return (
        <div
            className="flex min-h-80 flex-col gap-5 p-4"
            aria-label="Cargando vale"
        >
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
    );
}

export function useVoucherDialogs() {
    const context = useContext(VoucherDialogsContext);

    if (!context) {
        throw new Error(
            'useVoucherDialogs debe usarse dentro de VoucherDialogsProvider.',
        );
    }

    return context;
}

export function VoucherModalLink({
    mode,
    voucherId,
    children,
    className,
}: {
    mode: DialogMode;
    voucherId?: number;
    children: ReactNode;
    className?: string;
}) {
    const dialogs = useVoucherDialogs();
    const href =
        mode === 'create'
            ? '/vouchers/create'
            : `/vouchers/${voucherId}${mode === 'edit' ? '/edit' : ''}`;
    const open = (event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();

        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        event.preventDefault();

        if (mode === 'create') {
            dialogs.openCreate();
        } else if (mode === 'edit' && voucherId !== undefined) {
            dialogs.openEdit(voucherId);
        } else if (voucherId !== undefined) {
            dialogs.openDetail(voucherId);
        }
    };

    return (
        <a href={href} className={className} onClick={open}>
            {children}
        </a>
    );
}
