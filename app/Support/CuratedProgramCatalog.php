<?php

namespace App\Support;

use JsonException;
use RuntimeException;

final class CuratedProgramCatalog
{
    /**
     * @return array{
     *     code: string,
     *     name: string,
     *     actions: list<array{code: string, name: string, indicators: list<array{code: string, name: string}>}>
     * }
     */
    public function program(): array
    {
        $contents = file_get_contents(database_path('data/program-actions.json'));
        if ($contents === false) {
            throw new RuntimeException('No se pudo leer database/data/program-actions.json.');
        }

        try {
            $data = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('El catálogo de programa y acciones no contiene JSON válido.', previous: $exception);
        }

        if (! is_array($data)
            || ! preg_match('/^SPM-\d{2}$/', (string) ($data['code'] ?? ''))
            || ! is_string($data['name'] ?? null)
            || ! is_array($data['actions'] ?? null)
            || ! array_is_list($data['actions'])) {
            throw new RuntimeException('El catálogo de programa y acciones tiene una estructura inválida.');
        }

        $actions = [];
        $actionCodes = [];
        $indicatorCodes = [];
        foreach ($data['actions'] as $row) {
            if (! is_array($row)
                || ! is_string($row['code'] ?? null)
                || ! str_starts_with($row['code'], $data['code'].'-')
                || preg_match('/^SPM-\d{2}-\d{2}$/', $row['code']) !== 1
                || ! is_string($row['name'] ?? null)
                || trim($row['name']) === ''
                || ! is_array($row['indicators'] ?? null)
                || ! array_is_list($row['indicators'])
                || $row['indicators'] === []) {
                throw new RuntimeException('El catálogo contiene una acción inválida.');
            }
            if (in_array($row['code'], $actionCodes, true)) {
                throw new RuntimeException("La acción {$row['code']} está duplicada.");
            }
            $actionCodes[] = $row['code'];

            $indicators = [];
            foreach ($row['indicators'] as $indicator) {
                if (! is_array($indicator)
                    || ! is_string($indicator['code'] ?? null)
                    || ! is_string($indicator['name'] ?? null)
                    || trim($indicator['name']) === ''
                    || ($indicator['code'] !== $row['code']
                        && preg_match('/^'.preg_quote($row['code'], '/').'-\d{2}$/', $indicator['code']) !== 1)) {
                    throw new RuntimeException("La acción {$row['code']} contiene un indicador inválido.");
                }
                if (in_array($indicator['code'], $indicatorCodes, true)) {
                    throw new RuntimeException("El indicador {$indicator['code']} está duplicado.");
                }
                $indicatorCodes[] = $indicator['code'];
                $indicators[] = ['code' => $indicator['code'], 'name' => trim($indicator['name'])];
            }

            $actions[] = [
                'code' => $row['code'],
                'name' => trim($row['name']),
                'indicators' => $indicators,
            ];
        }

        return ['code' => $data['code'], 'name' => trim($data['name']), 'actions' => $actions];
    }
}
