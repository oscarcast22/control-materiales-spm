<?php

namespace Database\Factories;

use App\Models\Action;
use App\Models\Program;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Action>
 */
class ActionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'program_id' => Program::factory(),
            'code' => fake()->unique()->bothify('SPM-##-##'),
            'name' => fake()->sentence(4),
            'is_active' => true,
        ];
    }
}
