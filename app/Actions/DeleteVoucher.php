<?php

namespace App\Actions;

use App\Models\AuditEvent;
use App\Models\LegacyImportRow;
use App\Models\MaterialApplication;
use App\Models\MaterialApplicationAttachment;
use App\Models\MaterialApplicationReport;
use App\Models\Voucher;
use App\Models\VoucherAttachment;
use App\Models\VoucherItem;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class DeleteVoucher
{
    public function handle(Voucher $voucher): void
    {
        $voucher->loadMissing([
            'attachments',
            'items.applications',
            'applicationReports.attachment',
        ]);

        $files = $voucher->attachments
            ->map(fn (VoucherAttachment $attachment): array => [
                'disk' => $attachment->disk,
                'path' => $attachment->path,
            ])
            ->concat($voucher->applicationReports
                ->pluck('attachment')
                ->filter()
                ->map(fn (MaterialApplicationAttachment $attachment): array => [
                    'disk' => $attachment->disk,
                    'path' => $attachment->path,
                ]))
            ->values();

        $itemIds = $this->auditedChildIds(
            VoucherItem::class,
            'voucher_id',
            [$voucher->id],
            $voucher->items->pluck('id'),
        );
        $reportIds = $this->auditedChildIds(
            MaterialApplicationReport::class,
            'voucher_id',
            [$voucher->id],
            $voucher->applicationReports->pluck('id'),
        );
        $applicationIds = $this->auditedChildIds(
            MaterialApplication::class,
            'voucher_item_id',
            $itemIds,
            $voucher->items->flatMap->applications->pluck('id'),
        );
        $voucherAttachmentIds = $this->auditedChildIds(
            VoucherAttachment::class,
            'voucher_id',
            [$voucher->id],
            $voucher->attachments->pluck('id'),
        );
        $applicationAttachmentIds = $this->auditedChildIds(
            MaterialApplicationAttachment::class,
            'application_report_id',
            $reportIds,
            $voucher->applicationReports
                ->pluck('attachment')
                ->filter()
                ->pluck('id'),
        );

        $auditTargets = [
            Voucher::class => [$voucher->id],
            VoucherItem::class => $itemIds,
            MaterialApplication::class => $applicationIds,
            MaterialApplicationReport::class => $reportIds,
            VoucherAttachment::class => $voucherAttachmentIds,
            MaterialApplicationAttachment::class => $applicationAttachmentIds,
        ];

        DB::transaction(function () use ($voucher, $auditTargets): void {
            $locked = Voucher::query()->lockForUpdate()->findOrFail($voucher->id);

            AuditEvent::query()
                ->where(function (Builder $query) use ($auditTargets): void {
                    foreach ($auditTargets as $type => $ids) {
                        if ($ids === []) {
                            continue;
                        }

                        $query->orWhere(function (Builder $target) use ($type, $ids): void {
                            $target->where('auditable_type', $type)->whereIn('auditable_id', $ids);
                        });
                    }
                })
                ->delete();

            LegacyImportRow::query()
                ->where('imported_type', Voucher::class)
                ->where('imported_id', $locked->id)
                ->delete();

            $locked->delete();
        });

        $files->each(fn (array $file): bool => Storage::disk($file['disk'])->delete($file['path']));
    }

    /**
     * @param  class-string  $type
     * @param  array<int, int>  $parentIds
     * @param  Collection<int, int>  $currentIds
     * @return array<int, int>
     */
    private function auditedChildIds(string $type, string $parentKey, array $parentIds, Collection $currentIds): array
    {
        if ($parentIds === []) {
            return $currentIds->unique()->values()->all();
        }

        $auditedIds = AuditEvent::query()
            ->where('auditable_type', $type)
            ->where(function (Builder $query) use ($parentKey, $parentIds): void {
                $query
                    ->whereIn("before->{$parentKey}", $parentIds)
                    ->orWhereIn("after->{$parentKey}", $parentIds);
            })
            ->pluck('auditable_id');

        return $currentIds->concat($auditedIds)->unique()->values()->all();
    }
}
