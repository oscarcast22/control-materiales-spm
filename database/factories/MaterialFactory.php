<?php

namespace Database\Factories;

use App\Models\Material;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Material>
 */
class MaterialFactory extends Factory
{
    public function configure(): static
    {
        return $this->afterCreating(function (Material $material): void {
            $material->voucherTypes()->syncWithoutDetaching(StorageLocation::query()->pluck('id'));
        });
    }

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->sentence(3);

        return [
            'name' => $name,
            'normalized_name' => Normalizer::key($name),
            'default_unit_id' => Unit::factory(),
            'is_active' => true,
            'needs_review' => false,
        ];
    }
}
