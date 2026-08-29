<?php

use App\Models\VoucherItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Align the material name and unit stored with every voucher item to the
     * current canonical material catalog. Quantities are deliberately left
     * untouched: this is a correction of catalog references, not a conversion.
     */
    public function up(): void
    {
        DB::transaction(function (): void {
            DB::table('voucher_items')
                ->join('materials', 'materials.id', '=', 'voucher_items.material_id')
                ->select([
                    'voucher_items.id',
                    'voucher_items.description_snapshot',
                    'voucher_items.unit_id',
                    'materials.name as canonical_name',
                    'materials.default_unit_id as canonical_unit_id',
                ])
                ->orderBy('voucher_items.id')
                ->chunkById(100, function ($items): void {
                    foreach ($items as $item) {
                        if ($item->description_snapshot === $item->canonical_name
                            && (int) $item->unit_id === (int) $item->canonical_unit_id) {
                            continue;
                        }

                        $before = [
                            'description_snapshot' => $item->description_snapshot,
                            'unit_id' => (int) $item->unit_id,
                        ];
                        $after = [
                            'description_snapshot' => $item->canonical_name,
                            'unit_id' => (int) $item->canonical_unit_id,
                        ];

                        DB::table('voucher_items')->where('id', $item->id)->update([
                            ...$after,
                            'updated_at' => now(),
                        ]);
                        DB::table('audit_events')->insert([
                            'user_id' => null,
                            'event' => 'canonicalized',
                            'auditable_type' => VoucherItem::class,
                            'auditable_id' => $item->id,
                            'before' => json_encode($before, JSON_THROW_ON_ERROR),
                            'after' => json_encode($after, JSON_THROW_ON_ERROR),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }, 'voucher_items.id', 'id');
        });
    }

    /**
     * The previous arbitrary catalog values cannot be reconstructed safely.
     */
    public function down(): void
    {
        // Intentionally irreversible.
    }
};
