<?php

namespace App\Models;

use App\Enums\DispositionType;
use Database\Factories\VoucherItemFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $voucher_id
 * @property int $material_id
 * @property int $unit_id
 * @property string $description_snapshot
 * @property string $quantity
 * @property bool $legacy_anomaly
 * @property int|null $created_by
 * @property-read Voucher $voucher
 * @property-read Material $material
 * @property-read Unit $unit
 * @property-read Collection<int, MaterialDisposition> $dispositions
 */
class VoucherItem extends Model
{
    /** @use HasFactory<VoucherItemFactory> */
    use HasFactory;

    protected $fillable = [
        'voucher_id', 'material_id', 'unit_id', 'description_snapshot', 'quantity',
        'legacy_anomaly', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3', 'legacy_anomaly' => 'boolean'];
    }

    /** @return BelongsTo<Voucher, $this> */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    /** @return BelongsTo<Material, $this> */
    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return HasMany<MaterialDisposition, $this> */
    public function dispositions(): HasMany
    {
        return $this->hasMany(MaterialDisposition::class);
    }

    public function usedQuantity(): string
    {
        return $this->sumDisposition(DispositionType::Consumption);
    }

    public function returnedQuantity(): string
    {
        return $this->sumDisposition(DispositionType::Return);
    }

    public function pendingQuantity(): string
    {
        return number_format(
            (float) $this->quantity - (float) $this->usedQuantity() - (float) $this->returnedQuantity(),
            3,
            '.',
            '',
        );
    }

    private function sumDisposition(DispositionType $type): string
    {
        $value = $this->relationLoaded('dispositions')
            ? $this->dispositions->whereNull('voided_at')->where('type', $type)->sum(fn (MaterialDisposition $row) => (float) $row->quantity)
            : $this->dispositions()->whereNull('voided_at')->where('type', $type->value)->sum('quantity');

        return number_format((float) $value, 3, '.', '');
    }
}
