import { Input } from '@/components/ui/input';
import type { MaterialApplicationFormOptions } from '@/types';

export function ApplicationLocationInput({
    id,
    value,
    onValueChange,
    destinations,
    invalid = false,
    describedBy,
}: {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    destinations: MaterialApplicationFormOptions['destinations'];
    invalid?: boolean;
    describedBy?: string;
}) {
    const listId = `${id}-suggestions`;

    return (
        <>
            <Input
                id={id}
                list={listId}
                value={value}
                maxLength={500}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder="Escribe una dirección o busca una ubicación"
                autoComplete="off"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
            />
            <datalist id={listId}>
                {destinations.map((destination) => (
                    <option
                        key={destination.id}
                        value={destination.name}
                        label={destination.aliases
                            ?.map((alias) => alias.alias)
                            .join(', ')}
                    />
                ))}
            </datalist>
        </>
    );
}
