<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $material_id
 * @property string $alias
 * @property string $normalized_alias
 * @property-read Material $material
 */
class MaterialAlias extends Model
{
    protected $fillable = ['material_id', 'alias', 'normalized_alias'];

    /** @return BelongsTo<Material, $this> */
    public function material(): BelongsTo
    {
        return $this->belongsTo(Material::class);
    }
}
