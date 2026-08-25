<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $source_hash
 * @property string $source_name
 * @property string $sheet_name
 * @property int $row_number
 * @property array<string, mixed> $raw_data
 * @property array<int, string>|null $issue_codes
 * @property string|null $imported_type
 * @property int|null $imported_id
 */
class LegacyImportRow extends Model
{
    protected $fillable = [
        'source_hash', 'source_name', 'sheet_name', 'row_number', 'raw_data', 'issue_codes', 'imported_type', 'imported_id',
    ];

    protected function casts(): array
    {
        return ['raw_data' => 'array', 'issue_codes' => 'array'];
    }
}
