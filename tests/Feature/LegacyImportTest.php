<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Models\LegacyImportRow;
use App\Models\MaterialDisposition;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\InventorySummary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Comment\Comment;
use OpenSpout\Common\Entity\Comment\TextRun;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Tests\TestCase;

class LegacyImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_import_is_traceable_and_idempotent(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow($this->header());
            $writer->addRow($this->sourceRow([1, 'V-001', 'Juan Pérez', '2026-01-02', 'Cable calibre 12', 'Centro', 10, 5, 5]));
            $writer->addRow($this->sourceRow([2, 'V-001', 'Juan Pérez', '2026-01-02', 'Conector', 'Centro', 3, 3, 0]));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path])->assertSuccessful();
            $this->assertSame(1, Voucher::query()->count());
            $this->assertSame(2, LegacyImportRow::query()->count());
            $this->assertSame(1, MaterialDisposition::query()->count());
            $this->assertSame('2026-01-02', MaterialDisposition::query()->sole()->occurred_on->format('Y-m-d'));
            $this->assertSame('5.000', Voucher::query()->sole()->items()->firstOrFail()->pendingQuantity());
            $this->assertSame(VoucherDirection::Exit, Voucher::query()->sole()->direction);
            $this->assertSame('warehouse', Voucher::query()->sole()->location->code);
            $this->assertSame([], InventorySummary::rows());

            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('ya fue importado')
                ->assertSuccessful();
            $this->assertSame(1, Voucher::query()->count());
            $this->assertSame(2, LegacyImportRow::query()->count());
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_legacy_import_skips_old_rows_keeps_the_new_part_of_a_mixed_folio_and_stages_undated_rows(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-cutoff-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow($this->header());
            $writer->addRow($this->sourceRow([1, 'OLD', 'Ana', '2025-12-31', 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow($this->sourceRow([2, 'MIXED', 'Ana', '2025-12-31', 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow($this->sourceRow([3, 'MIXED', 'Ana', '2026-01-02', 'Conector', 'Centro', 1, 1, 0]));
            $writer->addRow($this->sourceRow([4, 'NO-DATE', 'Ana', null, 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow($this->sourceRow([5, 'NEW', 'Ana', '2026-01-02', 'Cable', 'Centro', 2, 2, 0]));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('skipped_before_cutoff')
                ->expectsOutputToContain('partial_cutoff_rows')
                ->expectsOutputToContain('unresolved_missing_date')
                ->assertSuccessful();

            $this->assertSame(['MIXED', 'NEW'], Voucher::query()->pluck('folio')->all());
            $this->assertTrue(Voucher::query()->where('folio', 'MIXED')->sole()->needs_review);
            $this->assertSame(3, LegacyImportRow::query()->count());
            $this->assertDatabaseHas('legacy_import_rows', [
                'row_number' => 5,
                'imported_type' => null,
                'imported_id' => null,
            ]);
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_an_undated_voucher_can_be_inferred_from_a_report_comment(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-inferred-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow($this->header());
            $writer->addRow($this->sourceRow(
                [1, 'INFERRED', 'Ana', null, 'Cable', 'Contreras', 2, 1, 1],
                'Persona revisora:'.PHP_EOL.'15/4/26 Patio 22072',
            ));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path])->assertSuccessful();

            $voucher = Voucher::query()->sole();
            $movement = MaterialDisposition::query()->sole();
            $this->assertSame('2026-04-15', $voucher->issued_on->format('Y-m-d'));
            $this->assertTrue($voucher->needs_review);
            $this->assertContains('La fecha del vale se infirió como 2026-04-15 a partir de la información disponible.', $voucher->review_reasons);
            $this->assertSame('2026-04-15', $movement->occurred_on->format('Y-m-d'));
            $this->assertSame('22072', $movement->reference);
            $this->assertSame('Patio', $movement->destination);
            $this->assertSame(2, LegacyImportRow::query()->sole()->row_number);
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_dry_run_performs_the_full_analysis_without_writing(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-dry-run-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow($this->header());
            $writer->addRow($this->sourceRow([1, 'DRY', 'Ana', '2026-01-02', 'Cable', 'Centro', 2, 2, 0]));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path, '--dry-run' => true])
                ->expectsOutputToContain('Simulación completa')
                ->expectsOutputToContain('vouchers')
                ->assertSuccessful();

            $this->assertDatabaseCount('vouchers', 0);
            $this->assertDatabaseCount('legacy_import_rows', 0);
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_an_existing_warehouse_folio_aborts_before_any_import_row_is_written(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-conflict-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow($this->header());
            $writer->addRow($this->sourceRow([1, 'EXISTING', 'Ana', '2026-01-02', 'Cable', 'Centro', 2, 2, 0]));
            $writer->close();

            $warehouse = StorageLocation::factory()->create(['code' => 'warehouse']);
            Voucher::factory()->create([
                'storage_location_id' => $warehouse->id,
                'folio' => 'EXISTING',
                'folio_key' => 'EXISTING',
            ]);

            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('entrarían en conflicto')
                ->assertFailed();

            $this->assertDatabaseCount('vouchers', 1);
            $this->assertDatabaseCount('legacy_import_rows', 0);
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    private function header(): Row
    {
        return Row::fromValues([
            'N°', 'VALE', 'TÉCNICO', 'FECHA DEL VALE', 'DESCRIPCION', 'DESTINO', 'CANTIDAD', 'DIFERENCIA',
            'REPORTE 1', 'REPORTE 2', 'REPORTE 3', 'REPORTE 4', 'REPORTE 5',
            'REPORTE 6', 'REPORTE 7', 'REPORTE 8', 'REPORTE 9', 'REPORTE 10',
        ]);
    }

    /** @param array<int, mixed> $values */
    private function sourceRow(array $values, ?string $reportOneComment = null): Row
    {
        $values = array_pad($values, 18, null);
        $cells = array_map(fn (mixed $value): Cell => Cell::fromValue($value), $values);
        if ($reportOneComment !== null) {
            $cells[8] = $cells[8]->withComment(new Comment(textRuns: [new TextRun($reportOneComment)]));
        }

        return new Row($cells);
    }
}
