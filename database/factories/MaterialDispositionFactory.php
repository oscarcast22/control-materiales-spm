<?php

namespace Database\Factories;

use App\Enums\DispositionType;
use App\Models\MaterialDisposition;
use App\Models\VoucherItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MaterialDisposition>
 */
class MaterialDispositionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'voucher_item_id' => VoucherItem::factory(),
            'type' => DispositionType::Consumption,
            'occurred_on' => fake()->date(),
            'quantity' => fake()->randomFloat(3, 0.001, 10),
            'reference' => fake()->optional()->numerify('REP-####'),
            'destination' => fake()->optional()->streetAddress(),
            'notes' => null,
        ];
    }
}
