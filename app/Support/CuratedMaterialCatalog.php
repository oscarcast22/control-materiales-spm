<?php

namespace App\Support;

use JsonException;
use RuntimeException;

final class CuratedMaterialCatalog
{
    /** @return list<array{name: string, symbol: string}> */
    public function units(): array
    {
        return [
            ['name' => 'Pieza', 'symbol' => 'pza'],
            ['name' => 'Metro', 'symbol' => 'm'],
            ['name' => 'Kilogramo', 'symbol' => 'kg'],
            ['name' => 'Metro cúbico', 'symbol' => 'm³'],
            ['name' => 'Rollo', 'symbol' => 'rollo'],
            ['name' => 'Juego', 'symbol' => 'jgo'],
            ['name' => 'Unidad sin especificar', 'symbol' => 's/e'],
        ];
    }

    /** @return list<array{name: string, unit: string, aliases: list<string>}> */
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

            $result[] = [
                'name' => $row['name'],
                'unit' => $row['unit'],
                'aliases' => $aliases,
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
