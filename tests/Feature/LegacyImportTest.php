<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Models\LegacyImportRow;
use App\Models\MaterialDisposition;
use App\Models\Voucher;
use App\Support\InventorySummary;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            $writer->addRow(Row::fromValues(['N°', 'VALE', 'TÉCNICO', 'FECHA', 'MATERIAL', 'DESTINO', 'CANTIDAD', 'DIFERENCIA', 'REPORTE 1']));
            $writer->addRow(Row::fromValues([1, 'V-001', 'Juan Pérez', '2026-01-02', 'Cable calibre 12', 'Centro', 10, 5, 5]));
            $writer->addRow(Row::fromValues([2, 'V-001', 'Juan Pérez', '2026-01-02', 'Conector', 'Centro', 3, 3, 0]));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path])->assertSuccessful();
            $this->assertSame(1, Voucher::query()->count());
            $this->assertSame(2, LegacyImportRow::query()->count());
            $this->assertSame(1, MaterialDisposition::query()->count());
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

    public function test_legacy_import_skips_old_undated_and_mixed_folios_as_complete_groups(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'legacy-cutoff-test-');
        $this->assertNotFalse($path);

        try {
            $writer = new Writer;
            $writer->openToFile($path);
            $writer->getCurrentSheet()->setName('victor');
            $writer->addRow(Row::fromValues(['N°', 'VALE', 'TÉCNICO', 'FECHA', 'MATERIAL', 'DESTINO', 'CANTIDAD', 'DIFERENCIA', 'REPORTE 1']));
            $writer->addRow(Row::fromValues([1, 'OLD', 'Ana', '2025-12-31', 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow(Row::fromValues([2, 'MIXED', 'Ana', '2025-12-31', 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow(Row::fromValues([3, 'MIXED', 'Ana', '2026-01-02', 'Conector', 'Centro', 1, 1, 0]));
            $writer->addRow(Row::fromValues([4, 'NO-DATE', 'Ana', null, 'Cable', 'Centro', 1, 1, 0]));
            $writer->addRow(Row::fromValues([5, 'NEW', 'Ana', '2026-01-02', 'Cable', 'Centro', 2, 2, 0]));
            $writer->close();

            $this->artisan('legacy:import-control', ['file' => $path])
                ->expectsOutputToContain('skipped_before_cutoff')
                ->expectsOutputToContain('skipped_mixed_dates')
                ->expectsOutputToContain('skipped_without_date')
                ->assertSuccessful();

            $this->assertSame(['NEW'], Voucher::query()->pluck('folio')->all());
            $this->assertSame(1, LegacyImportRow::query()->count());
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }
}
