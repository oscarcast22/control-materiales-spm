import { Check, ChevronsUpDown, CircleX, Plus } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { ChoiceOption } from '@/types';

const EMPTY_VALUE = '__empty_choice__';

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-MX')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const filterChoice = (
    value: string,
    search: string,
    keywords: string[] | undefined,
) => {
    const tokens = normalizeSearchText(search).split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
        return 1;
    }

    const haystack = normalizeSearchText(
        [value, ...(keywords ?? [])].join(' '),
    );

    return tokens.every((token) => haystack.includes(token)) ? 1 : 0;
};

type SearchableSelectProps = {
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    options: ChoiceOption[];
    placeholder: string;
    searchPlaceholder: string;
    emptyMessage: string;
    emptyLabel?: string;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    className?: string;
    onCreate?: (label: string) => void;
    createLabel?: (label: string) => string;
};

export function SearchableSelect({
    id,
    value,
    onValueChange,
    options,
    placeholder,
    searchPlaceholder,
    emptyMessage,
    emptyLabel,
    disabled = false,
    invalid = false,
    describedBy,
    className,
    onCreate,
    createLabel = (label) => `Crear ubicación “${label}”`,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const selected = useMemo(
        () => options.find((option) => option.value === value),
        [options, value],
    );
    const visibleLabel = selected?.label ?? emptyLabel ?? placeholder;
    const trimmedQuery = query.trim();
    const normalizedQuery = normalizeSearchText(trimmedQuery);
    const canCreate =
        Boolean(onCreate) &&
        trimmedQuery.length > 1 &&
        !options.some((option) =>
            [option.label, ...(option.searchTerms ?? [])].some(
                (term) => normalizeSearchText(term) === normalizedQuery,
            ),
        );

    const choose = (nextValue: string) => {
        onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue);
        setQuery('');
        setOpen(false);
    };

    const create = () => {
        if (!onCreate || !canCreate) {
            return;
        }

        onCreate(trimmedQuery);
        setQuery('');
        setOpen(false);
    };

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);

                if (!nextOpen) {
                    setQuery('');
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-controls={open ? `${id}-listbox` : undefined}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    disabled={disabled}
                    className={cn(
                        'h-10 w-full min-w-0 justify-between px-4 text-left font-normal',
                        className,
                    )}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                            className={cn(
                                'min-w-0 truncate',
                                !selected && 'text-muted-foreground',
                            )}
                        >
                            {visibleLabel}
                        </span>
                        {selected?.meta && (
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                {selected.meta}
                            </span>
                        )}
                    </span>
                    <ChevronsUpDown
                        data-icon="inline-end"
                        className="shrink-0 opacity-55"
                        aria-hidden="true"
                    />
                </Button>
            </PopoverTrigger>
            {open && (
                <PopoverContent
                    align="start"
                    className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) min-w-[min(18rem,var(--radix-popover-trigger-width))] p-0"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        inputRef.current?.focus();
                    }}
                >
                    <Command filter={filterChoice}>
                        <CommandInput
                            ref={inputRef}
                            value={query}
                            onValueChange={setQuery}
                            placeholder={searchPlaceholder}
                            aria-label={searchPlaceholder}
                        />
                        <CommandList id={`${id}-listbox`}>
                            <CommandEmpty>{emptyMessage}</CommandEmpty>
                            <CommandGroup>
                                {emptyLabel && (
                                    <CommandItem
                                        value={EMPTY_VALUE}
                                        keywords={[emptyLabel]}
                                        onSelect={choose}
                                    >
                                        <CircleX
                                            className="text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                        <span>{emptyLabel}</span>
                                        {!value && (
                                            <Check
                                                className="ml-auto text-primary"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </CommandItem>
                                )}
                                {options.map((option) => (
                                    <CommandItem
                                        key={option.value}
                                        value={option.value}
                                        keywords={[
                                            option.label,
                                            ...(option.searchTerms ?? []),
                                        ]}
                                        disabled={option.disabled}
                                        onSelect={choose}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="flex min-w-0 items-baseline justify-between gap-3">
                                                <span className="min-w-0 truncate font-medium">
                                                    {option.label}
                                                </span>
                                                {option.meta && (
                                                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                                                        {option.meta}
                                                    </span>
                                                )}
                                            </span>
                                            {option.description && (
                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                        {value === option.value && (
                                            <Check
                                                className="ml-auto text-primary"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </CommandItem>
                                ))}
                                {canCreate && (
                                    <CommandItem
                                        forceMount
                                        value={`create-${trimmedQuery}`}
                                        keywords={[trimmedQuery]}
                                        onSelect={create}
                                        className="mt-1 border border-dashed border-primary/30 bg-primary-subtle/30 text-primary"
                                    >
                                        <Plus aria-hidden="true" />
                                        <span className="font-semibold">
                                            {createLabel(trimmedQuery)}
                                        </span>
                                    </CommandItem>
                                )}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            )}
        </Popover>
    );
}
