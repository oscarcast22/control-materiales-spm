<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeInterface;
use OpenSpout\Reader\XLSX\Options;
use OpenSpout\Reader\XLSX\Reader;
use RuntimeException;

final class LegacyControlWorkbook
{
    private const SHEETS = [
        'vale de almacen' => ['code' => 'warehouse', 'name' => 'Almacén'],
        'vale de patio' => ['code' => 'yard', 'name' => 'Patio'],
    ];

    /**
     * @return list<array{
     *   sheet_name: string, row_number: int, voucher_type_code: string,
     *   voucher_type_name: string, folio: string, raw_status: string,
     *   date: string|null, program: string, action: string, destination: string,
     *   receiver: string, deliverer: string,
     *   items: list<array{material: string, quantity: float}>, raw_data: array<string, mixed>
     * }>
     */
    public function read(string $path): array
    {
        $reader = new Reader(new Options(SHOULD_PRESERVE_EMPTY_ROWS: true));
        $reader->open($path);
        $rows = [];
        $found = [];

        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                $sheetKey = Normalizer::key($sheet->getName());
                if (! isset(self::SHEETS[$sheetKey])) {
                    continue;
                }

                $found[$sheetKey] = true;
                $header = null;
                $indexes = [];
                foreach ($sheet->getRowIterator() as $rowNumber => $row) {
                    $values = $row->toArray();
                    if ($header === null) {
                        $candidate = array_values(array_map(fn (mixed $value): string => Normalizer::key($this->scalar($value)), $values));
                        if (array_search('folio', $candidate, true) === false) {
                            continue;
                        }
                        $header = array_map(fn (mixed $value): string => $this->scalar($value), $values);
                        $indexes = $this->indexes($candidate, $sheetKey);

                        continue;
                    }

                    $date = $this->dateValue($values[$indexes['date']] ?? null);
                    if ($date === null || ! str_starts_with($date, '2026-08-')) {
                        continue;
                    }

                    $items = [];
                    for ($column = $indexes['materials']; $column < count($header); $column++) {
                        $material = trim($header[$column] ?? '');
                        $quantity = $this->number($values[$column] ?? null);
                        if ($material !== '' && $quantity !== null && $quantity > 0) {
                            $items[] = ['material' => $material, 'quantity' => $quantity];
                        }
                    }

                    $metadata = self::SHEETS[$sheetKey];
                    $rawData = [];
                    foreach ($indexes as $key => $index) {
                        if ($key !== 'materials') {
                            $rawData[$key] = $this->scalar($values[$index] ?? null);
                        }
                    }
                    $rawData['items'] = $items;

                    $rows[] = [
                        'sheet_name' => $sheet->getName(),
                        'row_number' => $rowNumber,
                        'voucher_type_code' => $metadata['code'],
                        'voucher_type_name' => $metadata['name'],
                        'folio' => $this->scalar($values[$indexes['folio']] ?? null),
                        'raw_status' => $this->scalar($values[$indexes['status']] ?? null),
                        'date' => $date,
                        'program' => isset($indexes['program']) ? $this->scalar($values[$indexes['program']] ?? null) : '',
                        'action' => isset($indexes['action']) ? $this->scalar($values[$indexes['action']] ?? null) : '',
                        'destination' => $this->scalar($values[$indexes['destination']] ?? null),
                        'receiver' => $this->scalar($values[$indexes['receiver']] ?? null),
                        'deliverer' => $this->scalar($values[$indexes['deliverer']] ?? null),
                        'items' => $items,
                        'raw_data' => $rawData,
                    ];
                }
            }
        } finally {
            $reader->close();
        }

        foreach (array_keys(self::SHEETS) as $requiredSheet) {
            if (! isset($found[$requiredSheet])) {
                throw new RuntimeException("No se encontró la hoja requerida: {$requiredSheet}.");
            }
        }
        if ($rows === []) {
            throw new RuntimeException('No se encontraron vales de agosto de 2026 en las hojas esperadas.');
        }

        return $rows;
    }

    /** @param list<string> $header
     * @return array<string, int>
     */
    private function indexes(array $header, string $sheet): array
    {
        $labels = [
            'folio' => 'folio',
            'status' => 'entrada o salida',
            'date' => 'fecha',
            'destination' => 'destino',
            'receiver' => 'recibio material',
            'deliverer' => 'entrego material',
        ];
        if ($sheet === 'vale de almacen') {
            $labels['program'] = 'programa spm';
            $labels['action'] = 'accion spm 06';
        }

        $indexes = [];
        foreach ($labels as $key => $label) {
            $index = array_search($label, $header, true);
            if ($index === false) {
                throw new RuntimeException("La hoja {$sheet} no contiene la columna {$label}.");
            }
            $indexes[$key] = $index;
        }
        $indexes['materials'] = $indexes['deliverer'] + 1;

        return $indexes;
    }

    private function scalar(mixed $value): string
    {
        return trim($value instanceof DateTimeInterface ? $value->format('Y-m-d') : (string) ($value ?? ''));
    }

    private function number(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function dateValue(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value)) {
            return (new DateTimeImmutable('1899-12-30'))->modify('+'.(int) $value.' days')->format('Y-m-d');
        }

        $text = trim((string) ($value ?? ''));
        foreach (['!Y-m-d', '!d/m/Y', '!d/m/y', '!d-m-Y', '!d-m-y'] as $format) {
            $date = DateTimeImmutable::createFromFormat($format, $text);
            $errors = DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }
}
