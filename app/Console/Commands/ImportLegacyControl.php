<?php

namespace App\Console\Commands;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\Destination;
use App\Models\DestinationAlias;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\CuratedDestinationCatalog;
use App\Support\LegacyControlWorkbook;
use App\Support\Normalizer;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

#[Signature('legacy:import-control
    {file : Ruta de Captura de vales 2025 (1).xlsx}
    {--dry-run}')]
#[Description('Importa únicamente los vales de agosto de 2026 desde el control actualizado')]
class ImportLegacyControl extends Command
{
    /** @var array<string, int> */
    private array $stats = [
        'source_rows_august_2026' => 0,
        'vouchers_ready' => 0,
        'loaned_ready' => 0,
        'cancelled_ready' => 0,
        'invalid_skipped' => 0,
        'items_ready' => 0,
    ];

    public function handle(LegacyControlWorkbook $workbook, CuratedDestinationCatalog $destinationCatalog): int
    {
        $path = realpath((string) $this->argument('file'));
        if ($path === false || ! is_file($path)) {
            $this->error('No se encontró el archivo indicado.');

            return self::FAILURE;
        }
        $hash = hash_file('sha256', $path);
        if ($hash === false) {
            $this->error('No se pudo calcular la huella del archivo.');

            return self::FAILURE;
        }
        if (! $this->option('dry-run') && LegacyImportRow::query()->where('source_hash', $hash)->exists()) {
            $this->warn('Este archivo ya fue importado; no se realizaron cambios.');

            return self::SUCCESS;
        }

        try {
            $rows = $workbook->read($path);
            $this->stats['source_rows_august_2026'] = count($rows);
            $plan = $this->plan($rows, $destinationCatalog->legacyMappings());
            $this->ensureNoVoucherConflicts($plan);

            if ($this->option('dry-run')) {
                $this->line('Simulación completa. El archivo no fue persistido por --dry-run.');
            } else {
                DB::transaction(fn () => $this->persist($plan, $hash, basename($path)));
            }

            $this->summary($plan);

            return self::SUCCESS;
        } catch (Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     * @param  array<string, array{destinations: list<string>, usage_description: string|null, needs_review: bool}>  $destinationMappings
     * @return list<array{source: array<string, mixed>, issues: list<string>, voucher: array<string, mixed>|null}>
     */
    private function plan(array $rows, array $destinationMappings): array
    {
        $authorizers = Person::query()
            ->where('is_active', true)
            ->where('can_authorize_material', true)
            ->get();
        $authorizerId = $authorizers->count() === 1 ? $authorizers->firstOrFail()->id : null;
        $plan = [];

        foreach ($rows as $row) {
            $statusKey = Normalizer::key((string) $row['raw_status']);
            if ($statusKey === 'cancelado') {
                $issues = trim((string) $row['folio']) === '' ? ['missing_folio'] : [];
                $voucher = $issues === [] ? [
                    'storage_location_id' => $this->voucherTypeId($row),
                    'folio' => trim((string) $row['folio']),
                    'direction' => null,
                    'issued_on' => $row['date'],
                    'received_by_id' => null,
                    'delivered_by_id' => null,
                    'authorized_by_id' => null,
                    'program_id' => null,
                    'action_id' => null,
                    'usage_description' => null,
                    'destination_ids' => [],
                    'status' => VoucherStatus::Cancelled,
                    'cancelled_at' => now(),
                    'cancellation_reason' => 'Cancelado en el archivo de origen para conservar la numeración.',
                    'items' => [],
                ] : null;
                if ($voucher) {
                    $this->stats['vouchers_ready']++;
                    $this->stats['cancelled_ready']++;
                } else {
                    $this->stats['invalid_skipped']++;
                }
                $plan[] = ['source' => $row, 'issues' => $issues, 'voucher' => $voucher];

                continue;
            }

            if ($statusKey === 'prestado') {
                $issues = [];
                if (trim((string) $row['folio']) === '') {
                    $issues[] = 'missing_folio';
                }
                if (trim((string) $row['receiver']) === '') {
                    $issues[] = 'missing_loan_holder';
                }
                $voucher = $issues === [] ? [
                    'storage_location_id' => $this->voucherTypeId($row),
                    'folio' => trim((string) $row['folio']),
                    'direction' => null,
                    'issued_on' => $row['date'],
                    'received_by_id' => null,
                    'delivered_by_id' => null,
                    'authorized_by_id' => $authorizerId,
                    'program_id' => null,
                    'action_id' => null,
                    'usage_description' => null,
                    'destination_ids' => [],
                    'status' => VoucherStatus::Loaned,
                    'loaned_to_name' => trim((string) $row['receiver']),
                    'loaned_on' => $row['date'],
                    'items' => [],
                ] : null;
                if ($voucher) {
                    $this->stats['vouchers_ready']++;
                    $this->stats['loaned_ready']++;
                } else {
                    $this->stats['invalid_skipped']++;
                }
                $plan[] = ['source' => $row, 'issues' => $issues, 'voucher' => $voucher];

                continue;
            }

            $issues = [];
            $direction = match ($statusKey) {
                'salida' => VoucherDirection::Exit,
                'entrada' => VoucherDirection::Entry,
                default => null,
            };
            if ($direction === null) {
                $issues[] = 'invalid_movement';
            }
            foreach (['folio', 'destination', 'receiver', 'deliverer'] as $field) {
                if (trim((string) $row[$field]) === '') {
                    $issues[] = "missing_{$field}";
                }
            }
            if ($row['items'] === []) {
                $issues[] = 'missing_materials';
            }
            if ($authorizerId === null) {
                $issues[] = 'authorizer_not_unique';
            }

            $destinationData = $this->destination((string) $row['destination'], $destinationMappings);
            $issues = [...$issues, ...$destinationData['issues']];

            $receiver = $this->person((string) $row['receiver'], 'can_receive_material');
            $deliverer = $this->person((string) $row['deliverer'], 'can_deliver_material');
            if (trim((string) $row['receiver']) !== '' && ! $receiver) {
                $issues[] = 'unresolved_receiver';
            }
            if (trim((string) $row['deliverer']) !== '' && ! $deliverer) {
                $issues[] = 'unresolved_deliverer';
            }

            $program = null;
            $action = null;
            if ($row['voucher_type_code'] === 'warehouse') {
                [$program, $programIssue] = $this->program((string) $row['program']);
                if ($programIssue) {
                    $issues[] = $programIssue;
                }
                [$action, $actionIssue] = $this->action((string) $row['action'], $program);
                if ($actionIssue) {
                    $issues[] = $actionIssue;
                }
            }

            $items = [];
            $voucherTypeId = $this->voucherTypeId($row);
            foreach ($row['items'] as $sourceItem) {
                $material = $this->material((string) $sourceItem['material']);
                if (! $material) {
                    $issues[] = 'unresolved_material:'.trim((string) $sourceItem['material']);

                    continue;
                }
                if (! $material->voucherTypes()->whereKey($voucherTypeId)->exists()) {
                    $issues[] = 'material_not_available_for_voucher_type:'.trim((string) $sourceItem['material']);

                    continue;
                }
                $items[] = [
                    'material_id' => $material->id,
                    'unit_id' => $material->default_unit_id,
                    'description_snapshot' => $material->name,
                    'quantity' => $sourceItem['quantity'],
                ];
            }

            $issues = array_values(array_unique($issues));
            $voucher = $issues === [] ? [
                'storage_location_id' => $voucherTypeId,
                'folio' => trim((string) $row['folio']),
                'direction' => $direction,
                'issued_on' => $row['date'],
                'received_by_id' => $receiver?->id,
                'delivered_by_id' => $deliverer?->id,
                'authorized_by_id' => $authorizerId,
                'program_id' => $program?->id,
                'action_id' => $action?->id,
                'usage_description' => $destinationData['usage_description'],
                'destination_ids' => $destinationData['destination_ids'],
                'needs_review' => $destinationData['needs_review'],
                'review_reasons' => $destinationData['needs_review'] ? ['destination_split_uncertain'] : null,
                'status' => VoucherStatus::Active,
                'items' => $items,
            ] : null;
            if ($voucher) {
                $this->stats['vouchers_ready']++;
                $this->stats['items_ready'] += count($items);
            } else {
                $this->stats['invalid_skipped']++;
            }
            $plan[] = ['source' => $row, 'issues' => $issues, 'voucher' => $voucher];
        }

        return $plan;
    }

    /** @param array<string, mixed> $row */
    private function voucherTypeId(array $row): int
    {
        return StorageLocation::query()
            ->where('code', $row['voucher_type_code'])
            ->value('id')
            ?? throw new RuntimeException("Falta configurar el tipo de vale {$row['voucher_type_name']}.");
    }

    private function person(string $name, string $role): ?Person
    {
        $key = Normalizer::key($name);
        if ($key === '') {
            return null;
        }
        $alias = PersonAlias::query()->where('normalized_alias', $key)->first();
        $person = $alias
            ? $alias->person
            : Person::query()->where('normalized_name', $key)->first();

        return $person?->is_active && $person->{$role} ? $person : null;
    }

    private function material(string $name): ?Material
    {
        $key = Normalizer::key($name);

        $alias = MaterialAlias::query()->where('normalized_alias', $key)->first();

        return $alias
            ? $alias->material
            : Material::query()->where('normalized_name', $key)->first();
    }

    /**
     * @param  array<string, array{destinations: list<string>, usage_description: string|null, needs_review: bool}>  $mappings
     * @return array{destination_ids: list<int>, usage_description: string|null, needs_review: bool, issues: list<string>}
     */
    private function destination(string $raw, array $mappings): array
    {
        $key = Normalizer::key($raw);
        $mapping = $mappings[$key] ?? null;
        if ($mapping === null) {
            $destination = $this->destinationByName($raw);

            return $destination
                ? ['destination_ids' => [$destination->id], 'usage_description' => null, 'needs_review' => false, 'issues' => []]
                : ['destination_ids' => [], 'usage_description' => trim($raw), 'needs_review' => true, 'issues' => []];
        }

        $ids = [];
        $issues = [];
        foreach ($mapping['destinations'] as $name) {
            $destination = $this->destinationByName($name);
            if (! $destination) {
                $issues[] = 'unresolved_destination:'.$name;

                continue;
            }
            $ids[] = $destination->id;
        }

        return [
            'destination_ids' => array_values(array_unique($ids)),
            'usage_description' => filled($mapping['usage_description']) ? trim((string) $mapping['usage_description']) : null,
            'needs_review' => $mapping['needs_review'],
            'issues' => $issues,
        ];
    }

    private function destinationByName(string $name): ?Destination
    {
        $key = Normalizer::key($name);
        $alias = DestinationAlias::query()->where('normalized_alias', $key)->first();

        return $alias
            ? $alias->destination
            : Destination::query()->where('normalized_name', $key)->first();
    }

    /** @return array{Program|null, string|null} */
    private function program(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [null, null];
        }
        $code = preg_match('/^SPM-/i', $raw) ? strtoupper($raw) : 'SPM-'.str_pad($raw, 2, '0', STR_PAD_LEFT);
        $program = Program::query()->where('code', $code)->where('is_active', true)->first();

        return [$program, $program ? null : 'unresolved_program:'.$code];
    }

    /** @return array{Action|null, string|null} */
    private function action(string $raw, ?Program $program): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return [null, null];
        }
        if (! $program) {
            return [null, 'action_without_program'];
        }
        $code = preg_match('/^SPM-/i', $raw)
            ? strtoupper($raw)
            : $program->code.'-'.str_pad($raw, 2, '0', STR_PAD_LEFT);
        $action = Action::query()->where('code', $code)->where('program_id', $program->id)->where('is_active', true)->first();

