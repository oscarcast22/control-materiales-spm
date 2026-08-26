import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({
    title = 'No fue posible cargar la información',
    description = 'Intenta nuevamente. Si el problema continúa, conserva los datos que estabas capturando.',
    onRetry,
}: {
    title?: string;
    description?: string;
    onRetry?: () => void;
}) {
    return (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-subtle p-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-surface text-danger">
                <AlertCircle aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{title}</h2>
            <p className="mt-1 max-w-md text-sm text-text-secondary">
                {description}
            </p>
            {onRetry && (
                <Button className="mt-4" variant="outline" onClick={onRetry}>
                    <RotateCcw data-icon="inline-start" />
                    Reintentar
                </Button>
            )}
        </div>
    );
}
