<?php

namespace App\Models;

use Database\Factories\StorageLocationFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property Carbon $tracking_started_on
 * @property bool $is_active
 * @property-read Collection<int, Voucher> $vouchers
 * @property-read Collection<int, InventoryAdjustment> $adjustments
 */
class StorageLocation extends Model
{
    /** @use HasFactory<StorageLocationFactory> */
    use HasFactory;

    protected $fillable = ['code', 'name', 'tracking_started_on', 'is_active'];

    protected function casts(): array
    {
        return ['tracking_started_on' => 'date:Y-m-d', 'is_active' => 'boolean'];
    }

    /** @return HasMany<Voucher, $this> */
    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }

    /** @return HasMany<InventoryAdjustment, $this> */
    public function adjustments(): HasMany
    {
        return $this->hasMany(InventoryAdjustment::class);
    }
}
