<?php

namespace App\Models;

use Database\Factories\PersonFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property string $name
 * @property string $normalized_name
 * @property bool $can_receive_material
 * @property bool $can_deliver_material
 * @property bool $can_authorize_material
 * @property bool $is_active
 * @property bool $needs_review
 * @property-read Collection<int, PersonAlias> $aliases
 * @property-read User|null $account
 */
class Person extends Model
{
    /** @use HasFactory<PersonFactory> */
    use HasFactory;

    protected $fillable = [
        'name', 'normalized_name', 'can_receive_material', 'can_deliver_material', 'can_authorize_material', 'is_active', 'needs_review',
    ];

    protected function casts(): array
    {
        return [
            'can_receive_material' => 'boolean',
            'can_deliver_material' => 'boolean',
            'can_authorize_material' => 'boolean',
            'is_active' => 'boolean',
            'needs_review' => 'boolean',
        ];
    }

    /** @return HasMany<PersonAlias, $this> */
    public function aliases(): HasMany
    {
        return $this->hasMany(PersonAlias::class);
    }

    /** @return HasMany<Voucher, $this> */
    public function receivedVouchers(): HasMany
    {
        return $this->hasMany(Voucher::class, 'received_by_id');
    }

    /** @return HasMany<Voucher, $this> */
    public function deliveredVouchers(): HasMany
    {
        return $this->hasMany(Voucher::class, 'delivered_by_id');
    }

    /** @return HasMany<Voucher, $this> */
    public function authorizedVouchers(): HasMany
    {
        return $this->hasMany(Voucher::class, 'authorized_by_id');
    }

    /** @return HasOne<User, $this> */
    public function account(): HasOne
    {
        return $this->hasOne(User::class);
    }
}
