<?php

namespace App\Models;

use Database\Factories\MaterialFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $normalized_name
 * @property int $default_unit_id
 * @property bool $is_active
 * @property bool $needs_review
 * @property-read Unit $defaultUnit
 * @property-read Collection<int, MaterialAlias> $aliases
 */
class Material extends Model
{
    /** @use HasFactory<MaterialFactory> */
    use HasFactory;

    protected $fillable = ['name', 'normalized_name', 'default_unit_id', 'is_active', 'needs_review'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'needs_review' => 'boolean'];
    }

    /** @return BelongsTo<Unit, $this> */
    public function defaultUnit(): BelongsTo
    {
        return $this->belongsTo(Unit::class, 'default_unit_id');
    }

    /** @return HasMany<MaterialAlias, $this> */
    public function aliases(): HasMany
    {
        return $this->hasMany(MaterialAlias::class);
    }
}
