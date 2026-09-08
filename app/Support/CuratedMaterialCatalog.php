<?php

namespace App\Support;

use JsonException;
use RuntimeException;

final class CuratedMaterialCatalog
{
    /** @return list<array{name: string, symbol: string, decimal_places: int}> */
    public function units(): array
    {
        return [
            ['name' => 'Pieza', 'symbol' => 'pza', 'decimal_places' => 0],
            ['name' => 'Metro', 'symbol' => 'm', 'decimal_places' => 1],
            ['name' => 'Litro', 'symbol' => 'L', 'decimal_places' => 1],
            ['name' => 'Kilogramo', 'symbol' => 'kg', 'decimal_places' => 0],
            ['name' => 'Metro cúbico', 'symbol' => 'm³', 'decimal_places' => 0],
            ['name' => 'Rollo', 'symbol' => 'rollo', 'decimal_places' => 0],
            ['name' => 'Juego', 'symbol' => 'jgo', 'decimal_places' => 0],
            ['name' => 'Unidad sin especificar', 'symbol' => 's/e', 'decimal_places' => 0],
        ];
    }

    /** @return list<array{name: string, unit: string, aliases: list<string>, voucher_types: list<string>, needs_review: bool, is_luminaire: bool}> */
    public function materials(): array
    {
        $rows = $this->json('materials.json');
        $result = [];

        foreach ($rows as $row) {
            if (! is_array($row) || ! is_string($row['name'] ?? null) || ! is_string($row['unit'] ?? null)) {
                throw new RuntimeException('El catálogo de materiales contiene un registro inválido.');
            }

            $aliases = $row['aliases'] ?? null;
            if (! is_array($aliases) || ! array_is_list($aliases)) {
                throw new RuntimeException('El catálogo de materiales contiene alias inválidos.');
            }
            foreach ($aliases as $alias) {
                if (! is_string($alias)) {
                    throw new RuntimeException('El catálogo de materiales contiene un alias inválido.');
                }
            }

            $voucherTypes = $row['voucher_types'] ?? null;
            if (! is_array($voucherTypes) || ! array_is_list($voucherTypes) || $voucherTypes === []) {
                throw new RuntimeException('El catálogo de materiales contiene tipos de vale inválidos.');
            }
            foreach ($voucherTypes as $voucherType) {
                if (! is_string($voucherType) || ! in_array($voucherType, ['warehouse', 'yard'], true)) {
                    throw new RuntimeException('El catálogo de materiales contiene un tipo de vale desconocido.');
                }
            }

            $needsReview = $row['needs_review'] ?? false;
            if (! is_bool($needsReview)) {
                throw new RuntimeException('El catálogo de materiales contiene un indicador de revisión inválido.');
            }

            $normalizedName = Normalizer::key($row['name']);
            $isLuminaire = $row['is_luminaire'] ?? (
                str_starts_with($normalizedName, 'luminaria')
                || str_starts_with($normalizedName, 'luminario')
                || str_starts_with($normalizedName, 'lnuminaria')
            );
            if (! is_bool($isLuminaire)) {
                throw new RuntimeException('El catálogo de materiales contiene una clasificación de luminaria inválida.');
            }

            $result[] = [
                'name' => $row['name'],
                'unit' => $row['unit'],
                'aliases' => $aliases,
                'voucher_types' => array_values(array_unique($voucherTypes)),
                'needs_review' => $needsReview,
                'is_luminaire' => $isLuminaire,
            ];
        }

        return $result;
    }

    /** @return list<mixed> */
    private function json(string $file): array
    {
        $contents = file_get_contents(database_path("data/{$file}"));
        if ($contents === false) {
            throw new RuntimeException("No se pudo leer database/data/{$file}.");
        }

        try {
            $data = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException("El archivo {$file} no contiene JSON válido.", previous: $exception);
        }

        if (! is_array($data) || ! array_is_list($data)) {
            throw new RuntimeException("El archivo {$file} debe contener una lista.");
        }

        return $data;
    }
}
