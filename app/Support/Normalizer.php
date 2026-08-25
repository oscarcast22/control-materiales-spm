<?php

namespace App\Support;

use Illuminate\Support\Str;

final class Normalizer
{
    public static function key(?string $value): string
    {
        return Str::of($value ?? '')
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/u', ' ')
            ->squish()
            ->value();
    }

    public static function folio(string $value): string
    {
        return Str::of($value)->ascii()->upper()->replaceMatches('/[^A-Z0-9]+/', '')->value();
    }
}
