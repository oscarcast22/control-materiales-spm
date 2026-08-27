<?php

namespace App\Models;

use Database\Factories\DestinationFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $normalized_name
 * @property bool $is_active
 * @property bool $needs_review
 * @property-read Collection<int, DestinationAlias> $aliases
 * @property-read Collection<int, Voucher> $vouchers
 */
class Destination extends Model
{
    /** @use HasFactory<DestinationFactory> */
    use HasFactory;

    protected $fillable = ['name', 'normalized_name', 'is_active', 'needs_review'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'needs_review' => 'boolean',
        ];
    }

    /** @return HasMany<DestinationAlias, $this> */
    public function aliases(): HasMany
    {
        return $this->hasMany(DestinationAlias::class);
    }

    /** @return BelongsToMany<Voucher, $this> */
    public function vouchers(): BelongsToMany
    {
        return $this->belongsToMany(Voucher::class);
    }
}
