<?php

namespace Database\Seeders;

use App\Models\StorageLocation;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        StorageLocation::firstOrCreate(
            ['code' => 'warehouse'],
            ['name' => 'Almacén', 'tracking_started_on' => '2026-01-01'],
        );
        StorageLocation::firstOrCreate(
            ['code' => 'yard'],
            ['name' => 'Patio', 'tracking_started_on' => '2026-01-01'],
        );

        $this->call(CatalogSeeder::class);
    }
}
