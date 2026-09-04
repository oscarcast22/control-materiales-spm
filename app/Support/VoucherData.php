<?php

namespace App\Support;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationReport;
use App\Models\User;
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
    public static function make(Voucher $voucher, bool $detailed = false, ?User $user = null): array
    {
        $user ??= auth()->user();
        $relations = [
            'location', 'receivedBy', 'deliveredBy', 'authorizedBy', 'program', 'action', 'actionIndicator',
            'destinations', 'items.material', 'items.unit', 'items.applications',
        ];
        if ($detailed) {
            $relations = [
                ...$relations,
                'items.applications.report.attachment', 'attachments',
                'applicationReports.applications.item.material', 'applicationReports.applications.item.unit',
                'applicationReports.attachment',
            ];
        }
        $voucher->loadMissing($relations);

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
            'application_reports' => $detailed ? self::applicationReports($voucher, $user) : [],
            'attachments' => $detailed ? $voucher->attachments->map->only([
                'id', 'original_name', 'mime_type', 'size', 'created_at',
            ])->values() : [],
            'created_at' => $voucher->created_at?->toIso8601String(),
            'updated_at' => $voucher->updated_at?->toIso8601String(),
            'permissions' => [
                'update' => $user?->can('update', $voucher) ?? false,
                'cancel' => $user?->can('cancel', $voucher) ?? false,
                'review' => $user?->can('review', $voucher) ?? false,
                'print' => $user?->can('print', $voucher) ?? false,
                'create_application' => $user?->can('createApplication', $voucher) ?? false,
            ],
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private static function applicationReports(Voucher $voucher, ?User $user): array
    {
        $reports = $voucher->applicationReports
            ->map(fn (MaterialApplicationReport $report): array => [
                'key' => "report-{$report->id}",
                'id' => $report->id,
                'occurred_on' => $report->occurred_on->format('Y-m-d'),
                'service_order' => $report->reference,
                'notes' => $report->notes,
                'editable' => $user?->can('update', $report) ?? false,
                'permissions' => [
                    'update' => $user?->can('update', $report) ?? false,
                    'replace_attachment' => $user?->can('replaceAttachment', $report) ?? false,
                    'remove_attachment' => $user?->can('removeAttachment', $report) ?? false,
                ],
                'applications' => $report->applications
                    ->sortByDesc('id')
                    ->map(fn (MaterialApplication $application): array => self::applicationLine($application, $user))
                    ->values(),
                'attachment' => $report->attachment?->only([
                    'id', 'original_name', 'mime_type', 'size',
                ]),
            ]);

        $reportedIds = $voucher->applicationReports
            ->flatMap(fn (MaterialApplicationReport $report) => $report->applications->pluck('id'))
            ->all();

        $legacyApplications = $voucher->items
            ->flatMap(fn (VoucherItem $item) => $item->applications)
            ->whereNotIn('id', $reportedIds)
            ->map(fn (MaterialApplication $application): array => [
                'key' => "legacy-application-{$application->id}",
                'id' => null,
                'occurred_on' => $application->occurred_on->format('Y-m-d'),
                'service_order' => $application->reference,
                'notes' => $application->notes,
                'editable' => false,
                'permissions' => [
                    'update' => false,
                    'replace_attachment' => false,
                    'remove_attachment' => false,
                ],
                'applications' => [self::applicationLine($application, $user)],
                'attachment' => null,
            ]);

        return $reports
            ->concat($legacyApplications)
            ->sortByDesc('occurred_on')
            ->values()
            ->all();
    }

    /** @return array<string, mixed> */
    private static function applicationLine(MaterialApplication $application, ?User $user): array
    {
        return [
            'id' => $application->id,
            'voucher_item_id' => $application->voucher_item_id,
            'material' => $application->item->material->only(['id', 'name']),
            'unit' => $application->item->unit->only(['id', 'name', 'symbol']),
            'quantity' => $application->quantity,
            'legacy_slot' => $application->legacy_slot,
            'voided_at' => $application->voided_at?->toIso8601String(),
            'void_reason' => $application->void_reason,
            'permissions' => [
                'void' => $user?->can('void', $application) ?? false,
            ],
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
                    'notes' => $row->application_report_id !== null
                        ? ($row->report->notes ?? $row->notes)
                        : $row->notes,
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
