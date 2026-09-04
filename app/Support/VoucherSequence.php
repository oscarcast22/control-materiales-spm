<?php

namespace App\Support;

use App\Models\StorageLocation;
use Illuminate\Support\Collection;

final class VoucherSequence
{
    private const MISSING_PREVIEW_LIMIT = 100;

    /**
     * @return array{
     *   total_missing: int,
     *   types: list<array{voucher_type: array{id: int, name: string, code: string}, start: int, last: int|null, missing_count: int, missing: list<int>, missing_truncated: bool}>
     * }
     */
    public function summary(?int $voucherTypeId = null): array
    {
        /** @var array<string, int> $starts */
        $starts = config('material-control.voucher_sequence_starts', []);
        $types = [];
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
            $last = $present->max();
            $missingCount = $last === null ? 0 : max(0, $last - $start + 1 - $present->count());
            $missing = $last === null || $missingCount === 0
                ? []
                : $this->missingPreview($present, $start, $last);

            $types[] = [
                'voucher_type' => $location->only(['id', 'name', 'code']),
                'start' => $start,
                'last' => $last,
                'missing_count' => $missingCount,
                'missing' => $missing,
                'missing_truncated' => $missingCount > count($missing),
            ];
        }

        return [
            'total_missing' => array_sum(array_column($types, 'missing_count')),
            'types' => $types,
        ];
    }

    /**
     * @param  Collection<int, int>  $present
     * @return list<int>
     */
    private function missingPreview(Collection $present, int $start, int $last): array
    {
        $missing = [];
        $next = $start;

        foreach ($present as $folio) {
            if ($folio > $next) {
                $end = min($folio - 1, $next + self::MISSING_PREVIEW_LIMIT - count($missing) - 1);
                $missing = [...$missing, ...range($next, $end)];
                if (count($missing) === self::MISSING_PREVIEW_LIMIT) {
                    return $missing;
                }
            }

            $next = max($next, $folio + 1);
        }

        if ($next <= $last && count($missing) < self::MISSING_PREVIEW_LIMIT) {
            $end = min($last, $next + self::MISSING_PREVIEW_LIMIT - count($missing) - 1);
            $missing = [...$missing, ...range($next, $end)];
        }

        return $missing;
    }
}
