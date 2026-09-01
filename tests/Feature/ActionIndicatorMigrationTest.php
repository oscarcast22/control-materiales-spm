<?php

namespace Tests\Feature;

use App\Enums\VoucherDirection;
use App\Enums\VoucherStatus;
use App\Models\Action;
use App\Models\AuditEvent;
use App\Models\Program;
use App\Models\StorageLocation;
use App\Models\Voucher;
use App\Support\Normalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ActionIndicatorMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_adds_the_catalog_without_changing_existing_voucher_classifications_or_reviews(): void
    {
        $path = 'database/migrations/2026_09_01_120000_add_action_indicators_and_populate_spm06_catalog.php';

        $this->artisan('migrate:rollback', ['--path' => $path])->assertSuccessful();
        $this->assertFalse(Schema::hasColumn('vouchers', 'action_indicator_id'));

        $location = StorageLocation::factory()->create(['code' => 'warehouse']);
        $program = Program::factory()->create(['code' => 'LEGACY-06']);
        $action = Action::factory()->create([
            'program_id' => $program->id,
            'code' => 'LEGACY-06-01',
        ]);
        $voucher = Voucher::query()->create([
            'storage_location_id' => $location->id,
            'folio' => 'LEGACY-CLASSIFICATION',
            'folio_key' => Normalizer::folio('LEGACY-CLASSIFICATION'),
            'direction' => VoucherDirection::Exit,
            'issued_on' => '2026-08-31',
            'program_id' => $program->id,
            'action_id' => $action->id,
            'status' => VoucherStatus::Active,
            'needs_review' => true,
            'review_reasons' => ['classification_requires_review', 'destination_split_uncertain'],
        ]);

        $this->artisan('migrate', ['--path' => $path])->assertSuccessful();

        $voucher->refresh();
        $this->assertTrue(Schema::hasColumn('vouchers', 'action_indicator_id'));
        $this->assertSame($program->id, $voucher->program_id);
        $this->assertSame($action->id, $voucher->action_id);
        $this->assertNull($voucher->action_indicator_id);
        $this->assertTrue($voucher->needs_review);
        $this->assertSame(['classification_requires_review', 'destination_split_uncertain'], $voucher->review_reasons);
        $this->assertDatabaseCount('actions', 18);
        $this->assertDatabaseCount('action_indicators', 21);
        $this->assertDatabaseMissing('audit_events', [
            'auditable_type' => Voucher::class,
            'auditable_id' => $voucher->id,
            'event' => 'classification_catalog_migrated',
        ]);
        $this->assertSame(0, AuditEvent::query()->count());
    }
}
