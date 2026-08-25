<?php

namespace App\Models;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use Database\Factories\VoucherFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $folio
 * @property string $folio_key
 * @property int $storage_location_id
 * @property VoucherDirection $direction
 * @property string|null $reference
 * @property Carbon $issued_on
 * @property string|null $issued_time
 * @property int $received_by_id
 * @property int $delivered_by_id
 * @property int|null $authorized_by_id
 * @property int|null $program_id
 * @property int|null $action_id
 * @property string $destination
 * @property string|null $notes
 * @property VoucherStatus $status
 * @property bool $needs_review
 * @property Carbon|null $cancelled_at
 * @property string|null $cancellation_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Person $receivedBy
 * @property-read Person $deliveredBy
 * @property-read Person|null $authorizedBy
 * @property-read StorageLocation $location
 * @property-read Program|null $program
 * @property-read Action|null $action
 * @property-read Collection<int, VoucherItem> $items
 * @property-read Collection<int, VoucherAttachment> $attachments
 */
class Voucher extends Model
{
    /** @use HasFactory<VoucherFactory> */
    use HasFactory;

    protected $fillable = [
        'storage_location_id', 'folio', 'folio_key', 'direction', 'reference', 'issued_on', 'issued_time',
        'received_by_id', 'delivered_by_id', 'authorized_by_id', 'program_id', 'action_id',
        'destination', 'notes', 'status', 'needs_review', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
        'created_by', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_on' => 'date:Y-m-d',
            'direction' => VoucherDirection::class,
            'status' => VoucherStatus::class,
            'needs_review' => 'boolean',
            'cancelled_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<StorageLocation, $this> */
    public function location(): BelongsTo
    {
        return $this->belongsTo(StorageLocation::class, 'storage_location_id');
    }

    /** @return BelongsTo<Person, $this> */
    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'received_by_id');
    }

    /** @return BelongsTo<Person, $this> */
    public function deliveredBy(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'delivered_by_id');
    }

    /** @return BelongsTo<Person, $this> */
    public function authorizedBy(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'authorized_by_id');
    }

    /** @return BelongsTo<Program, $this> */
    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    /** @return BelongsTo<Action, $this> */
    public function action(): BelongsTo
    {
        return $this->belongsTo(Action::class);
    }

    /** @return HasMany<VoucherItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(VoucherItem::class);
    }

    /** @return HasMany<VoucherAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(VoucherAttachment::class);
    }
}
