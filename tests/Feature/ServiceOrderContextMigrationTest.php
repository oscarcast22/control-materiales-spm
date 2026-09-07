<?php

namespace Tests\Feature;

use App\Models\MaterialApplicationReport;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ServiceOrderContextMigrationTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION_PATH = 'database/migrations/2026_09_04_120000_add_service_order_context_to_application_reports.php';

    public function test_existing_reports_remain_unclassified_when_the_new_context_is_added(): void
    {
        $this->artisan('migrate:rollback', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        $this->assertFalse(Schema::hasColumn('material_application_reports', 'service_order_type'));
        $this->assertFalse(Schema::hasColumn('material_application_reports', 'location'));

        $user = User::factory()->create();
        $report = MaterialApplicationReport::create([
            'voucher_id' => Voucher::factory()->create()->id,
            'occurred_on' => '2026-09-03',
            'reference' => 'OS-HISTORICA-1',
            'notes' => 'Reporte previo a la clasificación.',
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        $this->artisan('migrate', ['--path' => self::MIGRATION_PATH])->assertSuccessful();

        $report->refresh();
        $this->assertTrue(Schema::hasColumn('material_application_reports', 'service_order_type'));
        $this->assertTrue(Schema::hasColumn('material_application_reports', 'location'));
        $this->assertNull($report->service_order_type);
        $this->assertNull($report->location);
        $this->assertSame('OS-HISTORICA-1', $report->reference);
        $this->assertSame('Reporte previo a la clasificación.', $report->notes);
    }
}
