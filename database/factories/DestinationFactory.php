<?php

namespace Database\Factories;

use App\Models\Destination;
use App\Support\Normalizer;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Destination> */
class DestinationFactory extends Factory
{
    protected $model = Destination::class;

    public function definition(): array
    {
        $name = fake()->unique()->streetName();

        return [
            'name' => $name,
            'normalized_name' => Normalizer::key($name),
            'is_active' => true,
            'needs_review' => false,
        ];
    }
}
