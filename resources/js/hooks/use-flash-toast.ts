import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types';

const isFlashToast = (value: unknown): value is FlashToast =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'message' in value &&
    typeof value.type === 'string' &&
    ['success', 'info', 'warning', 'error'].includes(value.type) &&
    typeof value.message === 'string';

export function useFlashToast(): void {
    useEffect(() => {
        return router.on('flash', (event) => {
            const data = (event.detail.flash as { toast?: unknown }).toast;

            if (!isFlashToast(data)) {
                return;
            }

            toast[data.type](data.message);
        });
    }, []);
}
