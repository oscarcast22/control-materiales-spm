<?php

namespace Database\Factories;

use App\Models\Material;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VoucherItem>
 */
class VoucherItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'voucher_id' => Voucher::factory(),
            'material_id' => Material::factory(),
            'unit_id' => Unit::factory(),
            'description_snapshot' => fake()->words(3, true),
            'quantity' => fake()->randomFloat(3, 1, 100),
            'legacy_anomaly' => false,
        ];
    }
}
