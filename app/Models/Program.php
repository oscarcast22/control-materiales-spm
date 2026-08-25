<?php

namespace App\Models;

use Database\Factories\ProgramFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $code
 * @property string|null $name
 * @property bool $is_active
 * @property-read Collection<int, Action> $actions
 */
class Program extends Model
{
    /** @use HasFactory<ProgramFactory> */
    use HasFactory;

    protected $fillable = ['code', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return HasMany<Action, $this> */
    public function actions(): HasMany
    {
        return $this->hasMany(Action::class);
    }
}
