<?php

namespace App\Support;

use App\Models\LegacyImportRow;
use App\Models\StorageLocation;

final class VoucherSequence
{
    /**
     * @return array{
     *   total_missing: int,
     *   types: list<array{voucher_type: array{id: int, name: string, code: string}, start: int, last: int|null, missing_count: int, missing: list<int>}>
     * }
     */
    public function summary(?int $voucherTypeId = null): array
    {
        /** @var array<string, int> $starts */
        $starts = config('material-control.voucher_sequence_starts', []);
        $types = [];
        $tracedFolios = LegacyImportRow::query()
            ->whereNull('imported_id')
            ->get(['sheet_name', 'raw_data'])
            ->groupBy(fn (LegacyImportRow $row): string => match (Normalizer::key($row->sheet_name)) {
                'vale de almacen' => 'warehouse',
                'vale de patio' => 'yard',
                default => '',
            });

        $locations = StorageLocation::query()
            ->whereIn('code', array_keys($starts))
            ->when($voucherTypeId !== null, fn ($query) => $query->whereKey($voucherTypeId))
            ->with(['vouchers:id,storage_location_id,folio'])
            ->orderBy('name')
            ->get();

        foreach ($locations as $location) {
            $start = (int) $starts[$location->code];
            $present = $location->vouchers
                ->map(fn ($voucher): string => trim($voucher->folio))
                ->filter(fn (string $folio): bool => ctype_digit($folio))
                ->map(fn (string $folio): int => (int) $folio)
                ->filter(fn (int $folio): bool => $folio >= $start)
                ->unique()
                ->sort()
                ->values();
            $observedInInvalidTraces = $tracedFolios->get($location->code, collect())
                ->map(fn (LegacyImportRow $row): string => trim((string) ($row->raw_data['folio'] ?? '')))
                ->filter(fn (string $folio): bool => ctype_digit($folio))
                ->map(fn (string $folio): int => (int) $folio)
                ->filter(fn (int $folio): bool => $folio >= $start);
            $last = $present->merge($observedInInvalidTraces)->max();
            $missing = $last === null
                ? []
                : array_values(array_diff(range($start, $last), $present->all()));

            $types[] = [
                'voucher_type' => $location->only(['id', 'name', 'code']),
                'start' => $start,
                'last' => $last,
                'missing_count' => count($missing),
                'missing' => $missing,
            ];
        }

        return [
            'total_missing' => array_sum(array_column($types, 'missing_count')),
            'types' => $types,
        ];
    }
}
