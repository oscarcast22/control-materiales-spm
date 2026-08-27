<?php

namespace Database\Factories;

use App\Models\Material;
use App\Models\StorageLocation;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<StorageLocation> */
class StorageLocationFactory extends Factory
{
    public function configure(): static
    {
        return $this->afterCreating(function (StorageLocation $location): void {
            $location->materials()->syncWithoutDetaching(Material::query()->pluck('id'));
        });
    }

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'code' => fake()->unique()->lexify('area-???'),
            'name' => fake()->unique()->word(),
            'tracking_started_on' => now()->toDateString(),
            'is_active' => true,
        ];
    }
}
