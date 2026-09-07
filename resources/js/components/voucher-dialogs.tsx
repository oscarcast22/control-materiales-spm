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
import { DiscardChangesAlert } from '@/components/discard-changes-alert';
import { ModalBody, ModalContent } from '@/components/modal-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { VoucherFormProps } from '@/pages/vouchers/form';
import type { LoanedVoucherFormProps } from '@/pages/vouchers/loaned-form';
import type { VoucherReferenceFormProps } from '@/pages/vouchers/reference-form';
import type { MaterialApplicationFormOptions, Voucher } from '@/types';

const VoucherForm = lazy(() => import('@/pages/vouchers/form'));
const LoanedVoucherForm = lazy(() => import('@/pages/vouchers/loaned-form'));
const VoucherReferenceForm = lazy(
    () => import('@/pages/vouchers/reference-form'),
);
const VoucherShow = lazy(() => import('@/pages/vouchers/show'));

type DialogMode = 'create' | 'createLoaned' | 'detail' | 'edit';
type FormPayload = Omit<
    VoucherFormProps,
    'embedded' | 'onSuccess' | 'onDirtyChange' | 'onCancel'
>;
type ReferencePayload = Omit<
    VoucherReferenceFormProps,
    'embedded' | 'onSuccess' | 'onDirtyChange' | 'onCancel'
>;
type LoanedFormPayload = Omit<
    LoanedVoucherFormProps,
    'embedded' | 'onSuccess' | 'onDirtyChange' | 'onCancel'
>;
type DetailPayload = {
    voucher: Voucher;
    applicationFormOptions: MaterialApplicationFormOptions;
};
type Payload =
    FormPayload | LoanedFormPayload | ReferencePayload | DetailPayload;

type VoucherDialogsContextValue = {
    openCreate: () => void;
    openCreateLoaned: () => void;
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
    const [discardOpen, setDiscardOpen] = useState(false);
    const [discardAction, setDiscardAction] = useState<(() => void) | null>(
        null,
    );

    const load = useCallback(async (nextMode: DialogMode, id?: number) => {
        const path =
            nextMode === 'create'
                ? '/vouchers/create'
                : nextMode === 'createLoaned'
                  ? '/vouchers/create?kind=loaned'
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

    const reset = useCallback(() => {
        setMode(null);
        setVoucherId(null);
        setPayload(null);
        setDirty(false);
        setError('');
        setDiscardOpen(false);
        setDiscardAction(null);
    }, []);

    const requestDiscard = useCallback(
        (action: () => void) => {
            if (dirty) {
                setDiscardAction(() => action);
                setDiscardOpen(true);

                return;
            }

            action();
        },
        [dirty],
    );

    const close = useCallback(() => {
        requestDiscard(reset);
    }, [requestDiscard, reset]);

    const success = useCallback(() => {
        setDirty(false);
        setMode(null);
        setPayload(null);
    }, []);

    const backToDetail = useCallback(() => {
        if (voucherId === null) {
            close();

            return;
        }

        requestDiscard(() => void load('detail', voucherId));
    }, [close, load, requestDiscard, voucherId]);

    const value = useMemo<VoucherDialogsContextValue>(
        () => ({
            openCreate: () => void load('create'),
            openCreateLoaned: () => void load('createLoaned'),
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
                <ModalContent size="workspace">
                    {(loading || error || mode === 'detail') && (
                        <DialogHeader className="sr-only">
                            <DialogTitle>
                                {mode === 'create'
                                    ? 'Capturar vale'
                                    : mode === 'createLoaned'
                                      ? 'Registrar folio prestado'
                                      : mode === 'edit'
                                        ? 'Editar vale'
                                        : 'Detalle del vale'}
                            </DialogTitle>
                            <DialogDescription>
                                Ventana de gestión de vales de material.
                            </DialogDescription>
                        </DialogHeader>
                    )}
                    {loading && (
                        <ModalBody>
                            <VoucherDialogLoading />
                        </ModalBody>
                    )}
                    {error && (
                        <ModalBody>
                            <Alert variant="destructive">
                                <AlertDescription className="flex flex-col gap-3">
                                    <span>{error}</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            mode &&
                                            void load(
                                                mode,
                                                voucherId ?? undefined,
                                            )
                                        }
                                    >
                                        Intentar de nuevo
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        </ModalBody>
                    )}
                    <Suspense fallback={<VoucherDialogLoading />}>
                        {!loading && !error && payload && mode === 'create' && (
                            <VoucherForm
                                {...(payload as FormPayload)}
                                embedded
                                onSuccess={success}
                                onDirtyChange={setDirty}
                                onCancel={close}
                            />
                        )}
                        {!loading &&
                            !error &&
                            payload &&
                            mode === 'createLoaned' && (
                                <LoanedVoucherForm
                                    {...(payload as LoanedFormPayload)}
                                    embedded
                                    onSuccess={success}
                                    onDirtyChange={setDirty}
                                    onCancel={close}
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
                                    onCancel={backToDetail}
                                />
                            ) : (payload as { voucher: Voucher }).voucher
                                  .status === 'loaned' ? (
                                <LoanedVoucherForm
                                    {...(payload as LoanedFormPayload)}
                                    embedded
                                    onSuccess={success}
                                    onDirtyChange={setDirty}
                                    onCancel={backToDetail}
                                />
                            ) : (
                                <VoucherReferenceForm
                                    {...(payload as ReferencePayload)}
                                    embedded
                                    onSuccess={success}
                                    onDirtyChange={setDirty}
                                    onCancel={backToDetail}
                                />
                            ))}
                        {!loading && !error && payload && mode === 'detail' && (
                            <VoucherShow
                                voucher={(payload as DetailPayload).voucher}
                                applicationFormOptions={
                                    (payload as DetailPayload)
                                        .applicationFormOptions
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
                </ModalContent>
            </Dialog>
            <DiscardChangesAlert
                open={discardOpen}
                onOpenChange={setDiscardOpen}
                onDiscard={() => {
                    const action = discardAction ?? reset;

                    setDiscardAction(null);
                    action();
                }}
            />
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
            : mode === 'createLoaned'
              ? '/vouchers/create?kind=loaned'
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
        } else if (mode === 'createLoaned') {
            dialogs.openCreateLoaned();
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
