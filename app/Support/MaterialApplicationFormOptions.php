<?php

namespace App\Support;

use App\Enums\ServiceOrderType;
use App\Models\Destination;
use App\Models\DestinationAlias;

final class MaterialApplicationFormOptions
{
    /**
     * @return array{
     *     default_service_order_type: string,
     *     service_order_types: list<array{value: string, label: string}>,
     *     destinations: list<array{id: int, name: string, aliases: list<array{id: int, alias: string}>}>
     * }
     */
    public static function make(): array
    {
        $destinationModels = Destination::query()
            ->where('is_active', true)
            ->with('aliases:id,destination_id,alias')
            ->orderBy('name')
            ->get(['id', 'name']);
        $destinations = [];

        foreach ($destinationModels as $destination) {
            $aliases = [];
            foreach ($destination->aliases as $alias) {
                $aliases[] = self::alias($alias);
            }

            $destinations[] = [
                'id' => $destination->id,
                'name' => $destination->name,
                'aliases' => $aliases,
            ];
        }

        return [
            'default_service_order_type' => ServiceOrderType::default()->value,
            'service_order_types' => ServiceOrderType::options(),
            'destinations' => $destinations,
        ];
    }

    /** @return array{id: int, alias: string} */
    private static function alias(DestinationAlias $alias): array
    {
        return ['id' => $alias->id, 'alias' => $alias->alias];
    }
}
