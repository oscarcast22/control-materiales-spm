<?php

namespace App\Support;

use DateTimeInterface;
use OpenSpout\Reader\XLSX\Options;
use OpenSpout\Reader\XLSX\Reader;
use RuntimeException;
use SimpleXMLElement;
use ZipArchive;

final class LegacyControlWorkbook
{
    /**
     * @return array<int, array{
     *     row_number: int,
     *     folio: string,
     *     technician: string,
     *     date: string|null,
     *     material: string,
     *     destination: string,
     *     quantity: float|null,
     *     difference: float|null,
     *     reports: array<int, array{slot: int, cell: string, quantity: float|null, comment: string|null}>,
     *     comments: array<string, string>
     * }>
     */
    public function read(string $path): array
    {
        $comments = $this->comments($path);
        $reader = new Reader(new Options(SHOULD_PRESERVE_EMPTY_ROWS: true));
        $reader->open($path);
        $result = [];
        $foundSheet = false;
        $foundHeader = false;

        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                if (Normalizer::key($sheet->getName()) !== 'victor') {
                    continue;
                }
                $foundSheet = true;
                foreach ($sheet->getRowIterator() as $rowNumber => $row) {
                    $values = $row->toArray();
                    if (Normalizer::key($this->scalar($values[1] ?? null)) === 'vale') {
                        $this->assertHeader($values);
                        $foundHeader = true;

                        continue;
                    }

                    $folio = $this->scalar($values[1] ?? null);
                    $material = $this->scalar($values[4] ?? null);
                    if ($folio === '' && $material === '') {
                        continue;
                    }

                    $reports = [];
                    for ($index = 8; $index <= 17; $index++) {
                        $slot = $index - 7;
                        $cell = $this->column($index).$rowNumber;
                        $reports[$slot] = [
                            'slot' => $slot,
                            'cell' => $cell,
                            'quantity' => $this->number($values[$index] ?? null),
                            'comment' => $comments[$cell] ?? null,
                        ];
                    }

                    $result[$rowNumber] = [
                        'row_number' => $rowNumber,
                        'folio' => $folio,
                        'technician' => $this->scalar($values[2] ?? null),
                        'date' => $this->dateValue($values[3] ?? null),
                        'material' => $material,
                        'destination' => $this->scalar($values[5] ?? null),
                        'quantity' => $this->number($values[6] ?? null),
                        'difference' => $this->number($values[7] ?? null),
                        'reports' => $reports,
                        'comments' => $this->rowComments($comments, $rowNumber),
                    ];
                }

                break;
            }
        } finally {
            $reader->close();
        }

        if (! $foundSheet) {
            throw new RuntimeException('No se encontró la hoja victor.');
        }
        if (! $foundHeader) {
            throw new RuntimeException('No se encontró el encabezado esperado en la hoja victor.');
        }
        if ($result === []) {
            throw new RuntimeException('No se encontró información en la hoja victor.');
        }

        return $result;
    }

    /** @param array<int, mixed> $values */
    private function assertHeader(array $values): void
    {
        $expected = [
            1 => 'vale',
            2 => 'tecnico',
            3 => 'fecha del vale',
            4 => 'descripcion',
            5 => 'destino',
            6 => 'cantidad',
            7 => 'diferencia',
        ];
        foreach ($expected as $index => $label) {
            if (Normalizer::key($this->scalar($values[$index] ?? null)) !== $label) {
                throw new RuntimeException('La estructura de la hoja victor no coincide con el formato esperado.');
            }
        }
        for ($index = 8; $index <= 17; $index++) {
            $slot = $index - 7;
            if (Normalizer::key($this->scalar($values[$index] ?? null)) !== "reporte {$slot}") {
                throw new RuntimeException('La estructura de columnas REPORTE no coincide con el formato esperado.');
            }
        }
    }

    /** @return array<string, string> */
    private function comments(string $path): array
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('No se pudo abrir el archivo XLSX para leer sus comentarios.');
        }

        try {
            $files = [];
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $name = $zip->getNameIndex($index);
                if (is_string($name) && preg_match('#^xl/comments\d+\.xml$#', $name)) {
                    $files[] = $name;
                }
            }
            if (count($files) > 1) {
                throw new RuntimeException('El libro contiene varias colecciones de comentarios y no se puede identificar la hoja victor con seguridad.');
            }
            if ($files === []) {
                return [];
            }

            $contents = $zip->getFromName($files[0]);
            if (! is_string($contents) || ($xml = simplexml_load_string($contents)) === false) {
                throw new RuntimeException('No se pudieron leer los comentarios del libro.');
            }

            return $this->commentMap($xml);
        } finally {
            $zip->close();
        }
    }

    /** @return array<string, string> */
    private function commentMap(SimpleXMLElement $xml): array
    {
        $comments = [];
        foreach ($xml->commentList->comment as $comment) {
            $parts = [];
            foreach ($comment->text->r as $run) {
                $parts[] = (string) $run->t;
            }
            if ($parts === []) {
                $parts[] = (string) $comment->text->t;
            }
            $comments[strtoupper((string) $comment['ref'])] = trim(implode('', $parts));
        }

        return $comments;
    }

    /** @param array<string, string> $comments
     * @return array<string, string>
     */
    private function rowComments(array $comments, int $rowNumber): array
    {
        return array_filter(
            $comments,
            fn (string $comment, string $cell): bool => preg_match('/^[A-Z]+'.$rowNumber.'$/', $cell) === 1,
            ARRAY_FILTER_USE_BOTH,
        );
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
            return (new \DateTimeImmutable('1899-12-30'))->modify('+'.(int) $value.' days')->format('Y-m-d');
        }
        $text = trim((string) ($value ?? ''));
        foreach (['!Y-m-d', '!d/m/Y', '!d/m/y', '!d-m-Y', '!d-m-y'] as $format) {
            $date = \DateTimeImmutable::createFromFormat($format, $text);
            $errors = \DateTimeImmutable::getLastErrors();
            if ($date && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }

    private function column(int $zeroBased): string
    {
        $column = '';
        for ($value = $zeroBased + 1; $value > 0; $value = intdiv($value - 1, 26)) {
            $column = chr(65 + (($value - 1) % 26)).$column;
        }

        return $column;
    }
}
