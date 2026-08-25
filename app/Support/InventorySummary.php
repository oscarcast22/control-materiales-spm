<?php

namespace App\Support;

use App\Enums\DispositionType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\InventoryAdjustment;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Models\VoucherItem;
use Illuminate\Support\Carbon;

final class InventorySummary
{
    /** @return array<int, non-empty-array<string, mixed>> */
    public static function rows(?int $locationId = null, ?int $materialId = null, ?string $asOf = null): array
    {
        $cutoff = Carbon::parse($asOf ?? now()->toDateString())->endOfDay();
        $locations = StorageLocation::query()
            ->when($locationId, fn ($query) => $query->whereKey($locationId))
            ->get()->keyBy('id');
        $rows = [];

        $vouchers = Voucher::query()
            ->with(['items.material', 'items.unit', 'items.dispositions'])
            ->where('status', VoucherStatus::Active->value)
            ->whereIn('storage_location_id', $locations->keys())
            ->whereDate('issued_on', '<=', $cutoff)
            ->get();

        foreach ($vouchers as $voucher) {
            $location = $locations->get($voucher->storage_location_id);
            if (! $location) {
                continue;
            }
            foreach ($voucher->items as $item) {
                if ($materialId && $item->material_id !== $materialId) {
                    continue;
                }
                $affectsVoucherStock = $voucher->issued_on->greaterThanOrEqualTo($location->tracking_started_on);
                $returnedAfterStart = 0.0;
                if ($voucher->direction === VoucherDirection::Exit) {
                    foreach ($item->dispositions as $disposition) {
                        if ($disposition->type === DispositionType::Return
                            && $disposition->voided_at === null
                            && $disposition->occurred_on->greaterThanOrEqualTo($location->tracking_started_on)
                            && $disposition->occurred_on->lessThanOrEqualTo($cutoff)) {
                            $returnedAfterStart += (float) $disposition->quantity;
                        }
                    }
                }
                if (! $affectsVoucherStock && $returnedAfterStart === 0.0) {
                    continue;
                }

                $key = self::key($location->id, $item->material_id, $item->unit_id);
                $rows[$key] ??= self::blank($location, $item);

                if ($affectsVoucherStock) {
                    $bucket = $voucher->direction === VoucherDirection::Entry ? 'entries' : 'exits';
                    $rows[$key][$bucket] += (float) $item->quantity;
                }
                $rows[$key]['returns'] += $returnedAfterStart;
            }
        }

        $adjustments = InventoryAdjustment::query()
            ->with(['location', 'material', 'unit'])
            ->whereNull('voided_at')
            ->whereIn('storage_location_id', $locations->keys())
            ->whereDate('occurred_on', '<=', $cutoff)
            ->when($materialId, fn ($query) => $query->where('material_id', $materialId))
            ->get();
        foreach ($adjustments as $adjustment) {
            if ($adjustment->occurred_on->lessThan($adjustment->location->tracking_started_on)) {
                continue;
            }
            $key = self::key($adjustment->storage_location_id, $adjustment->material_id, $adjustment->unit_id);
            $rows[$key] ??= [
                'location' => self::location($adjustment->location),
                'material' => $adjustment->material->only(['id', 'name']),
                'unit' => $adjustment->unit->only(['id', 'name', 'symbol']),
                'entries' => 0.0, 'exits' => 0.0, 'returns' => 0.0, 'adjustments' => 0.0,
            ];
            $rows[$key]['adjustments'] += (float) $adjustment->quantity_delta;
        }

        return collect($rows)->map(function (array $row): array {
            $row['available'] = $row['entries'] - $row['exits'] + $row['returns'] + $row['adjustments'];
            foreach (['entries', 'exits', 'returns', 'adjustments', 'available'] as $field) {
                $row[$field] = number_format((float) $row[$field], 3, '.', '');
            }

            return $row;
        })->sortBy(fn (array $row): string => $row['location']['name'].' '.$row['material']['name'])->values()->all();
    }

    private static function key(int $locationId, int $materialId, int $unitId): string
    {
        return "{$locationId}:{$materialId}:{$unitId}";
    }

    /** @return array<string, mixed> */
    private static function blank(StorageLocation $location, VoucherItem $item): array
    {
        return [
            'location' => self::location($location),
            'material' => $item->material->only(['id', 'name']),
            'unit' => $item->unit->only(['id', 'name', 'symbol']),
            'entries' => 0.0, 'exits' => 0.0, 'returns' => 0.0, 'adjustments' => 0.0,
        ];
    }

    /** @return array{id: int, name: string, code: string, tracking_started_on: string} */
    private static function location(StorageLocation $location): array
    {
        return [
            'id' => $location->id,
            'name' => $location->name,
            'code' => $location->code,
            'tracking_started_on' => $location->tracking_started_on->format('Y-m-d'),
        ];
    }
}
