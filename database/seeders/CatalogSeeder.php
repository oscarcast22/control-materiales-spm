<?php

namespace Database\Seeders;

use App\Models\Action;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Program;
use App\Models\Unit;
use App\Support\Normalizer;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use JsonException;
use RuntimeException;

class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $units = $this->seedUnits();
            $this->seedMaterials($units);
            $this->seedPeople();
            $this->seedPrograms();
        });
    }

    /** @return array<string, Unit> */
    private function seedUnits(): array
    {
        $units = [];
        foreach ([
            ['name' => 'Pieza', 'symbol' => 'pza'],
            ['name' => 'Metro', 'symbol' => 'm'],
            ['name' => 'Unidad sin especificar', 'symbol' => 's/e'],
        ] as $data) {
            $units[$data['symbol']] = Unit::firstOrCreate(['symbol' => $data['symbol']], $data);
        }

        return $units;
    }

    /** @param array<string, Unit> $units */
    private function seedMaterials(array $units): void
    {
        foreach ($this->materialData() as $data) {
            $key = Normalizer::key($data['name']);
            $knownAlias = MaterialAlias::query()->where('normalized_alias', $key)->first();
            $material = $knownAlias
                ? $knownAlias->material
                : Material::query()->where('normalized_name', $key)->first();
            if (! $material) {
                $unit = $units[$data['unit']] ?? throw new RuntimeException("Unidad desconocida: {$data['unit']}");
                $material = Material::create([
                    'name' => $data['name'],
                    'normalized_name' => $key,
                    'default_unit_id' => $unit->id,
                    'needs_review' => false,
                ]);
            }

            $this->seedMaterialAliases($material, [$data['name'], ...$data['aliases']]);
        }
    }

    /** @param list<string> $aliases */
    private function seedMaterialAliases(Material $material, array $aliases): void
    {
        foreach ($aliases as $alias) {
            $key = Normalizer::key($alias);
            if ($key === '' || MaterialAlias::query()->where('normalized_alias', $key)->exists()) {
                continue;
            }
            MaterialAlias::create([
                'material_id' => $material->id,
                'alias' => $alias,
                'normalized_alias' => $key,
            ]);
        }
    }

    private function seedPeople(): void
    {
        foreach ($this->peopleData() as $data) {
            $key = Normalizer::key($data['name']);
            $knownAlias = PersonAlias::query()->where('normalized_alias', $key)->first();
            $person = $knownAlias
                ? $knownAlias->person
                : Person::query()->where('normalized_name', $key)->first();
            if (! $person) {
                $person = Person::create([
                    'name' => $data['name'],
                    'normalized_name' => $key,
                    'can_receive_material' => $data['can_receive_material'],
                    'can_deliver_material' => $data['can_deliver_material'],
                    'needs_review' => $data['needs_review'],
                ]);
            } else {
                $person->update([
                    'can_receive_material' => $person->can_receive_material || $data['can_receive_material'],
                    'can_deliver_material' => $person->can_deliver_material || $data['can_deliver_material'],
                ]);
            }

            $this->seedPersonAliases($person, [$data['name'], ...$data['aliases']]);
        }
    }

    /** @param list<string> $aliases */
    private function seedPersonAliases(Person $person, array $aliases): void
    {
        foreach ($aliases as $alias) {
            $key = Normalizer::key($alias);
            if ($key === '' || PersonAlias::query()->where('normalized_alias', $key)->exists()) {
                continue;
            }
            PersonAlias::create([
                'person_id' => $person->id,
                'alias' => $alias,
                'normalized_alias' => $key,
            ]);
        }
    }

    private function seedPrograms(): void
    {
        $program = Program::firstOrCreate(['code' => 'SPM-06'], ['name' => 'Alumbrado público']);
        foreach ([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 17] as $number) {
            $code = sprintf('SPM-06-%02d', $number);
            Action::firstOrCreate(['code' => $code], ['program_id' => $program->id]);
        }
    }

    /** @return list<array{name: string, unit: string, aliases: list<string>}> */
    private function materialData(): array
    {
        $rows = $this->json('materials.json');
        $result = [];
        foreach ($rows as $row) {
            if (! is_array($row) || ! is_string($row['name'] ?? null) || ! is_string($row['unit'] ?? null)) {
                throw new RuntimeException('El catálogo de materiales contiene un registro inválido.');
            }
            $result[] = [
                'name' => $row['name'],
                'unit' => $row['unit'],
                'aliases' => $this->strings($row['aliases'] ?? null, 'materiales'),
            ];
        }

        return $result;
    }

    /** @return list<array{name: string, can_receive_material: bool, can_deliver_material: bool, needs_review: bool, aliases: list<string>}> */
    private function peopleData(): array
    {
        $rows = $this->json('people.json');
        $result = [];
        foreach ($rows as $row) {
            if (
                ! is_array($row)
                || ! is_string($row['name'] ?? null)
                || ! is_bool($row['can_receive_material'] ?? null)
                || ! is_bool($row['can_deliver_material'] ?? null)
                || ! is_bool($row['needs_review'] ?? null)
            ) {
                throw new RuntimeException('El catálogo de personas contiene un registro inválido.');
            }
            $result[] = [
                'name' => $row['name'],
                'can_receive_material' => $row['can_receive_material'],
                'can_deliver_material' => $row['can_deliver_material'],
                'needs_review' => $row['needs_review'],
                'aliases' => $this->strings($row['aliases'] ?? null, 'personas'),
            ];
        }

        return $result;
    }

    /** @return list<mixed> */
    private function json(string $file): array
    {
        $contents = file_get_contents(database_path("data/{$file}"));
        if ($contents === false) {
            throw new RuntimeException("No se pudo leer database/data/{$file}.");
        }
        try {
            $data = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException("El archivo {$file} no contiene JSON válido.", previous: $exception);
        }
        if (! is_array($data) || ! array_is_list($data)) {
            throw new RuntimeException("El archivo {$file} debe contener una lista.");
        }

        return $data;
    }

    /** @return list<string> */
    private function strings(mixed $value, string $catalog): array
    {
        if (! is_array($value) || ! array_is_list($value)) {
            throw new RuntimeException("El catálogo de {$catalog} contiene alias inválidos.");
        }
        $result = [];
        foreach ($value as $item) {
            if (! is_string($item)) {
                throw new RuntimeException("El catálogo de {$catalog} contiene un alias inválido.");
            }
            $result[] = $item;
        }

        return $result;
    }
}
