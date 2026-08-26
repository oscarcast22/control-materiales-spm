<?php

namespace App\Console\Commands;

use App\Enums\DispositionType;
use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\LegacyImportRow;
use App\Models\Material;
use App\Models\MaterialAlias;
use App\Models\MaterialDisposition;
use App\Models\Person;
use App\Models\PersonAlias;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\Voucher;
use App\Models\VoucherItem;
use App\Support\LegacyControlWorkbook;
use App\Support\LegacyReportComment;
use App\Support\Normalizer;
use DateTimeImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

#[Signature('legacy:import-control
    {file : Ruta de CONTROL DE ORDEN DE SERVICIO.xlsx}
    {--from=2026-01-01 : Fecha mínima inclusiva}
    {--dry-run}')]
#[Description('Importa de forma trazable el historial de CONTROL desde 2026')]
class ImportLegacyControl extends Command
{
    /** @var array<string, int> */
    private array $stats = [
        'source_rows' => 0,
        'staged_rows' => 0,
        'eligible_rows' => 0,
        'skipped_before_cutoff' => 0,
        'partial_cutoff_rows' => 0,
        'inferred_date_rows' => 0,
        'vouchers' => 0,
        'cancelled' => 0,
        'items' => 0,
        'dispositions' => 0,
        'unresolved' => 0,
        'review' => 0,
        'anomalies' => 0,
        'new_materials' => 0,
        'new_people' => 0,
    ];

    public function handle(LegacyControlWorkbook $workbook): int
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
            $this->stats['source_rows'] = count($rows);
            $plan = $this->plan($rows, $this->cutoff());
            $this->catalogGaps($plan);
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

