<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int|null $user_id
 * @property string $event
 * @property string $auditable_type
 * @property int $auditable_id
 * @property array<string, mixed>|null $before
 * @property array<string, mixed>|null $after
 */
class AuditEvent extends Model
{
    protected $fillable = ['user_id', 'event', 'auditable_type', 'auditable_id', 'before', 'after'];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array'];
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public static function record(Model $model, string $event, ?array $before = null, ?array $after = null): self
    {
        return self::create([
            'user_id' => auth()->id(),
            'event' => $event,
            'auditable_type' => $model::class,
            'auditable_id' => $model->getKey(),
            'before' => $before,
            'after' => $after,
        ]);
    }
}
