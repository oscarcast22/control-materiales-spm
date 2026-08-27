<?php

namespace App\Support;

use App\Models\Voucher;
use Illuminate\Support\Collection;

final class MaterialTracking
{
    public const START_DATE = '2026-01-01';

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
        $rows = $vouchers->flatMap(function (Voucher $voucher): Collection {
            $data = VoucherData::make($voucher, true);

            return collect(VoucherData::itemRows($data['items']))->map(function (array $item) use ($voucher, $data): array {
                unset($item['applications']);

                return [
                    'voucher_id' => $voucher->id,
                    'folio' => $voucher->folio,
                    'issued_on' => $data['issued_on'],
                    'voucher_type' => $data['voucher_type'],
                    'received_by' => $data['received_by'],
                    'destination_summary' => $data['destination_summary'],
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

        $rows = $rows->values();
        $voucherStates = $rows->groupBy('voucher_id')->map(function (Collection $voucherRows): string {
            if ($voucherRows->contains(fn (array $row): bool => $row['balance_state'] === 'anomaly')) {
                return 'anomaly';
            }

            return $voucherRows->contains(fn (array $row): bool => $row['balance_state'] === 'pending')
                ? 'pending'
                : 'settled';
        });

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
            'metrics' => [
                'delivered_vouchers' => $voucherStates->count(),
                'pending_vouchers' => $voucherStates->filter(fn (string $state): bool => $state === 'pending')->count(),
                'pending_items' => $rows->where('balance_state', 'pending')->count(),
                'settled_vouchers' => $voucherStates->filter(fn (string $state): bool => $state === 'settled')->count(),
                'anomalies' => $voucherStates->filter(fn (string $state): bool => $state === 'anomaly')->count(),
                'technicians_with_pending' => $rows->where('balance_state', 'pending')->pluck('received_by.id')->unique()->count(),
            ],
            'by_material' => $byMaterial->all(),
            'by_technician' => $byTechnician->all(),
            'rows' => $rows->all(),
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