        return [$action, $action ? null : 'unresolved_action:'.$code];
    }

    /** @param list<array{source: array<string, mixed>, issues: list<string>, voucher: array<string, mixed>|null}> $plan */
    private function ensureNoVoucherConflicts(array $plan): void
    {
        $conflicts = [];
        foreach ($plan as $row) {
            if ($row['voucher'] === null) {
                continue;
            }
            if (Voucher::query()
                ->where('storage_location_id', $row['voucher']['storage_location_id'])
                ->where('folio_key', Normalizer::folio($row['voucher']['folio']))
                ->exists()) {
                $conflicts[] = $row['source']['voucher_type_name'].' '.$row['voucher']['folio'];
            }
        }
        if ($conflicts !== []) {
            throw new RuntimeException('Ya existen folios que entrarían en conflicto: '.implode(', ', $conflicts).'.');
        }
    }

    /** @param list<array{source: array<string, mixed>, issues: list<string>, voucher: array<string, mixed>|null}> $plan */
    private function persist(array $plan, string $hash, string $name): void
    {
        foreach ($plan as $row) {
            $trace = LegacyImportRow::create([
                'source_hash' => $hash,
                'source_name' => $name,
                'sheet_name' => $row['source']['sheet_name'],
                'row_number' => $row['source']['row_number'],
                'raw_data' => $row['source']['raw_data'],
                'issue_codes' => $row['issues'] ?: null,
            ]);
            if ($row['voucher'] === null) {
                continue;
            }

            $data = $row['voucher'];
            $items = $data['items'];
            $destinationIds = $data['destination_ids'];
            unset($data['items'], $data['destination_ids']);
            $voucher = Voucher::create([
                ...$data,
                'folio_key' => Normalizer::folio($data['folio']),
            ]);
            foreach ($items as $item) {
                $voucher->items()->create($item);
            }
            $voucher->destinations()->sync($destinationIds);
            $trace->update(['imported_type' => Voucher::class, 'imported_id' => $voucher->id]);
        }
    }

    /** @param list<array{source: array<string, mixed>, issues: list<string>, voucher: array<string, mixed>|null}> $plan */
    private function summary(array $plan): void
    {
        $this->table(
            ['Métrica', 'Valor'],
            collect($this->stats)->map(fn (int $value, string $key): array => [$key, $value])->values()->all(),
        );
        $skipped = array_values(array_filter($plan, fn (array $row): bool => $row['voucher'] === null));
        if ($skipped !== []) {
            $this->warn('Renglones trazados sin crear un vale operativo:');
            $this->table(
                ['Hoja', 'Fila', 'Folio', 'Incidencias'],
                array_map(fn (array $row): array => [
                    $row['source']['sheet_name'],
                    $row['source']['row_number'],
                    $row['source']['folio'] ?: '—',
                    implode(', ', $row['issues']),
                ], $skipped),
            );
        }
    }
}
