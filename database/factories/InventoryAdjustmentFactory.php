<?php

namespace Database\Factories;

use App\Models\InventoryAdjustment;
use App\Models\Material;
use App\Models\StorageLocation;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<InventoryAdjustment> */
class InventoryAdjustmentFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'storage_location_id' => StorageLocation::factory(),
            'material_id' => Material::factory(),
            'unit_id' => Unit::factory(),
            'occurred_on' => now()->toDateString(),
            'quantity_delta' => fake()->randomFloat(3, -10, 10),
            'reason' => fake()->sentence(),
        ];
    }
}
