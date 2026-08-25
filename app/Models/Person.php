<?php

namespace App\Models;

use Database\Factories\PersonFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $normalized_name
 * @property bool $can_receive_material
 * @property bool $can_deliver_material
 * @property bool $is_active
 * @property bool $needs_review
 * @property-read Collection<int, PersonAlias> $aliases
 */
class Person extends Model
{
    /** @use HasFactory<PersonFactory> */
    use HasFactory;

    protected $fillable = [
        'name', 'normalized_name', 'can_receive_material', 'can_deliver_material', 'is_active', 'needs_review',
    ];

    protected function casts(): array
    {
        return [
            'can_receive_material' => 'boolean',
            'can_deliver_material' => 'boolean',
            'is_active' => 'boolean',
            'needs_review' => 'boolean',
        ];
    }

    /** @return HasMany<PersonAlias, $this> */
    public function aliases(): HasMany
    {
        return $this->hasMany(PersonAlias::class);
    }
}
