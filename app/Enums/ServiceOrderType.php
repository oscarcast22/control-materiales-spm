<?php

namespace App\Enums;

enum ServiceOrderType: string
{
    case Normal = 'normal';
    case CitizenService072 = '072';

    public function label(): string
    {
        return match ($this) {
            self::Normal => 'Normal',
            self::CitizenService072 => '072',
        };
    }

    public static function default(): self
    {
        return self::Normal;
    }

    /** @return list<array{value: string, label: string}> */
    public static function options(): array
    {
        return array_map(
            fn (self $type): array => ['value' => $type->value, 'label' => $type->label()],
            self::cases(),
        );
    }
}