    private function cutoff(): DateTimeImmutable
    {
        $value = trim((string) $this->option('from'));
        $cutoff = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();
        if (! $cutoff || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw new RuntimeException('La opción --from debe usar el formato AAAA-MM-DD.');
        }

        return $cutoff;
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{vouchers: list<array<string, mixed>>, staged: array<int, array{data: array<string, mixed>, issues: list<string>}>, unresolved: list<array{folio: string, row_number: int, issues: list<string>}>}
     */
    private function plan(array $rows, DateTimeImmutable $cutoff): array
    {
        $vouchers = [];
        $staged = [];
        $unresolved = [];
        $groups = [];
        foreach ($rows as $number => $row) {
            $key = $row['folio'] !== '' ? Normalizer::folio($row['folio']) : "__row_{$number}";
            $groups[$key][$number] = $row;
        }

        foreach ($groups as $group) {
            $before = [];
            $after = [];
            $undated = [];
            foreach ($group as $number => $row) {
                if ($row['date'] === null) {
                    $undated[$number] = $row;
                } elseif (new DateTimeImmutable($row['date']) < $cutoff) {
                    $before[$number] = $row;
                } else {
                    $after[$number] = $row;
                }
            }

            if ($after === [] && $undated === []) {
                $this->stats['skipped_before_cutoff'] += count($before);

                continue;
            }

            $groupReasons = [];
            $groupIssues = [];
            if ($after !== [] && $before !== []) {
                $this->stats['skipped_before_cutoff'] += count($before);
                $this->stats['partial_cutoff_rows'] += count($before);
                $groupReasons[] = 'El folio contiene filas anteriores al corte; sólo se importó la parte de 2026.';
                $groupIssues[] = 'partial_cutoff';
            } elseif ($after === [] && $before !== []) {
                $this->stats['skipped_before_cutoff'] += count($before);

                continue;
            }

            $selected = $after;
            if ($undated !== []) {
                $inferred = $this->inferredDate($undated);
                if ($inferred === null && $after === []) {
                    foreach ($undated as $number => $row) {
                        $issues = ['unresolved_missing_date'];
                        $staged[$number] = ['data' => $row, 'issues' => $issues];
                        $unresolved[] = ['folio' => $row['folio'], 'row_number' => $number, 'issues' => $issues];
                        $this->stats['unresolved']++;
                    }

                    continue;
                }

                $inferred ??= $this->mode(array_column($after, 'date'));
                foreach ($undated as $number => $row) {
                    $row['date'] = $inferred;
                    $selected[$number] = $row;
                }
                $this->stats['inferred_date_rows'] += count($undated);
                $groupReasons[] = "La fecha del vale se infirió como {$inferred} a partir de la información disponible.";
                $groupIssues[] = 'inferred_voucher_date';
            }

            ksort($selected);
            $prepared = $this->prepareVoucher($selected, $groupReasons, $groupIssues);
            foreach ($prepared['staged'] as $number => $row) {
                $staged[$number] = $row;
            }
            foreach ($prepared['unresolved'] as $row) {
                $unresolved[] = $row;
                $this->stats['unresolved']++;
            }
            if ($prepared['voucher'] !== null) {
                $vouchers[] = $prepared['voucher'];
            }
        }

        ksort($staged);
        $this->stats['staged_rows'] = count($staged);
        $this->stats['eligible_rows'] = count($staged) - count($unresolved);

        return ['vouchers' => $vouchers, 'staged' => $staged, 'unresolved' => $unresolved];
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @param  list<string>  $groupReasons
     * @param  list<string>  $groupIssues
     * @return array{voucher: array<string, mixed>|null, staged: array<int, array{data: array<string, mixed>, issues: list<string>}>, unresolved: list<array{folio: string, row_number: int, issues: list<string>}>}
     */
    private function prepareVoucher(array $rows, array $groupReasons, array $groupIssues): array
    {
        $staged = [];
        $unresolved = [];
        $folio = (string) ($this->mode(array_column($rows, 'folio')) ?? '');
        $cancelled = collect($rows)->every(fn (array $row): bool => str_contains(Normalizer::key($row['material']), 'cancelado'));

        if ($folio === '') {
            foreach ($rows as $number => $row) {
                $issues = [...$groupIssues, 'unresolved_missing_folio'];
                $staged[$number] = ['data' => $row, 'issues' => $issues];
                $unresolved[] = ['folio' => '', 'row_number' => $number, 'issues' => $issues];
            }

            return ['voucher' => null, 'staged' => $staged, 'unresolved' => $unresolved];
        }

        $dates = array_values(array_filter(array_column($rows, 'date')));
        $date = (string) $this->mode($dates);
        $technicians = array_column($rows, 'technician');
        $destinations = array_column($rows, 'destination');
        $reviewReasons = $groupReasons;
        if ($this->distinct($dates) > 1) {
            $reviewReasons[] = 'El folio contiene fechas distintas: '.implode(', ', array_unique($dates)).'. Se utilizó la más frecuente.';
            $groupIssues[] = 'conflicting_date';
        }
        if ($this->distinctNormalized($technicians) > 1) {
            $reviewReasons[] = 'El folio contiene nombres de técnico distintos; se utilizó el más frecuente.';
            $groupIssues[] = 'conflicting_technician';
        }
        if ($this->distinctNormalized(array_filter($destinations)) > 1) {
            $reviewReasons[] = 'El folio contiene destinos distintos; se utilizó el más frecuente.';
            $groupIssues[] = 'conflicting_destination';
        }

        $technician = $this->modeNormalized($technicians);
        if ($technician === '') {
            $technician = 'Sin técnico registrado';
            $reviewReasons[] = 'El vale no indica quién recibió el material.';
            $groupIssues[] = 'missing_technician';
        }
        $destination = (string) ($this->mode(array_filter($destinations)) ?? 'Sin destino registrado');
        if ($destination === 'Sin destino registrado') {
            $reviewReasons[] = 'El vale no contiene destino.';
            $groupIssues[] = 'missing_destination';
        }

        if ($cancelled) {
            foreach ($rows as $number => $row) {
                $issues = array_values(array_unique([...$groupIssues, 'cancelled']));
                $staged[$number] = ['data' => $row, 'issues' => $issues];
            }
            $this->stats['vouchers']++;
            $this->stats['cancelled']++;
            if ($reviewReasons !== []) {
                $this->stats['review']++;
            }

            return [
                'voucher' => [
                    'folio' => $folio,
                    'date' => $date,
                    'technician' => 'No aplica (cancelado)',
                    'destination' => 'Cancelado en archivo histórico',
                    'cancelled' => true,
                    'review_reasons' => array_values(array_unique($reviewReasons)),
                    'items' => [],
                    'row_numbers' => array_keys($rows),
                ],
                'staged' => $staged,
                'unresolved' => [],
            ];
        }

        $items = [];
        foreach ($rows as $number => $row) {
            $rowIssues = $groupIssues;
            if ($row['material'] === '' || $row['quantity'] === null || $row['quantity'] <= 0) {
                if ($row['material'] === '') {
                    $rowIssues[] = 'unresolved_missing_material';
                }
                if ($row['quantity'] === null || $row['quantity'] <= 0) {
                    $rowIssues[] = 'unresolved_invalid_quantity';
                }
                $rowIssues = array_values(array_unique($rowIssues));
                $staged[$number] = ['data' => $row, 'issues' => $rowIssues];
                $unresolved[] = ['folio' => $folio, 'row_number' => $number, 'issues' => $rowIssues];

                continue;
            }

            $dispositions = [];
            $applied = 0.0;
            foreach ($row['reports'] as $report) {
                $quantity = $report['quantity'];
                if ($quantity === null || abs($quantity) < 0.000001) {
                    continue;
                }
                $parsed = LegacyReportComment::parse($report['comment'], $date, $report['slot']);
                $applied += $quantity;
                if ($parsed['issue'] !== null) {
                    $rowIssues[] = $parsed['issue'];
                    $reviewReasons[] = $parsed['issue'] === 'application_date_invalid'
                        ? 'Una o más aplicaciones contienen una fecha inválida o distinta de 2026; se utilizó la fecha del vale.'
                        : 'Una o más aplicaciones no tienen fecha identificable; se utilizó la fecha del vale.';
                }
                if ($parsed['occurred_on'] < $date) {
                    $rowIssues[] = 'application_before_voucher';
                    $reviewReasons[] = 'Una o más aplicaciones están fechadas antes que el vale.';
                }
                $dispositions[] = [...$parsed, 'slot' => $report['slot'], 'cell' => $report['cell'], 'quantity' => $quantity];
                $this->stats['dispositions']++;
            }

            $anomaly = $applied > (float) $row['quantity'] + 0.0001;
            if ($anomaly) {
                $rowIssues[] = 'balance_anomaly';
                $reviewReasons[] = 'Una o más partidas tienen aplicaciones superiores a la cantidad entregada.';
                $this->stats['anomalies']++;
            }
            $rowIssues = array_values(array_unique($rowIssues));
            $staged[$number] = ['data' => $row, 'issues' => $rowIssues];
            $items[] = [
                'row_number' => $number,
                'material' => $row['material'],
                'quantity' => $row['quantity'],
                'dispositions' => $dispositions,
                'anomaly' => $anomaly,
                'issues' => $rowIssues,
            ];
            $this->stats['items']++;
        }

        if ($items === []) {
            return ['voucher' => null, 'staged' => $staged, 'unresolved' => $unresolved];
        }

        $reviewReasons = array_values(array_unique($reviewReasons));
        $this->stats['vouchers']++;
        if ($reviewReasons !== []) {
            $this->stats['review']++;
        }

        return [
            'voucher' => [
                'folio' => $folio,
                'date' => $date,
                'technician' => $technician,
                'destination' => $destination,
                'cancelled' => false,
                'review_reasons' => $reviewReasons,
                'items' => $items,
                'row_numbers' => array_keys($rows),
            ],
            'staged' => $staged,
            'unresolved' => $unresolved,
        ];
    }

    /** @param array<int, array<string, mixed>> $rows */
    private function inferredDate(array $rows): ?string
    {
        $dates = [];
        foreach ($rows as $row) {
            foreach ($row['reports'] as $report) {
                if ($report['quantity'] === null || abs($report['quantity']) < 0.000001 || $report['comment'] === null) {
                    continue;
                }
                $parsed = LegacyReportComment::parse($report['comment'], '2026-01-01', $report['slot']);
                if ($parsed['issue'] === null) {
                    $dates[] = $parsed['occurred_on'];
                }
            }
        }
        sort($dates);

        return $dates[0] ?? null;
    }

    /** @param array{vouchers: list<array<string, mixed>>} $plan */
    private function catalogGaps(array $plan): void
    {
        $materials = [];
        $people = ['Importación histórica', 'No aplica (cancelado)'];
        foreach ($plan['vouchers'] as $voucher) {
            $people[] = $voucher['technician'];
            foreach ($voucher['items'] as $item) {
                $materials[] = $item['material'];
            }
        }
        foreach (array_unique($materials) as $name) {
            $key = Normalizer::key($name);
            if (! MaterialAlias::query()->where('normalized_alias', $key)->exists()
                && ! Material::query()->where('normalized_name', $key)->exists()) {
                $this->stats['new_materials']++;
            }
        }
        foreach (array_unique($people) as $name) {
            $key = Normalizer::key($name);
            if (! PersonAlias::query()->where('normalized_alias', $key)->exists()
                && ! Person::query()->where('normalized_name', $key)->exists()) {
                $this->stats['new_people']++;
            }
        }
    }

    /** @param array{vouchers: list<array<string, mixed>>} $plan */
    private function ensureNoVoucherConflicts(array $plan): void
    {
        $warehouse = StorageLocation::query()->where('code', 'warehouse')->first();
        if (! $warehouse) {
            return;
        }
        $keys = array_map(fn (array $voucher): string => Normalizer::folio($voucher['folio']), $plan['vouchers']);
        $conflicts = Voucher::query()
            ->where('storage_location_id', $warehouse->id)
            ->whereIn('folio_key', array_unique($keys))
            ->orderBy('folio')
            ->pluck('folio')
            ->all();
        if ($conflicts !== []) {
            throw new RuntimeException('Ya existen folios de Almacén que entrarían en conflicto: '.implode(', ', $conflicts).'.');
        }
    }

    /**
     * @param  array{vouchers: list<array<string, mixed>>, staged: array<int, array{data: array<string, mixed>, issues: list<string>}>}  $plan
     */
    private function persist(array $plan, string $hash, string $name): void
    {
        $staged = [];
        foreach ($plan['staged'] as $number => $row) {
            $staged[$number] = LegacyImportRow::create([
                'source_hash' => $hash,
                'source_name' => $name,
                'sheet_name' => 'victor',
                'row_number' => $number,
                'raw_data' => $row['data'],
                'issue_codes' => $row['issues'] ?: null,
            ]);
        }

        $unit = Unit::firstOrCreate(['symbol' => 's/e'], ['name' => 'Unidad sin especificar']);
        $historicalIssuer = $this->person('Importación histórica', false, true);
        $notApplicable = $this->person('No aplica (cancelado)', false, false);
        $warehouse = StorageLocation::firstOrCreate(
            ['code' => 'warehouse'],
            ['name' => 'Almacén', 'tracking_started_on' => now()->toDateString()],
        );

        foreach ($plan['vouchers'] as $data) {
            $receivedBy = $data['cancelled']
                ? $notApplicable
                : $this->person($data['technician'], true, false);
            $voucher = Voucher::create([
                'storage_location_id' => $warehouse->id,
                'folio' => $data['folio'],
                'folio_key' => Normalizer::folio($data['folio']),
                'direction' => VoucherDirection::Exit,
                'issued_on' => $data['date'],
                'received_by_id' => $receivedBy->id,
                'delivered_by_id' => $historicalIssuer->id,
                'destination' => $data['destination'],
                'status' => $data['cancelled'] ? VoucherStatus::Cancelled : VoucherStatus::Active,
                'needs_review' => $data['review_reasons'] !== [],
                'review_reasons' => $data['review_reasons'] ?: null,
                'cancelled_at' => $data['cancelled'] ? now() : null,
                'cancellation_reason' => $data['cancelled'] ? 'Cancelado en archivo histórico.' : null,
            ]);

            if ($data['cancelled']) {
                foreach ($data['row_numbers'] as $number) {
                    $staged[$number]->update(['imported_type' => Voucher::class, 'imported_id' => $voucher->id]);
                }

                continue;
            }

            foreach ($data['items'] as $dataItem) {
                $material = $this->material($dataItem['material'], $unit);
                $item = VoucherItem::create([
                    'voucher_id' => $voucher->id,
                    'material_id' => $material->id,
                    'unit_id' => $material->default_unit_id,
                    'description_snapshot' => $dataItem['material'],
                    'quantity' => $dataItem['quantity'],
                    'legacy_anomaly' => $dataItem['anomaly'],
                ]);
                foreach ($dataItem['dispositions'] as $disposition) {
                    MaterialDisposition::create([
                        'voucher_item_id' => $item->id,
                        'type' => DispositionType::Consumption,
                        'occurred_on' => $disposition['occurred_on'],
                        'quantity' => $disposition['quantity'],
                        'reference' => $disposition['reference'],
                        'destination' => $disposition['destination'],
                        'notes' => $disposition['notes'],
                        'legacy_slot' => $disposition['slot'],
                    ]);
                }
                $staged[$dataItem['row_number']]->update([
                    'imported_type' => VoucherItem::class,
                    'imported_id' => $item->id,
                ]);
            }
        }
    }

    /** @param array{unresolved: list<array{folio: string, row_number: int, issues: list<string>}>} $plan */
    private function summary(array $plan): void
    {
        $this->table(
            ['Métrica', 'Valor'],
            collect($this->stats)->map(fn ($value, $key) => [$key, $value])->values()->all(),
        );
        if ($plan['unresolved'] !== []) {
            $this->warn('Filas conservadas sin crear un vale:');
            $this->table(
                ['Folio', 'Fila', 'Incidencias'],
                array_map(fn (array $row): array => [
                    $row['folio'] ?: '—',
                    $row['row_number'],
                    implode(', ', $row['issues']),
                ], $plan['unresolved']),
            );
        }
    }

    private function person(string $name, bool $receiver, bool $issuer): Person
    {
        $key = Normalizer::key($name);
        $alias = PersonAlias::query()->where('normalized_alias', $key)->first();
        if ($alias) {
            $person = $alias->person;
        } else {
            $person = Person::firstOrCreate(['normalized_name' => $key], [
                'name' => $name,
                'can_receive_material' => $receiver,
                'can_deliver_material' => $issuer,
                'needs_review' => true,
            ]);
            PersonAlias::firstOrCreate(['normalized_alias' => $key], ['person_id' => $person->id, 'alias' => $name]);
        }
        $person->update([
            'can_receive_material' => $person->can_receive_material || $receiver,
            'can_deliver_material' => $person->can_deliver_material || $issuer,
        ]);

        return $person;
    }

    private function material(string $name, Unit $unit): Material
    {
        $key = Normalizer::key($name);
        $alias = MaterialAlias::query()->where('normalized_alias', $key)->first();
        if ($alias) {
            return $alias->material;
        }
        $material = Material::firstOrCreate(['normalized_name' => $key], [
            'name' => $name,
            'default_unit_id' => $unit->id,
            'needs_review' => true,
        ]);
        MaterialAlias::firstOrCreate(['normalized_alias' => $key], ['material_id' => $material->id, 'alias' => $name]);

        return $material;
    }

    /** @param array<int, mixed> $values */
    private function mode(array $values): mixed
    {
        $values = array_values(array_filter($values, fn ($value) => $value !== null && $value !== ''));
        if ($values === []) {
            return null;
        }
        $counts = array_count_values(array_map('strval', $values));
        $maximum = max($counts);
        $winners = array_keys(array_filter($counts, fn (int $count): bool => $count === $maximum));
        sort($winners, SORT_NATURAL);
        $winner = $winners[0];
        foreach ($values as $value) {
            if ((string) $value === $winner) {
                return $value;
            }
        }

        return $values[0];
    }

    /** @param array<int, string> $values */
    private function modeNormalized(array $values): string
    {
        $groups = [];
        foreach ($values as $value) {
            if ($value !== '') {
                $groups[Normalizer::key($value)][] = $value;
            }
        }
        uasort($groups, function (array $left, array $right): int {
            $count = count($right) <=> count($left);

            return $count !== 0 ? $count : strnatcasecmp($left[0], $right[0]);
        });

        return (string) (reset($groups)[0] ?? '');
    }

    /** @param array<int, mixed> $values */
    private function distinct(array $values): int
    {
        return count(array_unique(array_filter($values, fn ($value) => $value !== null && $value !== '')));
    }

    /** @param array<int, string> $values */
    private function distinctNormalized(array $values): int
    {
        return count(array_unique(array_map([Normalizer::class, 'key'], $values)));
    }
}
