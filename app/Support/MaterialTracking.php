<?php

namespace App\Support;

use App\Enums\VoucherDirection;
use App\Models\Voucher;
use App\Models\VoucherItem;
use Illuminate\Support\Collection;

final class MaterialTracking
{
    public const START_DATE = '2026-01-01';

    /**
     * @param  Collection<int, Voucher>  $vouchers
     * @return array{metrics: array<string, int>, rows: array<int, array<string, mixed>>}
     */
    public static function overview(Collection $vouchers): array
    {
        $rows = collect(self::rows($vouchers));

        return [
            'metrics' => self::metrics($rows),
            'rows' => $rows->all(),
        ];
    }

    /**
     * @param  Collection<int, Voucher>  $vouchers
     * @param  array{material_id?: int|null, state?: string|null}  $filters
     * @return array{
     *     metrics: array<string, int>,
     *     by_material: array<int, array<string, mixed>>,
     *     by_technician: array<int, array<string, mixed>>,
     *     rows: array<int, array<string, mixed>>
     * }
     */
    public static function make(Collection $vouchers, array $filters = []): array
    {
        $rows = collect(self::rows($vouchers, $filters));
        $byMaterial = $rows
            ->groupBy(fn (array $row): string => $row['material']['id'].'-'.$row['unit']['id'])
            ->map(function (Collection $materialRows): array {
                $first = $materialRows->first();

                return [
                    'material' => $first['material'],
                    'unit' => $first['unit'],
                    'vouchers_count' => $materialRows->pluck('voucher_id')->unique()->count(),
                    'technicians_count' => $materialRows->pluck('received_by.id')->unique()->count(),
                    'delivered_quantity' => self::sum($materialRows, 'quantity'),
                    'used_quantity' => self::sum($materialRows, 'used_quantity'),
                    'pending_quantity' => self::sum($materialRows, 'pending_quantity'),
                ];
            })
            ->sortBy(fn (array $row): string => $row['material']['name'].' '.$row['unit']['symbol'])
            ->values();

        $byTechnician = $rows
            ->groupBy('received_by.id')
            ->map(function (Collection $technicianRows): array {
                $first = $technicianRows->first();

                return [
                    'technician' => $first['received_by'],
                    'vouchers_count' => $technicianRows->pluck('voucher_id')->unique()->count(),
                    'materials_count' => $technicianRows->pluck('material.id')->unique()->count(),
                    'pending_items_count' => $technicianRows->where('balance_state', 'pending')->count(),
                    'settled_items_count' => $technicianRows->where('balance_state', 'settled')->count(),
                    'anomalies_count' => $technicianRows->where('balance_state', 'anomaly')->count(),
                ];
            })
            ->sort(function (array $left, array $right): int {
                return $right['pending_items_count'] <=> $left['pending_items_count']
                    ?: strcasecmp($left['technician']['name'], $right['technician']['name']);
            })
            ->values();

        return [
            'metrics' => self::metrics($rows),
            'by_material' => $byMaterial->all(),
            'by_technician' => $byTechnician->all(),
            'rows' => $rows->all(),
        ];
    }

    /**
     * @param  Collection<int, Voucher>  $vouchers
     * @param  array{material_id?: int|null, state?: string|null}  $filters
     * @return list<non-empty-array<string, mixed>>
     */
    private static function rows(Collection $vouchers, array $filters = []): array
    {
        $rows = $vouchers->flatMap(function (Voucher $voucher): Collection {
            $voucher->loadMissing([
                'location', 'receivedBy', 'destinations',
                'items.material', 'items.unit', 'items.applications',
            ]);
            $isEntry = $voucher->direction === VoucherDirection::Entry;

            return $voucher->items->map(function (VoucherItem $voucherItem) use ($voucher, $isEntry): array {
                $item = VoucherData::item($voucherItem, false, $isEntry);

                return [
                    'voucher_id' => $voucher->id,
                    'folio' => $voucher->folio,
                    'issued_on' => $voucher->issued_on->format('Y-m-d'),
                    'voucher_type' => [
                        'id' => $voucher->location->id,
                        'name' => $voucher->location->name,
                        'code' => $voucher->location->code,
                        'tracking_started_on' => $voucher->location->tracking_started_on->format('Y-m-d'),
                    ],
                    'received_by' => $voucher->receivedBy?->only(['id', 'name']),
                    'destination_summary' => VoucherData::destinationSummary($voucher),
                    ...$item,
                ];
            });
        });

        if (! empty($filters['material_id'])) {
            $materialId = (int) $filters['material_id'];
            $rows = $rows->filter(fn (array $row): bool => (int) $row['material']['id'] === $materialId);
        }
        if (! empty($filters['state'])) {
            $state = (string) $filters['state'];
            $rows = $rows->filter(fn (array $row): bool => $row['balance_state'] === $state);
        }

        return array_values($rows->all());
    }

    /**
     * @param  Collection<int, non-empty-array<string, mixed>>  $rows
     * @return array<string, int>
     */
    private static function metrics(Collection $rows): array
    {
        $voucherStates = $rows->groupBy('voucher_id')->map(function (Collection $voucherRows): string {
            if ($voucherRows->contains(fn (array $row): bool => $row['balance_state'] === 'anomaly')) {
                return 'anomaly';
            }

            return $voucherRows->contains(fn (array $row): bool => $row['balance_state'] === 'pending')
                ? 'pending'
                : 'settled';
        });

        return [
            'delivered_vouchers' => $voucherStates->count(),
            'pending_vouchers' => $voucherStates->filter(fn (string $state): bool => $state === 'pending')->count(),
            'pending_items' => $rows->where('balance_state', 'pending')->count(),
            'settled_vouchers' => $voucherStates->filter(fn (string $state): bool => $state === 'settled')->count(),
            'anomalies' => $voucherStates->filter(fn (string $state): bool => $state === 'anomaly')->count(),
            'technicians_with_pending' => $rows->where('balance_state', 'pending')->pluck('received_by.id')->unique()->count(),
        ];
    }

    /** @param iterable<array<string, mixed>> $rows */
    private static function sum(iterable $rows, string $field): string
    {
        $total = 0.0;
        foreach ($rows as $row) {
            $total += (float) $row[$field];
        }

        return number_format($total, 3, '.', '');
    }
}
