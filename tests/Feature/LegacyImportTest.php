<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\Destination;
use App\Models\Material;
use App\Models\Person;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Unit;
use App\Models\Voucher;
use App\Support\LegacyControlWorkbook;
use App\Support\Normalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Tests\TestCase;

class LegacyImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_numeric_values_above_material_headers_are_ignored(): void
    {
        $path = $this->workbook([
            $this->warehouseRow('16576', 'SALIDA', '2026-08-24', 'Centro', 'Israel Jurado', 'Nelson Treto', 2, null),
        ], [], 'Cable POT calibre 14', true);

        try {
            $rows = app(LegacyControlWorkbook::class)->read($path);

            $this->assertCount(1, $rows);
            $this->assertSame('Cable POT calibre 14', $rows[0]['items'][0]['material']);
            $this->assertSame(2.0, $rows[0]['items'][0]['quantity']);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_august_import_is_atomic_traceable_and_preserves_historical_loans(): void
    {
        $catalog = $this->catalog();
        $path = $this->workbook([
            $this->warehouseRow('16577', 'SALIDA', '2026-08-24', 'Actualización LED 2026 Blvd. Guadiana', 'Israel Jurado', 'Nelson Treto', 2, 1),
            $this->warehouseRow('16579', 'CANCELADO', '2026-08-25', 'San Carlos', 'Israel Jurado', '', 1, 1),
            $this->warehouseRow('16582', 'Prestado', '2026-08-25', '', 'Marco', '', null, null),
            $this->warehouseRow('16583', 'SALIDA', '2026-08-26', 'Circuito interior', '', 'Nelson Treto', 1, 1),
            $this->warehouseRow('OLD', 'SALIDA', '2025-08-24', 'Viejo', 'Israel Jurado', 'Nelson Treto', 1, 1),
        ], [
            $this->yardRow('3753', 'SALIDA', '2026-08-25', '5 de Mayo', 'Israel Jurado', 'Nelson Treto', 3),
        ]);

        try {
            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('cancelled_ready')
                ->expectsOutputToContain('missing_receiver')
                ->assertSuccessful();

            $this->assertDatabaseCount('vouchers', 4);
            $this->assertDatabaseCount('legacy_import_rows', 5);
            $this->assertDatabaseCount('material_applications', 0);
            $active = Voucher::query()->where('folio', '16577')->sole();
            $this->assertSame(VoucherDirection::Exit, $active->direction);
            $this->assertSame($catalog['program']->id, $active->program_id);
            $this->assertSame($catalog['action']->id, $active->action_id);
            $this->assertSame($catalog['authorizer']->id, $active->authorized_by_id);
            $this->assertSame('warehouse', $active->location->code);
            $this->assertSame(2, $active->items()->count());
            $this->assertSame(['Blvd. Guadiana'], $active->destinations()->pluck('name')->all());
            $this->assertSame('Actualización LED 2026', $active->usage_description);

            $yard = Voucher::query()->where('folio', '3753')->sole();
            $this->assertSame('yard', $yard->location->code);
            $this->assertNull($yard->program_id);
            $this->assertNull($yard->action_id);

            $loan = Voucher::query()->where('folio', '16582')->sole();
            $this->assertSame(VoucherStatus::Loaned, $loan->status);
            $this->assertNull($loan->direction);
            $this->assertSame('Marco', $loan->loaned_to_name);
            $this->assertSame(0, $loan->items()->count());

            $cancelled = Voucher::query()->where('folio', '16579')->sole();
            $this->assertSame(VoucherStatus::Cancelled, $cancelled->status);
            $this->assertNull($cancelled->received_by_id);
            $this->assertNull($cancelled->delivered_by_id);
            $this->assertSame(0, $cancelled->items()->count());

            $this->assertDatabaseHas('legacy_import_rows', [
                'row_number' => 5,
                'imported_type' => null,
                'imported_id' => null,
            ]);

            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('ya fue importado')
                ->assertSuccessful();
            $this->assertDatabaseCount('vouchers', 4);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_a_historical_loan_does_not_require_a_holder_name(): void
    {
        $this->catalog();
        $path = $this->workbook([
            $this->warehouseRow('16584', 'Prestado', '2026-08-27', '', '', '', null, null),
        ], []);

        try {
            $this->artisan('legacy:import-control', ['file' => $path])->assertSuccessful();

            $loan = Voucher::query()->sole();
            $this->assertSame(VoucherStatus::Loaned, $loan->status);
            $this->assertNull($loan->loaned_to_name);
            $this->assertNull($loan->direction);
            $this->assertNull($loan->authorized_by_id);
            $this->assertSame(0, $loan->items()->count());
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_import_omits_the_whole_voucher_when_a_material_is_unresolved(): void
    {
        $this->catalog();
        $path = $this->workbook([
            $this->warehouseRow('UNKNOWN', 'SALIDA', '2026-08-24', 'Centro', 'Israel Jurado', 'Nelson Treto', 2, null),
        ], [], 'Material no catalogado');

        try {
            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('unresolved_material')
                ->assertSuccessful();

            $this->assertDatabaseCount('vouchers', 0);
            $this->assertDatabaseCount('voucher_items', 0);
            $this->assertDatabaseCount('legacy_import_rows', 1);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_dry_run_analyzes_without_writing_and_existing_folios_fail_before_tracing(): void
    {
        $this->catalog();
        $path = $this->workbook([
            $this->warehouseRow('DRY', 'SALIDA', '2026-08-24', 'Centro', 'Israel Jurado', 'Nelson Treto', 2, null),
        ]);

        try {
            $this->artisan('legacy:import-control', ['file' => $path, '--dry-run' => true])
                ->expectsOutputToContain('Simulación completa')
                ->assertSuccessful();
            $this->assertDatabaseCount('vouchers', 0);
            $this->assertDatabaseCount('legacy_import_rows', 0);

            $warehouse = StorageLocation::query()->where('code', 'warehouse')->sole();
            Voucher::factory()->create([
                'storage_location_id' => $warehouse->id,
                'folio' => 'DRY',
                'folio_key' => Normalizer::folio('DRY'),
            ]);
            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('entrarían en conflicto')
                ->assertFailed();
            $this->assertDatabaseCount('vouchers', 1);
            $this->assertDatabaseCount('legacy_import_rows', 0);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    /** @return array{program: Program, action: Action, authorizer: Person} */
    private function catalog(): array
    {
        StorageLocation::factory()->create(['code' => 'warehouse', 'name' => 'Almacén']);
        StorageLocation::factory()->create(['code' => 'yard', 'name' => 'Patio']);
        $unit = Unit::factory()->create(['symbol' => 'pza']);
        foreach (['Cable POT calibre 14', 'Cinta de aislar', 'Luminaria LED 50 W'] as $name) {
            Material::factory()->create([
                'name' => $name,
                'normalized_name' => Normalizer::key($name),
                'default_unit_id' => $unit->id,
            ]);
        }
        Person::factory()->create([
            'name' => 'Israel Jurado',
            'normalized_name' => Normalizer::key('Israel Jurado'),
            'can_receive_material' => true,
            'can_deliver_material' => false,
        ]);
        Person::factory()->create([
            'name' => 'Nelson Treto',
            'normalized_name' => Normalizer::key('Nelson Treto'),
            'can_receive_material' => false,
            'can_deliver_material' => true,
        ]);
        $authorizer = Person::factory()->create([
            'name' => 'Cipriano Salas',
            'normalized_name' => Normalizer::key('Cipriano Salas'),
            'can_receive_material' => false,
            'can_deliver_material' => false,
            'can_authorize_material' => true,
        ]);
        $program = Program::factory()->create(['code' => 'SPM-06']);
        $action = Action::factory()->create(['program_id' => $program->id, 'code' => 'SPM-06-01']);
        foreach (['Centro', 'Circuito interior', 'Poblado 5 de Mayo', 'Blvd. Guadiana'] as $name) {
            Destination::factory()->create([
                'name' => $name,
                'normalized_name' => Normalizer::key($name),
            ]);
        }

        return compact('program', 'action', 'authorizer');
    }

    /** @param list<array<int, mixed>> $warehouseRows
     * @param  list<array<int, mixed>>  $yardRows
     */
    private function workbook(array $warehouseRows, array $yardRows = [], string $firstMaterial = 'Cable POT calibre 14', bool $includeNumericRow = false): string
    {
        $path = tempnam(sys_get_temp_dir(), 'vouchers-import-');
        $this->assertNotFalse($path);
        $writer = new Writer;
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Vale de Almacen');
        if ($includeNumericRow) {
            $writer->addRow(Row::fromValues([null, null, null, null, null, null, null, null, null, null, 73.96, 22.79]));
        }
        $writer->addRow(Row::fromValues([
            '#', 'FOLIO', 'TIPO DE VALE', 'ENTRADA O SALIDA', 'FECHA', 'PROGRAMA SPM-',
            'ACCION SPM-06-', 'Destino', 'RECIBIO MATERIAL', 'ENTREGO MATERIAL', $firstMaterial, 'Cinta de aislar',
        ]));
        foreach ($warehouseRows as $row) {
            $writer->addRow(Row::fromValues($row));
        }
        $writer->addNewSheetAndMakeItCurrent()->setName('Vale de Patio');
        $writer->addRow(Row::fromValues([
            '#', 'FOLIO', 'ENTRADA O SALIDA', 'FECHA', 'Destino', 'RECIBIO MATERIAL', 'ENTREGO MATERIAL', 'Luminaria LED 50 W',
        ]));
        foreach ($yardRows as $row) {
            $writer->addRow(Row::fromValues($row));
        }
        $writer->close();

        return $path;
    }

    /** @return array<int, mixed> */
    private function warehouseRow(string $folio, string $status, string $date, string $destination, string $receiver, string $deliverer, ?float $first, ?float $second): array
    {
        return [null, $folio, 'salida', $status, $date, 6, 1, $destination, $receiver, $deliverer, $first, $second];
    }

    /** @return array<int, mixed> */
    private function yardRow(string $folio, string $status, string $date, string $destination, string $receiver, string $deliverer, ?float $quantity): array
    {
        return [null, $folio, $status, $date, $destination, $receiver, $deliverer, $quantity];
    }
}
