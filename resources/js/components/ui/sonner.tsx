import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const toastIcons = {
    success: (
        <span className="app-toast-status-icon">
            <span className="sr-only">Éxito: </span>
            <CircleCheck aria-hidden="true" />
        </span>
    ),
    info: (
        <span className="app-toast-status-icon">
            <span className="sr-only">Información: </span>
            <Info aria-hidden="true" />
        </span>
    ),
    warning: (
        <span className="app-toast-status-icon">
            <span className="sr-only">Advertencia: </span>
            <TriangleAlert aria-hidden="true" />
        </span>
    ),
    error: (
        <span className="app-toast-status-icon">
            <span className="sr-only">Error: </span>
            <CircleX aria-hidden="true" />
        </span>
    ),
};

function Toaster({
    className,
    closeButton = true,
    mobileOffset = { top: 12, right: 12, left: 12 },
    offset = { top: 20, right: 24 },
    position = 'top-right',
    style,
    toastOptions,
    ...props
}: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className={cn('toaster app-toaster group', className)}
            closeButton={closeButton}
            icons={toastIcons}
            mobileOffset={mobileOffset}
            offset={offset}
            position={position}
            style={
                {
                    '--normal-bg': 'var(--glass-strong)',
                    '--normal-text': 'var(--text-primary)',
                    '--normal-border': 'var(--border)',
                    '--width': '380px',
                    ...style,
                } as React.CSSProperties
            }
            toastOptions={{
                ...toastOptions,
                closeButtonAriaLabel:
                    toastOptions?.closeButtonAriaLabel ??
                    'Cerrar notificación',
                classNames: {
                    toast: 'app-toast',
                    title: 'app-toast-title',
                    description: 'app-toast-description',
                    icon: 'app-toast-icon-slot',
                    closeButton: 'app-toast-close',
                    ...toastOptions?.classNames,
                },
            }}
            {...props}
        />
    );
}

export { Toaster };
