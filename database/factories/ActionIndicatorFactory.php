<?php

namespace Database\Factories;

use App\Models\Action;
use App\Models\ActionIndicator;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ActionIndicator> */
class ActionIndicatorFactory extends Factory
{
    /** @return array<string, mixed> */
    public function definition(): array
    {
        $actionCode = 'SPM-'
            .str_pad((string) fake()->numberBetween(1, 99), 2, '0', STR_PAD_LEFT)
            .'-'.str_pad((string) fake()->unique()->numberBetween(1, 99), 2, '0', STR_PAD_LEFT);

        return [
            'action_id' => Action::factory()->state(['code' => $actionCode]),
            'code' => $actionCode,
            'name' => fake()->sentence(3),
            'is_active' => true,
        ];
    }
}
