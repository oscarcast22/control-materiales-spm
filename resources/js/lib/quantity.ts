import type { Unit } from '@/types';

export const quantityForInput = (quantity: string) =>
    quantity.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');

export const quantityInput = (unit?: Pick<Unit, 'decimal_places'>) => {
    const allowsDecimal = unit?.decimal_places === 1;

    return {
        inputMode: allowsDecimal ? ('decimal' as const) : ('numeric' as const),
        pattern: allowsDecimal ? '[0-9]+([.][0-9]{1,3})?' : '[0-9]*',
        placeholder: allowsDecimal ? 'Ej. 1.5' : 'Ej. 1',
    };
};

export const isPositiveQuantity = (
    value: string,
    unit?: Pick<Unit, 'decimal_places'>,
) => {
    const normalized = value.trim();
    const pattern =
        unit?.decimal_places === 1 ? /^\d+(?:\.\d{1,3})?$/ : /^\d+$/;

    return pattern.test(normalized) && Number(normalized) > 0;
};
