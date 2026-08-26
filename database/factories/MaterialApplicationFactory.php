<?php

namespace Database\Factories;

use App\Models\MaterialApplication;
use App\Models\VoucherItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<MaterialApplication> */
class MaterialApplicationFactory extends Factory
{
    protected $model = MaterialApplication::class;

    public function definition(): array
    {
        return [
            'voucher_item_id' => VoucherItem::factory(),
            'occurred_on' => fake()->dateTimeBetween('2026-01-01'),
            'quantity' => fake()->randomFloat(3, 0.1, 5),
            'reference' => fake()->optional()->numerify('Reporte ####'),
        ];
    }
}
