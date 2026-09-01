<?php

namespace App\Models;

use Database\Factories\ActionFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $program_id
 * @property string $code
 * @property string|null $name
 * @property bool $is_active
 * @property-read Program $program
 * @property-read Collection<int, ActionIndicator> $indicators
 */
class Action extends Model
{
    /** @use HasFactory<ActionFactory> */
    use HasFactory;

    protected $fillable = ['program_id', 'code', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<Program, $this> */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /** @return HasMany<Voucher, $this> */
    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class);
    }

    /** @return HasMany<ActionIndicator, $this> */
    public function indicators(): HasMany
    {
        return $this->hasMany(ActionIndicator::class);
    }
}
