<?php

namespace Database\Factories;

use App\Models\StorageLocation;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<StorageLocation> */
class StorageLocationFactory extends Factory
{
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
