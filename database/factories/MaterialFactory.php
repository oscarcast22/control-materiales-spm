<?php

namespace Database\Factories;

use App\Models\Material;
use App\Models\Unit;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Material>
 */
class MaterialFactory extends Factory
{
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
