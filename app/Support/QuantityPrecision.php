<?php

namespace App\Support;

use App\Models\Material;
use App\Models\MaterialApplication;
use App\Models\Unit;

final class QuantityPrecision
{
    public const MAX_VALUE = 999999999;

    public const MAX_DECIMAL_PLACES = 3;

    public static function accepts(mixed $value, int $decimalPlaces): bool
    {
        $text = trim((string) $value);
        if (! preg_match('/^-?\d+(?:\.\d+)?$/', $text)) {
            return false;
        }

        $fraction = str_contains($text, '.')
            ? rtrim(substr($text, strpos($text, '.') + 1), '0')
            : '';

        $maximumDecimalPlaces = $decimalPlaces > 0 ? self::MAX_DECIMAL_PLACES : 0;

        return strlen($fraction) <= $maximumDecimalPlaces;
    }

    public static function message(Unit $unit): string
    {
        return $unit->decimal_places === 0
            ? "La cantidad de {$unit->name} debe ser un número entero."
            : "La cantidad de {$unit->name} admite como máximo tres decimales.";
    }

    public static function format(string|int|float $value): string
    {
        $formatted = number_format((float) $value, 3, '.', '');
        $compact = rtrim(rtrim($formatted, '0'), '.');

        return $compact === '-0' ? '0' : $compact;
    }

    public static function materialHasIncompatibleHistory(Material $material, int $decimalPlaces): bool
    {
        if ($material->voucherItems()->get(['id', 'quantity'])->contains(
            fn ($item): bool => ! self::accepts($item->quantity, $decimalPlaces),
        )) {
            return true;
        }

        return MaterialApplication::query()
            ->whereHas('item', fn ($query) => $query->where('material_id', $material->id))
            ->get(['id', 'quantity'])
            ->contains(fn (MaterialApplication $application): bool => ! self::accepts($application->quantity, $decimalPlaces));
    }

    public static function unitHasIncompatibleHistory(Unit $unit, int $decimalPlaces): bool
    {
        if ($unit->voucherItems()->get(['id', 'quantity'])->contains(
            fn ($item): bool => ! self::accepts($item->quantity, $decimalPlaces),
        )) {
            return true;
        }

        if (MaterialApplication::query()
            ->whereHas('item', fn ($query) => $query->where('unit_id', $unit->id))
            ->get(['id', 'quantity'])
            ->contains(fn (MaterialApplication $application): bool => ! self::accepts($application->quantity, $decimalPlaces))) {
            return true;
        }

        return $unit->inventoryAdjustments()->get(['id', 'quantity_delta'])->contains(
            fn ($adjustment): bool => ! self::accepts($adjustment->quantity_delta, $decimalPlaces),
        );
    }
}
