<?php

namespace Tests\Feature;

use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Unit;
use App\Models\VoucherItem;
use Database\Seeders\CatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_curated_catalog_is_seeded_without_excel_and_is_idempotent(): void
    {
        $this->seed(CatalogSeeder::class);

        $this->assertDatabaseCount('materials', 377);
        $this->assertDatabaseCount('material_aliases', 414);
        $this->assertDatabaseCount('people', 45);
        $this->assertDatabaseCount('person_aliases', 55);
        $this->assertDatabaseCount('units', 7);
        $this->assertDatabaseCount('programs', 1);
        $this->assertDatabaseCount('actions', 13);
        $this->assertDatabaseCount('vouchers', 0);
        $this->assertSame(19, Person::query()->where('needs_review', true)->count());

        $this->seed(CatalogSeeder::class);

        $this->assertDatabaseCount('materials', 377);
        $this->assertDatabaseCount('material_aliases', 414);
        $this->assertDatabaseCount('people', 45);
        $this->assertDatabaseCount('person_aliases', 55);

        $this->assertSame([
            'jgo' => 4,
            'kg' => 4,
            'm' => 28,
            'm³' => 2,
            'pza' => 303,
            'rollo' => 7,
            's/e' => 29,
        ], Unit::query()
            ->withCount('materials')
            ->get()
            ->mapWithKeys(fn (Unit $unit): array => [$unit->symbol => $unit->materials_count])
            ->sortKeys()
            ->all());
    }

    public function test_reseeding_only_upgrades_unspecified_material_units(): void
    {
        $this->seed(CatalogSeeder::class);

        $unspecified = Unit::query()->where('symbol', 's/e')->sole();
        $piece = Unit::query()->where('symbol', 'pza')->sole();
        $bracket = Material::query()->where('normalized_name', 'abrazadera 1bs')->sole();
        $cable = Material::query()->where('normalized_name', 'cable thw 12')->sole();
        $bracket->update(['default_unit_id' => $unspecified->id]);
        $cable->update(['default_unit_id' => $piece->id]);

        $this->seed(CatalogSeeder::class);

        $this->assertSame('pza', $bracket->fresh()->defaultUnit->symbol);
        $this->assertSame('pza', $cable->fresh()->defaultUnit->symbol);
        $this->assertDatabaseHas('audit_events', [
            'auditable_type' => Material::class,
            'auditable_id' => $bracket->id,
            'event' => 'curated_unit_applied',
        ]);
        $this->assertDatabaseMissing('audit_events', [
            'auditable_type' => Material::class,
            'auditable_id' => $cable->id,
            'event' => 'curated_unit_applied',
        ]);
    }

    public function test_curated_units_can_be_previewed_and_applied_to_traced_legacy_items(): void
    {
        $this->seed(CatalogSeeder::class);

        $unspecified = Unit::query()->where('symbol', 's/e')->sole();
        $material = Material::query()->where('normalized_name', 'abrazadera 1bs')->sole();
        $material->update(['default_unit_id' => $unspecified->id]);
        $traced = VoucherItem::factory()->create([
            'material_id' => $material->id,
            'unit_id' => $unspecified->id,
            'quantity' => 3,
        ]);
        $untraced = VoucherItem::factory()->create([
            'material_id' => $material->id,
            'unit_id' => $unspecified->id,
            'quantity' => 2,
        ]);
        LegacyImportRow::create([
            'source_hash' => str_repeat('a', 64),
            'source_name' => 'prueba.xlsx',
            'sheet_name' => 'victor',
            'row_number' => 2,
            'raw_data' => [],
            'imported_type' => VoucherItem::class,
            'imported_id' => $traced->id,
        ]);
        $pendingBefore = $traced->pendingQuantity();

        $this->artisan('catalog:sync-material-units')
            ->expectsOutputToContain('Simulación completa')
            ->assertSuccessful();
        $this->assertSame('s/e', $material->fresh()->defaultUnit->symbol);
        $this->assertSame('s/e', $traced->fresh()->unit->symbol);

        $this->artisan('catalog:sync-material-units', ['--apply' => true])
            ->expectsOutputToContain('1 materiales y 1 partidas históricas actualizadas')
            ->assertSuccessful();

        $this->assertSame('pza', $material->fresh()->defaultUnit->symbol);
        $this->assertSame('pza', $traced->fresh()->unit->symbol);
        $this->assertSame('s/e', $untraced->fresh()->unit->symbol);
        $this->assertSame($pendingBefore, $traced->fresh()->pendingQuantity());
        $this->assertDatabaseCount('audit_events', 2);

        $this->artisan('catalog:sync-material-units', ['--apply' => true])
            ->expectsOutputToContain('0 materiales y 0 partidas históricas actualizadas')
            ->assertSuccessful();
        $this->assertDatabaseCount('audit_events', 2);
    }

    public function test_safe_aliases_are_merged_and_different_specs_remain_separate(): void
    {
        $this->seed(CatalogSeeder::class);

        $abbreviation = MaterialAlias::query()->where('normalized_alias', 'abrazadera 2 bs')->firstOrFail();
        $this->assertSame('ABRAZADERA 2BS', $abbreviation->material->name);
        $this->assertSame(
            'INTERRUPTOR TERMO MAGNETICO 2*30',
            MaterialAlias::query()->where('normalized_alias', 'interruptor termomagnetico 2 30')->firstOrFail()->material->name,
        );
        $this->assertSame(
            'Erick Aguilar',
            PersonAlias::query()->where('normalized_alias', 'erk')->firstOrFail()->person->name,
        );
        $this->assertSame(
            'Leonel Domínguez',
            PersonAlias::query()->where('normalized_alias', 'leonel dguez')->firstOrFail()->person->name,
        );

        $this->assertTrue(Material::query()->where('normalized_name', 'bastidor b1')->exists());
        $this->assertTrue(Material::query()->where('normalized_name', 'bastidor b4')->exists());
        $this->assertTrue(Material::query()->where('normalized_name', 'soldadura 60 11')->exists());
        $this->assertTrue(Material::query()->where('normalized_name', 'soldadura 7018')->exists());
    }
}
