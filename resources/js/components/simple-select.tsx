import type { ComponentProps } from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ChoiceOption } from '@/types';

const EMPTY_VALUE = '__empty_choice__';

type SimpleSelectProps = {
    id: string;
    ariaLabel?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: ChoiceOption[];
    placeholder: string;
    emptyLabel?: string;
    disabled?: boolean;
    invalid?: boolean;
    describedBy?: string;
    size?: ComponentProps<typeof SelectTrigger>['size'];
};

export function SimpleSelect({
    id,
    ariaLabel,
    value,
    onValueChange,
    options,
    placeholder,
    emptyLabel,
    disabled = false,
    invalid = false,
    describedBy,
    size = 'default',
}: SimpleSelectProps) {
    const selectValue = value || EMPTY_VALUE;

    return (
        <Select
            value={selectValue}
            onValueChange={(nextValue) =>
                onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue)
            }
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                aria-label={ariaLabel}
                size={size}
                className="w-full"
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
                <SelectGroup>
                    <SelectItem value={EMPTY_VALUE} disabled={!emptyLabel}>
                        {emptyLabel ?? placeholder}
                    </SelectItem>
                    {options.map((option) => (
                        <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={option.disabled}
                        >
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
}
