<?php

use App\Models\Material;
use App\Models\VoucherItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var list<string> */
    private const PAINT_MATERIAL_KEYS = [
        'pintura amarillo',
        'pintura azul marino',
        'pintura dorado',
        'pintura esmalte blanca',
        'pintura esmalte negra',
        'pintura esmalte verde',
        'pintura gris',
        'pintura negra',
        'pintura vinilica blanca',
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            $literId = DB::table('units')->where('symbol', 'L')->value('id');
            $unspecifiedId = DB::table('units')->where('symbol', 's/e')->value('id');

            if ($literId === null || $unspecifiedId === null) {
                return;
            }

            foreach (self::PAINT_MATERIAL_KEYS as $key) {
                $materialId = DB::table('material_aliases')
                    ->where('normalized_alias', $key)
                    ->value('material_id')
                    ?? DB::table('materials')
                        ->where('normalized_name', $key)
                        ->value('id');

                if ($materialId === null) {
                    continue;
                }

                $material = DB::table('materials')->where('id', $materialId)->first();
                if ($material === null || ! in_array((int) $material->default_unit_id, [(int) $unspecifiedId, (int) $literId], true)) {
                    continue;
                }

                if ((int) $material->default_unit_id === (int) $unspecifiedId) {
                    $this->updateMaterial((int) $material->id, (int) $unspecifiedId, (int) $literId);
                }

                $this->updateVoucherItems((int) $material->id, (int) $literId);
            }
        });
    }

    public function down(): void
    {
        // The previous unit cannot be reconstructed safely after a catalog
        // correction, so the audited canonical values are preserved.
    }

    private function updateMaterial(int $materialId, int $beforeUnitId, int $literId): void
    {
        $now = now();
        DB::table('materials')->where('id', $materialId)->update([
            'default_unit_id' => $literId,
            'updated_at' => $now,
        ]);
        DB::table('audit_events')->insert([
            'user_id' => null,
            'event' => 'curated_unit_applied',
            'auditable_type' => Material::class,
            'auditable_id' => $materialId,
            'before' => json_encode(['default_unit_id' => $beforeUnitId], JSON_THROW_ON_ERROR),
            'after' => json_encode(['default_unit_id' => $literId], JSON_THROW_ON_ERROR),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    private function updateVoucherItems(int $materialId, int $literId): void
    {
        DB::table('voucher_items')
            ->where('material_id', $materialId)
            ->where('unit_id', '!=', $literId)
            ->select(['id', 'unit_id'])
            ->orderBy('id')
            ->chunkById(100, function ($items) use ($literId): void {
                foreach ($items as $item) {
                    $now = now();
                    DB::table('voucher_items')->where('id', $item->id)->update([
                        'unit_id' => $literId,
                        'updated_at' => $now,
                    ]);
                    DB::table('audit_events')->insert([
                        'user_id' => null,
                        'event' => 'curated_unit_applied',
                        'auditable_type' => VoucherItem::class,
                        'auditable_id' => $item->id,
                        'before' => json_encode(['unit_id' => (int) $item->unit_id], JSON_THROW_ON_ERROR),
                        'after' => json_encode(['unit_id' => $literId], JSON_THROW_ON_ERROR),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            });
    }
};
