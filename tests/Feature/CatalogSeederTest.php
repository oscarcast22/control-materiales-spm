<?php

namespace Tests\Feature;

use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\VoucherItem;
use App\Support\CuratedDestinationCatalog;
use App\Support\Normalizer;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_clean_installation_starts_tracking_on_the_mandatory_date(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame([
            'warehouse' => '2026-01-01',
            'yard' => '2026-01-01',
        ], StorageLocation::query()
            ->orderBy('code')
            ->get()
            ->mapWithKeys(fn (StorageLocation $location): array => [
                $location->code => $location->tracking_started_on->toDateString(),
            ])
            ->all());
    }

    public function test_the_curated_catalog_is_seeded_without_excel_and_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('materials', 843);
        $this->assertDatabaseCount('material_aliases', 879);
        $this->assertDatabaseCount('material_storage_location', 860);
        $this->assertDatabaseCount('people', 44);
        $this->assertDatabaseCount('person_aliases', 56);
        $this->assertDatabaseCount('destinations', 309);
        $this->assertDatabaseCount('destination_aliases', 7);
        $this->assertDatabaseCount('units', 7);
        $this->assertDatabaseCount('programs', 1);
        $this->assertTrue(Schema::hasTable('actions'));
        $this->assertDatabaseCount('actions', 1);
        $this->assertDatabaseCount('vouchers', 0);
        $this->assertSame(18, Person::query()->where('needs_review', true)->count());
        $this->assertSame(176, Material::query()->where('needs_review', true)->count());
        $this->assertSame(760, StorageLocation::query()->where('code', 'warehouse')->sole()->materials()->count());
        $this->assertSame(100, StorageLocation::query()->where('code', 'yard')->sole()->materials()->count());
        $this->assertSame(2, Person::query()->where('can_deliver_material', true)->count());
        $this->assertSame(0, Person::query()
            ->whereIn('normalized_name', ['nelson treto', 'fco fierro'])
            ->where('can_receive_material', true)
            ->count());
        $this->assertSame(1, Person::query()->where('can_authorize_material', true)->count());
        $this->assertDatabaseHas('person_aliases', [
            'normalized_alias' => 'piano',
            'person_id' => Person::query()->where('normalized_name', 'cipriano salas')->sole()->id,
        ]);
        $this->assertDatabaseHas('destination_aliases', [
            'normalized_alias' => 'vientisiete de noviembre',
            'destination_id' => Destination::query()->where('normalized_name', 'poblado veintisiete de noviembre')->sole()->id,
        ]);
        $destinationMappings = app(CuratedDestinationCatalog::class)->legacyMappings();
        $this->assertSame(527, count($destinationMappings));
        $this->assertSame(70, collect($destinationMappings)->where('needs_review', true)->count());
        $this->assertSame([
            'destinations' => ['Poblado Otinapa'],
            'usage_description' => 'Mantenimiento',
            'needs_review' => false,
        ], $destinationMappings['mto poblado otinapa']);
        $this->assertSame([
            'destinations' => ['Aquiles Serdan'],
            'usage_description' => 'Mantenimiento',
            'needs_review' => false,
        ], $destinationMappings['mnto aquiles serdan']);
        $this->assertSame([
            'destinations' => ['Av. Circuito Interior'],
            'usage_description' => 'Mantenimiento',
            'needs_review' => false,
        ], $destinationMappings['mnto av circuito interior']);
        $this->assertSame([
            'destinations' => ['Acereros'],
            'usage_description' => 'Fortalecimiento',
            'needs_review' => false,
        ], $destinationMappings['fortalecimiento acereros']);
        $this->assertSame([
            'destinations' => [],
            'usage_description' => 'Mantenimiento: Poblado el Nayar y el Tunal',
            'needs_review' => true,
        ], $destinationMappings['mtno poblado el nayar y el tunal']);
        $this->assertDatabaseMissing('destination_aliases', [
            'normalized_alias' => 'mto poblado otinapa',
        ]);
        $this->assertDatabaseMissing('destination_aliases', [
            'normalized_alias' => 'poblado otinapa',
        ]);
        $this->assertDatabaseHas('destinations', ['normalized_name' => 'fco villa viejo']);
        $this->assertSame([], Destination::query()
            ->pluck('normalized_name')
            ->filter(fn (string $name): bool => preg_match(
                '/^(mto|mnto|mtno|mantenimiento|fort|fortalecimiento|fortalecimineto|fabricacion|reportes?|alumbrado|iluminacion|domo|circuitos?)\b/',
                $name,
            ) === 1)
            ->values()
            ->all());
        $knownDestinationKeys = Destination::query()->pluck('normalized_name')
            ->merge(DestinationAlias::query()->pluck('normalized_alias'))
            ->unique();
        $referencedDestinationKeys = collect($destinationMappings)
            ->flatMap(fn (array $mapping): array => $mapping['destinations'])
            ->map(fn (string $name): string => Normalizer::key($name))
            ->unique();
        $this->assertSame([], $referencedDestinationKeys->diff($knownDestinationKeys)->values()->all());

        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseCount('materials', 843);
        $this->assertDatabaseCount('material_aliases', 879);
        $this->assertDatabaseCount('material_storage_location', 860);
        $this->assertDatabaseCount('people', 44);
        $this->assertDatabaseCount('person_aliases', 56);
        $this->assertDatabaseCount('destinations', 309);
        $this->assertDatabaseCount('destination_aliases', 7);

        $this->assertSame([
            'jgo' => 4,
            'kg' => 2,
            'm' => 45,
            'm³' => 2,
            'pza' => 552,
            'rollo' => 39,
            's/e' => 199,
        ], Unit::query()
            ->withCount('materials')
            ->get()
            ->mapWithKeys(fn (Unit $unit): array => [$unit->symbol => $unit->materials_count])
            ->sortKeys()
            ->all());
    }

    public function test_reseeding_only_upgrades_unspecified_material_units(): void
    {
        $this->seed(DatabaseSeeder::class);

        $unspecified = Unit::query()->where('symbol', 's/e')->sole();
        $piece = Unit::query()->where('symbol', 'pza')->sole();
        $bracket = Material::query()->where('normalized_name', 'abrazadera 1bs')->sole();
        $cable = Material::query()->where('normalized_name', 'cable thw 12')->sole();
        $bracket->update(['default_unit_id' => $unspecified->id]);
        $cable->update(['default_unit_id' => $piece->id]);

        $this->seed(DatabaseSeeder::class);

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
        $this->seed(DatabaseSeeder::class);

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

    public function test_safe_aliases_are_merged_and_spreadsheet_headers_remain_distinct(): void
    {
        $this->seed(DatabaseSeeder::class);

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
        $this->assertTrue(Material::query()->where('normalized_name', 'bastidor')->exists());
        $this->assertFalse(Material::query()->where('normalized_name', 'bastidor b4')->exists());
        $this->assertTrue(Material::query()->where('normalized_name', 'soldadura 60 11')->exists());
        $this->assertFalse(Material::query()->where('normalized_name', 'soldadura 7018')->exists());
        $this->assertDatabaseHas('materials', [
            'normalized_name' => 'cintas de aislar de vinilo temflex',
            'default_unit_id' => Unit::query()->where('symbol', 'rollo')->sole()->id,
            'needs_review' => false,
        ]);
        $this->assertDatabaseHas('materials', [
            'normalized_name' => 'alambre desnudo de cobre cal 6',
            'default_unit_id' => Unit::query()->where('symbol', 's/e')->sole()->id,
            'needs_review' => true,
        ]);
    }
}
