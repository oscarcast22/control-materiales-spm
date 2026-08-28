<?php

namespace App\Support;

use App\Models\StorageLocation;
use Illuminate\Http\Request;

final class VoucherTypeScope
{
    public const ALL = 'all';

    public function resolve(Request $request): ?int
    {
        $value = trim((string) $request->input('voucher_type_id', ''));

        if ($value === self::ALL) {
            return null;
        }

        $default = $this->defaultId();

        if ($value === '' || ! ctype_digit($value)) {
            return $default;
        }

        $id = (int) $value;

        return StorageLocation::query()
            ->whereKey($id)
            ->where('is_active', true)
            ->exists()
                ? $id
                : $default;
    }

    public function defaultId(): ?int
    {
        return StorageLocation::query()
            ->where('code', 'warehouse')
            ->where('is_active', true)
            ->value('id');
    }
}
