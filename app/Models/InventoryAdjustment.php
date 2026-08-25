<?php

namespace App\Models;

use Database\Factories\InventoryAdjustmentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $storage_location_id
 * @property int $material_id
 * @property int $unit_id
 * @property Carbon $occurred_on
 * @property string $quantity_delta
 * @property string $reason
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property-read StorageLocation $location
 * @property-read Material $material
 * @property-read Unit $unit
 */
class InventoryAdjustment extends Model
{
    /** @use HasFactory<InventoryAdjustmentFactory> */
    use HasFactory;

    protected $fillable = [
        'storage_location_id', 'material_id', 'unit_id', 'occurred_on', 'quantity_delta', 'reason',
        'voided_at', 'voided_by', 'void_reason', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['occurred_on' => 'date:Y-m-d', 'quantity_delta' => 'decimal:3', 'voided_at' => 'datetime'];
    }

    /** @return BelongsTo<StorageLocation, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'storage_location_id');
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
}
