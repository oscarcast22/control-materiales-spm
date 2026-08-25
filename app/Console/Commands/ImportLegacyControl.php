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
use App\Support\Normalizer;
use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use OpenSpout\Reader\XLSX\Reader;
use Throwable;

#[Signature('legacy:import-control
    {file : Ruta de CONTROL DE ORDEN DE SERVICIO.xlsx}
    {--from=2026-01-01 : Fecha mínima para importar un folio completo}
    {--dry-run}')]
#[Description('Importa de forma idempotente la hoja victor y conserva cada fila original')]
class ImportLegacyControl extends Command
{
    /** @var array<string, int> */
    private array $stats = [
        'source_rows' => 0,
        'eligible_rows' => 0,
        'skipped_before_cutoff' => 0,
        'skipped_mixed_dates' => 0,
        'skipped_without_date' => 0,
        'vouchers' => 0,
        'cancelled' => 0,
        'items' => 0,
        'dispositions' => 0,
        'unresolved' => 0,
        'review' => 0,
        'anomalies' => 0,
    ];

    public function handle(): int
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
            $rows = $this->readVictor($path);
            $this->stats['source_rows'] = count($rows);
            $rows = $this->eligibleRows($rows, $this->cutoff());
            $this->stats['eligible_rows'] = count($rows);
            if ($this->option('dry-run')) {
                $this->line('Lectura correcta. El archivo no fue persistido por --dry-run.');
                $this->table(['Métrica', 'Valor'], collect($this->stats)->map(fn ($value, $key) => [$key, $value])->values()->all());

                return self::SUCCESS;
            }
            DB::transaction(fn () => $this->persist($rows, $hash, basename($path)));
        } catch (Throwable $exception) {
            report($exception);
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->table(['Métrica', 'Valor'], collect($this->stats)->map(fn ($value, $key) => [$key, $value])->values()->all());

        return self::SUCCESS;
    }

    private function cutoff(): DateTimeImmutable
    {
        $value = trim((string) $this->option('from'));
        $cutoff = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        $errors = DateTimeImmutable::getLastErrors();
        if (! $cutoff || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
            throw new \RuntimeException('La opción --from debe usar el formato AAAA-MM-DD.');
        }

        return $cutoff;
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function eligibleRows(array $rows, DateTimeImmutable $cutoff): array
    {
        $eligible = [];
        $groups = collect($rows)->groupBy(fn (array $row): string => (string) $row['folio'], preserveKeys: true);

        foreach ($groups as $group) {
            $sourceRows = $group->all();
            $dates = array_column($sourceRows, 'date');
            if (in_array(null, $dates, true)) {
                $this->stats['skipped_without_date'] += count($sourceRows);

                continue;
            }
            $before = collect($dates)->contains(fn (string $date): bool => new DateTimeImmutable($date) < $cutoff);
            $after = collect($dates)->contains(fn (string $date): bool => new DateTimeImmutable($date) >= $cutoff);
            if ($before && $after) {
                $this->stats['skipped_mixed_dates'] += count($sourceRows);

                continue;
            }
            if ($before) {
                $this->stats['skipped_before_cutoff'] += count($sourceRows);

                continue;
            }
            $eligible += $sourceRows;
        }

        return $eligible;
    }

    /** @return array<int, array<string, mixed>> */
    private function readVictor(string $path): array
    {
        $reader = new Reader;
        $reader->open($path);
        $result = [];
        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                if (Normalizer::key($sheet->getName()) !== 'victor') {
                    continue;
                }
                foreach ($sheet->getRowIterator() as $rowNumber => $row) {
                    $values = $row->toArray();
                    if (Normalizer::key($this->scalar($values[1] ?? null)) === 'vale') {
                        continue;
                    }
                    $data = [
                        'number' => $values[0] ?? null,
                        'folio' => $this->scalar($values[1] ?? null),
                        'technician' => $this->scalar($values[2] ?? null),
                        'date' => $this->dateValue($values[3] ?? null),
                        'material' => $this->scalar($values[4] ?? null),
                        'destination' => $this->scalar($values[5] ?? null),
                        'quantity' => $this->number($values[6] ?? null),
                        'difference' => $this->number($values[7] ?? null),
                        'reports' => [],
                    ];
                    for ($index = 8; $index <= 17; $index++) {
                        $data['reports'][$index - 7] = $this->number($values[$index] ?? null);
                    }
                    if ($data['folio'] === '' && $data['material'] === '') {
                        continue;
                    }
                    $result[(int) $rowNumber + 1] = $data;
                }
                break;
            }
        } finally {
            $reader->close();
        }
        if ($result === []) {
            throw new \RuntimeException('No se encontró información en la hoja victor.');
        }

        return $result;
    }

    /** @param array<int, array<string, mixed>> $rows */
    private function persist(array $rows, string $hash, string $name): void
    {
        $staged = [];
        foreach ($rows as $number => $data) {
            $staged[$number] = LegacyImportRow::create([
                'source_hash' => $hash,
                'source_name' => $name,
                'sheet_name' => 'victor',
                'row_number' => $number,
                'raw_data' => $data,
            ]);
        }

        $unspecified = Unit::firstOrCreate(['symbol' => 's/e'], ['name' => 'Unidad sin especificar']);
        $historicalIssuer = $this->person('Importación histórica', false, true);
        $notApplicable = $this->person('No aplica (cancelado)', false, false);
        $groups = collect($rows)->groupBy(fn (array $row): string => (string) $row['folio'], preserveKeys: true);

        foreach ($groups as $folio => $group) {
            $sourceRows = $group->all();
            $rowNumbers = array_keys($sourceRows);
            $cancelled = collect($sourceRows)->every(fn (array $row): bool => str_contains(Normalizer::key($row['material']), 'cancelado'));
            if ($cancelled) {
                $date = $this->mode(array_column($sourceRows, 'date')) ?? now()->toDateString();
                $voucher = $this->voucher((string) $folio, $date, $notApplicable, $historicalIssuer, 'Cancelado en archivo histórico', true, true);
                foreach ($rowNumbers as $number) {
                    $staged[$number]->update(['imported_type' => Voucher::class, 'imported_id' => $voucher->id, 'issue_codes' => ['cancelled']]);
                }
                $this->stats['vouchers']++;
                $this->stats['cancelled']++;

                continue;
            }

            $incomplete = collect($sourceRows)->contains(fn (array $row): bool => $row['folio'] === '' || $row['date'] === null || $row['technician'] === '' || $row['material'] === '' || $row['quantity'] === null);
            if ($incomplete) {
                foreach ($rowNumbers as $number) {
                    $staged[$number]->update(['issue_codes' => ['unresolved_incomplete_group']]);
                }
                $this->stats['unresolved']++;

                continue;
            }

            $dates = array_column($sourceRows, 'date');
            $technicians = array_column($sourceRows, 'technician');
            $destinations = array_column($sourceRows, 'destination');
            $conflicts = [];
            if ($this->distinct($dates) > 1) {
                $conflicts[] = 'conflicting_date';
            }
            if ($this->distinctNormalized($technicians) > 1) {
                $conflicts[] = 'conflicting_technician';
            }
            if ($this->distinctNormalized(array_filter($destinations)) > 1) {
                $conflicts[] = 'conflicting_destination';
            }
            $destination = (string) ($this->mode(array_filter($destinations)) ?? 'Sin destino registrado');
            if ($destination === 'Sin destino registrado') {
                $conflicts[] = 'missing_destination';
            }
            $receivedBy = $this->person((string) $this->modeNormalized($technicians), true, false);
            $voucher = $this->voucher(
                (string) $folio,
                (string) $this->mode($dates),
                $receivedBy,
                $historicalIssuer,
                $destination,
                false,
                $conflicts !== [],
            );
            $this->stats['vouchers']++;
            if ($conflicts !== []) {
                $this->stats['review']++;
            }

            foreach ($sourceRows as $number => $row) {
                $material = $this->material($row['material'], $unspecified);
                $item = VoucherItem::create([
                    'voucher_id' => $voucher->id,
                    'material_id' => $material->id,
                    'unit_id' => $unspecified->id,
                    'description_snapshot' => $row['material'],
                    'quantity' => $row['quantity'],
                ]);
                $this->stats['items']++;
                foreach ($row['reports'] as $slot => $quantity) {
                    if ($quantity === null || abs($quantity) < 0.000001) {
                        continue;
                    }
                    MaterialDisposition::create([
                        'voucher_item_id' => $item->id,
                        'type' => DispositionType::Consumption,
                        'occurred_on' => $voucher->issued_on,
                        'quantity' => $quantity,
                        'legacy_slot' => $slot,
                        'notes' => "Importado de REPORTE {$slot}; el archivo no contiene folio ni fecha propios.",
                    ]);
                    $this->stats['dispositions']++;
                }
                $expected = $row['difference'];
                $actual = (float) $item->fresh()->pendingQuantity();
                $anomaly = ($expected !== null && abs($actual - $expected) > 0.0001) || $actual < 0;
                if ($anomaly) {
                    $item->update(['legacy_anomaly' => true]);
                    $voucher->update(['needs_review' => true]);
                    $this->stats['anomalies']++;
                }
                $issues = [...$conflicts, ...($anomaly ? ['balance_anomaly'] : [])];
                $staged[$number]->update([
                    'imported_type' => VoucherItem::class,
                    'imported_id' => $item->id,
                    'issue_codes' => $issues ?: null,
                ]);
            }
        }
    }

    private function voucher(string $folio, string $date, Person $receivedBy, Person $deliveredBy, string $destination, bool $cancelled, bool $review): Voucher
    {
        $warehouse = StorageLocation::firstOrCreate(
            ['code' => 'warehouse'],
            ['name' => 'Almacén', 'tracking_started_on' => now()->toDateString()],
        );

        return Voucher::create([
            'storage_location_id' => $warehouse->id,
            'folio' => $folio,
            'folio_key' => Normalizer::folio($folio),
            'direction' => VoucherDirection::Exit,
            'issued_on' => $date,
            'received_by_id' => $receivedBy->id,
            'delivered_by_id' => $deliveredBy->id,
            'destination' => $destination,
            'status' => $cancelled ? VoucherStatus::Cancelled : VoucherStatus::Active,
            'needs_review' => $review,
            'cancelled_at' => $cancelled ? now() : null,
            'cancellation_reason' => $cancelled ? 'Cancelado en archivo histórico.' : null,
        ]);
    }

    private function person(string $name, bool $receiver, bool $issuer): Person
    {
        $key = Normalizer::key($name);
        $alias = PersonAlias::query()->where('normalized_alias', $key)->first();
        if ($alias) {
            return $alias->person;
        }
        $person = Person::firstOrCreate(['normalized_name' => $key], [
            'name' => $name,
            'can_receive_material' => $receiver,
            'can_deliver_material' => $issuer,
            'needs_review' => true,
        ]);
        $person->update([
            'can_receive_material' => $person->can_receive_material || $receiver,
            'can_deliver_material' => $person->can_deliver_material || $issuer,
        ]);
        PersonAlias::firstOrCreate(['normalized_alias' => $key], ['person_id' => $person->id, 'alias' => $name]);

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
        arsort($counts);
        $winner = array_key_first($counts);
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
        uasort($groups, fn ($a, $b) => count($b) <=> count($a));

        return (string) (reset($groups)[0] ?? 'Sin técnico');
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

    private function scalar(mixed $value): string
    {
        return trim($value instanceof DateTimeInterface ? $value->format('Y-m-d') : (string) ($value ?? ''));
    }

    private function number(mixed $value): ?float
    {
        return is_numeric($value) ? (float) $value : null;
    }

    private function dateValue(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (is_numeric($value)) {
            return (new DateTimeImmutable('1899-12-30'))->modify('+'.(int) $value.' days')->format('Y-m-d');
        }
        $value = trim((string) ($value ?? ''));
        if ($value === '') {
            return null;
        }
        try {
            return (new DateTimeImmutable($value))->format('Y-m-d');
        } catch (Throwable) {
            return null;
        }
    }
}
