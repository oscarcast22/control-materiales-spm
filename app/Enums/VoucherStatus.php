<?php

namespace App\Enums;

enum VoucherStatus: string
{
    case Active = 'active';
    case Loaned = 'loaned';
    case Cancelled = 'cancelled';

    /** @return list<string> */
    public static function operationalValues(): array
    {
        return [self::Active->value];
    }
}
