<?php

use App\Models\Material;
use App\Models\VoucherItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var list<string> */
    private const LITER_MATERIAL_KEYS = [
        'aceite atf',
        'aceite h 300 grua',
        'aceite hidraulico',
        'aceite motor a gasolina',
        'anticongelante',
        'liquido para frenos',
        'thinner',
    ];

    public function up(): void
    {
        Schema::table('units', function (Blueprint $table): void {
            $table->unsignedTinyInteger('decimal_places')->default(0)->after('symbol');
        });

        DB::transaction(function (): void {
            $literId = $this->ensureLiterUnit();

            DB::table('units')
                ->whereRaw('LOWER(symbol) = ?', ['m'])
                ->update(['decimal_places' => 1, 'updated_at' => now()]);

            $unspecifiedId = DB::table('units')
                ->where('symbol', 's/e')
                ->value('id');

            if ($unspecifiedId === null) {
                return;
            }

            foreach (self::LITER_MATERIAL_KEYS as $key) {
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
                if ($material === null || ! in_array((int) $material->default_unit_id, [(int) $unspecifiedId, $literId], true)) {
                    continue;
                }

                if ((int) $material->default_unit_id === (int) $unspecifiedId) {
                    $this->updateMaterial((int) $material->id, (int) $unspecifiedId, $literId);
                }

                $this->updateVoucherItems((int) $material->id, $literId);
            }
        });
    }

    public function down(): void
    {
        // Catalog corrections are intentionally preserved; only the code-facing
        // precision field can be removed safely during a rollback.
        Schema::table('units', function (Blueprint $table): void {
            $table->dropColumn('decimal_places');
        });
    }

    private function ensureLiterUnit(): int
    {
        $matches = DB::table('units')
            ->whereRaw('LOWER(symbol) = ?', ['l'])
            ->orderBy('id')
            ->get();

        if ($matches->count() > 1) {
            throw new RuntimeException('Existen varias unidades con el símbolo L. Corrige el catálogo antes de migrar.');
        }

        $now = now();
        $liter = $matches->first();
        if ($liter !== null) {
            DB::table('units')->where('id', $liter->id)->update([
                'name' => 'Litro',
                'symbol' => 'L',
                'decimal_places' => 1,
                'is_active' => true,
                'updated_at' => $now,
            ]);

            return (int) $liter->id;
        }

        return (int) DB::table('units')->insertGetId([
            'name' => 'Litro',
            'symbol' => 'L',
            'decimal_places' => 1,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
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
