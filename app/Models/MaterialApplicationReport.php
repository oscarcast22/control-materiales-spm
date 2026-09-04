<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $voucher_id
 * @property Carbon $occurred_on
 * @property string|null $reference
 * @property string|null $notes
 * @property int|null $created_by
 * @property-read Voucher $voucher
 * @property-read Collection<int, MaterialApplication> $applications
 * @property-read MaterialApplicationAttachment|null $attachment
 */
class MaterialApplicationReport extends Model
{
    protected $fillable = [
        'voucher_id', 'occurred_on', 'reference', 'notes', 'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return ['occurred_on' => 'date:Y-m-d'];
    }

    /** @return BelongsTo<Voucher, $this> */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    /** @return HasMany<MaterialApplication, $this> */
    public function applications(): HasMany
    {
        return $this->hasMany(MaterialApplication::class, 'application_report_id');
    }

    /** @return HasOne<MaterialApplicationAttachment, $this> */
    public function attachment(): HasOne
    {
        return $this->hasOne(MaterialApplicationAttachment::class, 'application_report_id');
    }
}
