<?php

namespace App\Support;

use JsonException;
use RuntimeException;

final class CuratedDestinationCatalog
{
    /** @return list<array{name: string, aliases: list<string>, needs_review: bool}> */
    public function destinations(): array
    {
        $rows = $this->json('destinations.json');
        $result = [];

        foreach ($rows as $row) {
            if (! is_array($row) || ! is_string($row['name'] ?? null) || ! is_bool($row['needs_review'] ?? null)) {
                throw new RuntimeException('El catálogo de ubicaciones contiene un registro inválido.');
            }
            $result[] = [
                'name' => $row['name'],
                'aliases' => $this->strings($row['aliases'] ?? null, 'ubicaciones'),
                'needs_review' => $row['needs_review'],
            ];
        }

        return $result;
    }

    /** @return array<string, array{destinations: list<string>, usage_description: string|null, needs_review: bool}> */
    public function legacyMappings(): array
    {
        $result = [];
        foreach ($this->json('legacy-destination-mappings.json') as $row) {
            if (
                ! is_array($row)
                || ! is_string($row['source'] ?? null)
                || ! is_bool($row['needs_review'] ?? null)
                || (! is_null($row['usage_description'] ?? null) && ! is_string($row['usage_description']))
            ) {
                throw new RuntimeException('El mapeo histórico de destinos contiene un registro inválido.');
            }
            $key = Normalizer::key($row['source']);
            if ($key === '' || isset($result[$key])) {
                throw new RuntimeException('El mapeo histórico de destinos contiene una fuente vacía o duplicada.');
            }
            $result[$key] = [
                'destinations' => $this->strings($row['destinations'] ?? null, 'mapeo de destinos'),
                'usage_description' => $row['usage_description'],
                'needs_review' => $row['needs_review'],
            ];
        }

        return $result;
    }

    /** @return list<string> */
    private function strings(mixed $value, string $catalog): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            throw new RuntimeException("El catálogo de {$catalog} contiene una lista inválida.");
        }
        foreach ($value as $item) {
            if (! is_string($item)) {
                throw new RuntimeException("El catálogo de {$catalog} contiene un texto inválido.");
            }
        }

        return $value;
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
