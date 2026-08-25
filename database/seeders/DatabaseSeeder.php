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
            ['name' => 'Almacén', 'tracking_started_on' => now()->toDateString()],
        );
        StorageLocation::firstOrCreate(
            ['code' => 'yard'],
            ['name' => 'Patio', 'tracking_started_on' => now()->toDateString()],
        );

        $this->call(CatalogSeeder::class);
    }
}
