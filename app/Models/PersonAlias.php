<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $person_id
 * @property string $alias
 * @property string $normalized_alias
 * @property-read Person $person
 */
class PersonAlias extends Model
{
    protected $fillable = ['person_id', 'alias', 'normalized_alias'];

    /** @return BelongsTo<Person, $this> */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
