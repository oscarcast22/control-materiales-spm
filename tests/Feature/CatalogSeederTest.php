<?php

namespace Tests\Feature;

use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
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
        $this->assertDatabaseCount('units', 3);
        $this->assertDatabaseCount('programs', 1);
        $this->assertDatabaseCount('actions', 13);
        $this->assertDatabaseCount('vouchers', 0);
        $this->assertSame(19, Person::query()->where('needs_review', true)->count());

        $this->seed(CatalogSeeder::class);

        $this->assertDatabaseCount('materials', 377);
        $this->assertDatabaseCount('material_aliases', 414);
        $this->assertDatabaseCount('people', 45);
        $this->assertDatabaseCount('person_aliases', 55);
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
