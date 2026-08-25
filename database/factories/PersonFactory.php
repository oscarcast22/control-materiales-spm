<?php

namespace Database\Factories;

use App\Models\Person;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Person>
 */
class PersonFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->name();

        return [
            'name' => $name,
            'normalized_name' => Normalizer::key($name),
            'can_receive_material' => true,
            'can_deliver_material' => true,
            'is_active' => true,
            'needs_review' => false,
        ];
    }
}
