<?php

namespace Database\Factories;

use App\Models\Action;
use App\Models\Program;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Action> */
class ActionFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $suffix = fake()->unique()->numberBetween(1, 99);

        return [
            'program_id' => Program::factory(),
            'code' => 'SPM-'.fake()->numberBetween(1, 99).'-'.str_pad((string) $suffix, 2, '0', STR_PAD_LEFT),
            'name' => fake()->optional()->sentence(3),
            'is_active' => true,
        ];
    }
}
