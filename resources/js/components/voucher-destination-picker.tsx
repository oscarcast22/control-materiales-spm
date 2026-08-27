import { MapPin, X } from 'lucide-react';
import { useMemo } from 'react';
import { SearchableSelect } from '@/components/searchable-select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChoiceOption, Destination } from '@/types';

const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-MX')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

type Props = {
    id: string;
    destinations: Destination[];
    selectedIds: string[];
    newDestinations: string[];
    onSelectedIdsChange: (ids: string[]) => void;
    onNewDestinationsChange: (names: string[]) => void;
    invalid?: boolean;
    describedBy?: string;
};

export function VoucherDestinationPicker({
    id,
    destinations,
    selectedIds,
    newDestinations,
    onSelectedIdsChange,
    onNewDestinationsChange,
    invalid = false,
    describedBy,
}: Props) {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const options = useMemo<ChoiceOption[]>(
        () => [
            ...destinations.map((destination) => ({
                value: String(destination.id),
                label: destination.name,
                searchTerms: destination.aliases?.map((alias) => alias.alias),
                description: selectedSet.has(String(destination.id))
                    ? 'Ya seleccionada'
                    : destination.needs_review
                      ? 'Nombre pendiente de revisión'
                      : undefined,
                disabled: selectedSet.has(String(destination.id)),
            })),
            ...newDestinations.map((name) => ({
                value: `new:${normalize(name)}`,
                label: name,
                description: 'Ubicación nueva, se guardará con el vale',
                disabled: true,
            })),
        ],
        [destinations, newDestinations, selectedSet],
    );
    const selected = [
        ...selectedIds.flatMap((selectedId) => {
            const destination = destinations.find(
                (item) => String(item.id) === selectedId,
            );

            return destination
                ? [{ key: `id:${selectedId}`, label: destination.name }]
                : [];
        }),
        ...newDestinations.map((name) => ({
            key: `new:${normalize(name)}`,
            label: name,
        })),
    ];

    const createDestination = (name: string) => {
        const key = normalize(name);
        const alreadySelected = selected.some(
            (destination) => normalize(destination.label) === key,
        );

        if (!alreadySelected) {
            onNewDestinationsChange([...newDestinations, name.trim()]);
        }
    };

    const remove = (key: string) => {
        if (key.startsWith('id:')) {
            onSelectedIdsChange(
                selectedIds.filter((idValue) => `id:${idValue}` !== key),
            );
        } else {
            onNewDestinationsChange(
                newDestinations.filter(
                    (name) => `new:${normalize(name)}` !== key,
                ),
            );
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <SearchableSelect
                id={id}
                value=""
                onValueChange={(value) => {
                    if (value && !selectedSet.has(value)) {
                        onSelectedIdsChange([...selectedIds, value]);
                    }
                }}
                onCreate={createDestination}
                options={options}
                placeholder="Buscar o crear una ubicación"
                searchPlaceholder="Buscar colonia, poblado, calle…"
                emptyMessage="No encontramos esa ubicación."
                invalid={invalid}
                describedBy={describedBy}
            />
            {selected.length > 0 && (
                <div
                    className="flex flex-wrap gap-2"
                    aria-label="Ubicaciones seleccionadas"
                >
                    {selected.map((destination) => (
                        <span
                            key={destination.key}
                            className={cn(
                                'inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary-subtle/40 py-1 pr-1 pl-3 text-sm font-medium text-primary',
                                destination.key.startsWith('new:') &&
                                    'border-dashed',
                            )}
                        >
                            <MapPin
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            <span className="truncate">
                                {destination.label}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => remove(destination.key)}
                                aria-label={`Quitar ${destination.label}`}
                                className="size-7 rounded-full text-primary hover:bg-primary/10"
                            >
                                <X aria-hidden="true" />
                            </Button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
