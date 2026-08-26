<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $application_report_id
 * @property string $disk
 * @property string $path
 * @property string $original_name
 * @property string $mime_type
 * @property int $size
 * @property-read MaterialApplicationReport $report
 */
class MaterialApplicationAttachment extends Model
{
    protected $fillable = [
        'application_report_id', 'disk', 'path', 'original_name', 'mime_type', 'size', 'uploaded_by',
    ];

    /** @return BelongsTo<MaterialApplicationReport, $this> */
    public function report(): BelongsTo
    {
        return $this->belongsTo(MaterialApplicationReport::class, 'application_report_id');
    }
}
