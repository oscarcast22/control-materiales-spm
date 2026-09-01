<?php

namespace App\Support;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\MaterialApplication;
use App\Models\Voucher;
use App\Models\VoucherItem;

final class VoucherData
{
    /** @return array<int, array<string, mixed>> */
    public static function itemRows(mixed $value): array
    {
        if (! is_iterable($value)) {
            return [];
        }

        $rows = [];
        foreach ($value as $row) {
            if (is_array($row)) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /** @return array<string, mixed> */
    public static function make(Voucher $voucher, bool $detailed = false): array
    {
        $voucher->loadMissing([
            'location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'actionIndicator',
            'destinations', 'items.material', 'items.unit', 'items.applications.report.attachment', 'attachments',
        ]);

        $isEntry = $voucher->direction === VoucherDirection::Entry;
        $items = $voucher->items->map(fn (VoucherItem $item): array => self::item($item, $detailed, $isEntry))->values();
        $balanceState = $voucher->status === VoucherStatus::Cancelled
            ? 'cancelled'
            : ($voucher->status === VoucherStatus::Loaned
            ? 'loaned'
            : ($voucher->direction === null || $items->isEmpty()
            ? 'not_applicable'
            : ($isEntry ? 'received'
            : ($items->contains(fn (array $item): bool => (float) $item['pending_quantity'] < 0)
                ? 'anomaly'
                : ($items->isNotEmpty() && $items->every(fn (array $item): bool => (float) $item['pending_quantity'] === 0.0)
                    ? 'settled'
                    : 'pending')))));

        return [
            'id' => $voucher->id,
            'voucher_type' => [
                'id' => $voucher->location->id,
                'name' => $voucher->location->name,
                'code' => $voucher->location->code,
                'tracking_started_on' => $voucher->location->tracking_started_on->format('Y-m-d'),
            ],
            'folio' => $voucher->folio,
            'direction' => $voucher->direction?->value,
            'issued_on' => $voucher->issued_on->format('Y-m-d'),
            'received_by' => $voucher->receivedBy?->only(['id', 'name']),
            'delivered_by' => $voucher->deliveredBy?->only(['id', 'name']),
            'authorized_by' => $voucher->authorizedBy?->only(['id', 'name']),
            'program' => $voucher->program?->only(['id', 'code', 'name']),
            'action' => $voucher->action?->only(['id', 'program_id', 'code', 'name']),
            'indicator' => $voucher->actionIndicator?->only(['id', 'action_id', 'code', 'name']),
            'destinations' => $voucher->destinations->map->only(['id', 'name'])->values(),
            'usage_description' => $voucher->usage_description,
            'destination_summary' => self::destinationSummary($voucher),
            'notes' => $voucher->notes,
            'status' => $voucher->status->value,
            'loaned_to_name' => $voucher->loaned_to_name,
            'loaned_on' => $voucher->loaned_on?->format('Y-m-d'),
            'balance_state' => $balanceState,
            'needs_review' => $voucher->needs_review,
            'review_reasons' => $voucher->review_reasons ?? [],
            'cancellation_reason' => $voucher->cancellation_reason,
            'items_count' => $items->count(),
            'items' => $items,
            'attachments' => $detailed ? $voucher->attachments->map->only([
                'id', 'original_name', 'mime_type', 'size', 'created_at',
            ])->values() : [],
            'created_at' => $voucher->created_at?->toIso8601String(),
            'updated_at' => $voucher->updated_at?->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    public static function item(VoucherItem $item, bool $detailed = false, bool $isEntry = false): array
    {
        $used = $isEntry ? '0.000' : $item->usedQuantity();
        $pending = $isEntry ? '0.000' : $item->pendingQuantity();

        return [
            'id' => $item->id,
            'material' => $item->material->only(['id', 'name']),
            'unit' => $item->unit->only(['id', 'name', 'symbol']),
            'description' => $item->description_snapshot,
            'quantity' => $item->quantity,
            'used_quantity' => $used,
            'pending_quantity' => $pending,
            'balance_state' => $isEntry ? 'received' : ((float) $pending < 0 ? 'anomaly' : ((float) $pending === 0.0 ? 'settled' : 'pending')),
            'legacy_anomaly' => $item->legacy_anomaly,
            'applications' => $detailed ? $item->applications->sortByDesc('occurred_on')->map(
                fn (MaterialApplication $row): array => [
                    'id' => $row->id,
                    'occurred_on' => $row->occurred_on->format('Y-m-d'),
                    'quantity' => $row->quantity,
                    'reference' => $row->reference,
                    'destination_snapshot' => $row->destination_snapshot,
                    'notes' => $row->notes,
                    'legacy_slot' => $row->legacy_slot,
                    'voided_at' => $row->voided_at?->toIso8601String(),
                    'void_reason' => $row->void_reason,
                    'attachment' => $row->report?->attachment?->only([
                        'id', 'original_name', 'mime_type', 'size',
                    ]),
                ],
            )->values() : [],
        ];
    }

    public static function destinationSummary(Voucher $voucher): ?string
    {
        $voucher->loadMissing('destinations:id,name');
        $locations = $voucher->destinations->pluck('name')->implode(', ');
        $description = trim((string) $voucher->usage_description);

        return match (true) {
            $locations !== '' && $description !== '' => $locations.' · '.$description,
            $locations !== '' => $locations,
            $description !== '' => $description,
            default => null,
        };
    }
}
