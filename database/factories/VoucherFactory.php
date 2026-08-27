<?php

namespace Database\Factories;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Person;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Voucher>
 */
class VoucherFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $folio = (string) fake()->unique()->numberBetween(10000, 99999);

        return [
            'storage_location_id' => StorageLocation::factory(),
            'folio' => $folio,
            'folio_key' => Normalizer::folio($folio),
            'direction' => VoucherDirection::Exit,
            'issued_on' => fake()->date(),
            'issued_time' => fake()->optional()->time('H:i'),
            'received_by_id' => Person::factory(),
            'delivered_by_id' => Person::factory(),
            'authorized_by_id' => null,
            'program_id' => null,
            'destination' => fake()->streetAddress(),
            'notes' => null,
            'status' => VoucherStatus::Active,
            'needs_review' => false,
        ];
    }
}
