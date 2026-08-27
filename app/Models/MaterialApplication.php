<?php

namespace App\Models;

use Database\Factories\MaterialApplicationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $voucher_item_id
 * @property int|null $application_report_id
 * @property Carbon $occurred_on
 * @property string $quantity
 * @property string|null $reference
 * @property string|null $destination_snapshot
 * @property string|null $notes
 * @property int|null $legacy_slot
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property-read VoucherItem $item
 * @property-read MaterialApplicationReport|null $report
 */
class MaterialApplication extends Model
{
    /** @use HasFactory<MaterialApplicationFactory> */
    use HasFactory;

    protected $fillable = [
        'voucher_item_id', 'application_report_id', 'occurred_on', 'quantity', 'reference', 'destination_snapshot', 'notes',
        'legacy_slot', 'voided_at', 'voided_by', 'void_reason', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'occurred_on' => 'date:Y-m-d',
            'quantity' => 'decimal:3',
            'voided_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<VoucherItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(VoucherItem::class, 'voucher_item_id');
    }

    /** @return BelongsTo<MaterialApplicationReport, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(MaterialApplicationReport::class, 'application_report_id');
    }
}
