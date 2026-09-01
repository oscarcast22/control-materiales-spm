<?php

namespace App\Models;

use Database\Factories\ActionIndicatorFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $action_id
 * @property string $code
 * @property string $name
 * @property bool $is_active
 * @property-read Action $action
 */
class ActionIndicator extends Model
{
    /** @use HasFactory<ActionIndicatorFactory> */
    use HasFactory;

    protected $fillable = ['action_id', 'code', 'name', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    /** @return BelongsTo<Action, $this> */
    public function action(): BelongsTo
    {
        return $this->belongsTo(Action::class);
    }

    /** @return HasMany<Voucher, $this> */
    public function vouchers(): HasMany
    {
        return $this->hasMany(Voucher::class, 'action_indicator_id');
    }
}
