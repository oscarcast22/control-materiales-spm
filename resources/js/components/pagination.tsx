import { Button } from '@/components/ui/button';

export function Pagination({
    from,
    to,
    total,
    hasPrevious,
    hasNext,
    onPrevious,
    onNext,
    label = 'registros',
}: {
    from: number | null;
    to: number | null;
    total: number;
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    label?: string;
}) {
    return (
        <nav
            aria-label="Paginación"
            className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
            <span aria-live="polite">
                Mostrando {from ?? 0}–{to ?? 0} de {total} {label}
            </span>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrevious}
                    onClick={onPrevious}
                >
                    Anterior
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={onNext}
                >
                    Siguiente
                </Button>
            </div>
        </nav>
    );
}
