<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\Unit;
use App\Models\VoucherItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UnitPrecisionMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_production_migration_curates_liters_without_changing_quantities_or_manual_corrections(): void
    {
        $unspecified = Unit::factory()->create([
            'name' => 'Unidad sin especificar',
            'symbol' => 's/e',
        ]);
        $metre = Unit::factory()->create(['name' => 'Metro', 'symbol' => 'm']);
        $piece = Unit::factory()->create(['name' => 'Pieza', 'symbol' => 'pza']);
        $oil = Material::factory()->create([
            'name' => 'ACEITE ATF',
            'normalized_name' => 'aceite atf',
            'default_unit_id' => $unspecified->id,
        ]);
        $manuallyCorrected = Material::factory()->create([
            'name' => 'THINNER',
            'normalized_name' => 'thinner',
            'default_unit_id' => $piece->id,
        ]);
        $item = VoucherItem::factory()->create([
            'material_id' => $oil->id,
            'unit_id' => $unspecified->id,
            'quantity' => 9,
        ]);

        /** @var Migration $migration */
        $migration = require database_path('migrations/2026_09_07_180000_add_unit_precision_and_curate_liter_materials.php');
        $migration->down();
        DB::table('units')->where('symbol', 'L')->update(['symbol' => 'l']);
        $migration->up();

        $liter = Unit::query()->where('symbol', 'L')->sole();
        $this->assertSame(1, $liter->decimal_places);
        $this->assertSame(1, $metre->fresh()->decimal_places);
        $this->assertSame($liter->id, $oil->fresh()->default_unit_id);
        $this->assertSame($liter->id, $item->fresh()->unit_id);
        $this->assertSame('9.000', $item->fresh()->quantity);
        $this->assertSame($piece->id, $manuallyCorrected->fresh()->default_unit_id);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'curated_unit_applied',
            'auditable_type' => Material::class,
            'auditable_id' => $oil->id,
            'user_id' => null,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'curated_unit_applied',
            'auditable_type' => VoucherItem::class,
            'auditable_id' => $item->id,
            'user_id' => null,
        ]);
        $this->assertTrue(Schema::hasColumn('units', 'decimal_places'));
    }

    public function test_the_follow_up_migration_curates_paints_without_overwriting_manual_corrections(): void
    {
        $unspecified = Unit::factory()->create([
            'name' => 'Unidad sin especificar',
            'symbol' => 's/e',
        ]);
        $piece = Unit::factory()->create(['name' => 'Pieza', 'symbol' => 'pza']);
        $liter = Unit::query()->where('symbol', 'L')->sole();
        $paint = Material::factory()->create([
            'name' => 'PINTURA VINILICA BLANCA',
            'normalized_name' => 'pintura vinilica blanca',
            'default_unit_id' => $unspecified->id,
        ]);
        $manuallyCorrected = Material::factory()->create([
            'name' => 'PINTURA NEGRA',
            'normalized_name' => 'pintura negra',
            'default_unit_id' => $piece->id,
        ]);
        $item = VoucherItem::factory()->create([
            'material_id' => $paint->id,
            'unit_id' => $unspecified->id,
            'quantity' => 2.375,
        ]);

        /** @var Migration $migration */
        $migration = require database_path('migrations/2026_09_07_190000_curate_paint_materials_as_liters.php');
        $migration->up();
        $migration->up();

        $this->assertSame($liter->id, $paint->fresh()->default_unit_id);
        $this->assertSame($liter->id, $item->fresh()->unit_id);
        $this->assertSame('2.375', $item->fresh()->quantity);
        $this->assertSame($piece->id, $manuallyCorrected->fresh()->default_unit_id);
        $this->assertDatabaseCount('audit_events', 2);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'curated_unit_applied',
            'auditable_type' => Material::class,
            'auditable_id' => $paint->id,
            'user_id' => null,
        ]);
        $this->assertDatabaseHas('audit_events', [
            'event' => 'curated_unit_applied',
            'auditable_type' => VoucherItem::class,
            'auditable_id' => $item->id,
            'user_id' => null,
        ]);
    }
}
