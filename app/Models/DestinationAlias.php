<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $destination_id
 * @property string $alias
 * @property string $normalized_alias
 * @property-read Destination $destination
 */
class DestinationAlias extends Model
{
    protected $fillable = ['destination_id', 'alias', 'normalized_alias'];

    /** @return BelongsTo<Destination, $this> */
    public function destination(): BelongsTo
    {
        return $this->belongsTo(Destination::class);
    }
}
