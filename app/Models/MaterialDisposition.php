<?php

namespace App\Models;

use App\Enums\DispositionType;
use Database\Factories\MaterialDispositionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $voucher_item_id
 * @property DispositionType $type
 * @property Carbon $occurred_on
 * @property string $quantity
 * @property string|null $reference
 * @property string|null $destination
 * @property string|null $notes
 * @property int|null $legacy_slot
 * @property Carbon|null $voided_at
 * @property int|null $voided_by
 * @property string|null $void_reason
 * @property-read VoucherItem $item
 */
class MaterialDisposition extends Model
{
    /** @use HasFactory<MaterialDispositionFactory> */
    use HasFactory;

    protected $fillable = [
        'voucher_item_id', 'type', 'occurred_on', 'quantity', 'reference', 'destination', 'notes', 'legacy_slot',
        'voided_at', 'voided_by', 'void_reason', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => DispositionType::class,
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
}
